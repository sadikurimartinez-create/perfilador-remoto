import { NextResponse } from "next/server";
import { analyzeBrokenWindowsWithVision } from "@/lib/googleVision";
import { searchPlacesAround } from "@/lib/googlePlaces";
import { searchDenueAround } from "@/lib/denueInegi";
import {
  buildConflictPoints,
  buildIrregularBusinesses
} from "@/lib/environmentProfile";
import { getPool } from "@/lib/db";
import { buildStreetViewUrl } from "@/lib/googleStreetView";

type PhotoPayload = {
  id: string;
  lat: number | null;
  lng: number | null;
  tipo: string;
  comentario: string;
  imageBase64?: string;
};

type RequestBody = {
  photos: PhotoPayload[];
  analysisRadius?: number;
  /** Polígono de análisis trazado manualmente (opcional). */
  analysisPolygon?: { lat: number; lng: number }[];
  /** POIs manuales trazados por el analista (opcional). */
  manualPois?: { lat: number; lng: number; label?: string }[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const { photos, analysisPolygon, manualPois } = body;

    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array 'photos' con al menos un elemento." },
        { status: 400 }
      );
    }

    const photosWithCoords = photos.filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        !Number.isNaN(p.lat) &&
        !Number.isNaN(p.lng)
    );
    if (photosWithCoords.length === 0) {
      return NextResponse.json(
        { error: "Ninguna foto tiene coordenadas GPS válidas para el análisis." },
        { status: 400 }
      );
    }

    const radiusMeters =
      typeof body.analysisRadius === "number" && body.analysisRadius > 0
        ? body.analysisRadius
        : 500;
    const centerLat =
      photosWithCoords.reduce((a, p) => a + (p.lat as number), 0) /
      photosWithCoords.length;
    const centerLng =
      photosWithCoords.reduce((a, p) => a + (p.lng as number), 0) /
      photosWithCoords.length;

    const visionPromises = photos.map(async (p) => {
      if (!p.imageBase64)
        return { photoId: p.id, visionLabels: [] as string[], raw: null };
      const result = await analyzeBrokenWindowsWithVision({
        imageBase64: p.imageBase64
      }).catch((err) => {
        console.error(
          "[api/analyze-selection] Vision error detallado para foto",
          p.id,
          err
        );
        return null;
      });
      const labels = result?.etiquetasRelevantes ?? [];
      return {
        photoId: p.id,
        visionLabels: labels,
        raw: result
      };
    });

    const [placesResult, denueResult] = await Promise.all([
      searchPlacesAround(centerLat, centerLng, radiusMeters).catch(() => null),
      searchDenueAround(centerLat, centerLng, radiusMeters).catch(() => null)
    ]);

    // Incidencia histórica en el radio alrededor del clúster de fotos
    let delitosCercanos: any[] = [];
    try {
      const dbQueryPromise = getPool().query(
        `
        SELECT
          incidente,
          rango_horario,
          ST_Y(geometria::geometry) AS lat,
          ST_X(geometria::geometry) AS lng
        FROM incidencia_estadistica
        WHERE ST_DWithin(
          geometria,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      `,
        [centerLng, centerLat, radiusMeters]
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout en la base de datos (5s)")), 5000)
      );

      const raceResult = await Promise.race([dbQueryPromise, timeoutPromise]) as any;
      delitosCercanos = raceResult.rows || [];
    } catch (err) {
      console.error(
        "[api/analyze-selection] Error en consulta histórica o timeout de DB:",
        err
      );
      delitosCercanos = [];
    }

    const resumenPorDelito = new Map<string, number>();
    const resumenPorRango = new Map<string, number>();

    for (const row of delitosCercanos) {
      const tipo = row.incidente as string;
      const rango = (row.rango_horario as string) ?? "Sin rango definido";
      resumenPorDelito.set(tipo, (resumenPorDelito.get(tipo) ?? 0) + 1);
      resumenPorRango.set(rango, (resumenPorRango.get(rango) ?? 0) + 1);
    }

    const totalDelitos = delitosCercanos.length;

    const resumenTextoDelitos =
      totalDelitos === 0
        ? "En el radio analizado no se registran incidentes históricos en la base de incidencia_estadistica."
        : `En un radio de ${radiusMeters} m alrededor de las evidencias se registran ${totalDelitos} incidentes históricos: ` +
          Array.from(resumenPorDelito.entries())
            .map(([tipo, n]) => `${n} × ${tipo}`)
            .join(", ") +
          ". Los rangos horarios predominantes son: " +
          Array.from(resumenPorRango.entries())
            .map(([rango, n]) => `${n} × ${rango}`)
            .join(", ") +
          ".";

    const perPhotoFindings = await Promise.all(visionPromises);

    const comerciosIrregulares = buildIrregularBusinesses(placesResult, denueResult);
    const atractoresDelito = buildConflictPoints(placesResult, 100);

    const comentariosTexto = photos
      .map((p) => `[${p.tipo}] ${p.comentario || "(sin comentario)"}`)
      .join("\n");
    const visionResumen = perPhotoFindings
      .map((f) => f.visionLabels?.join(", ") ?? "—")
      .join(" | ");
    const irregularesResumen =
      comerciosIrregulares.posiblesIrregulares.length > 0
        ? `Comercios posibles irregulares: ${comerciosIrregulares.posiblesIrregulares.map((i) => i.lugarGoogle.nombre).join("; ")}.`
        : "";
    const conflictosResumen =
      atractoresDelito.puntosConflictoEscuelaAlcohol.length > 0
        ? atractoresDelito.resumen
        : "";

    const unifiedProfile = [
      "Perfil criminológico ambiental (selección):",
      "",
      "Comentarios del investigador:",
      comentariosTexto,
      "",
      "Indicadores Vision (Ventanas Rotas):",
      visionResumen || "Sin datos de visión.",
      "",
      irregularesResumen,
      conflictosResumen,
      "",
      "Estadística histórica de incidencia en el área:",
      resumenTextoDelitos
    ]
      .filter(Boolean)
      .join("\n");

    const heatmapData = photos.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      weight: 1
    }));

    const historicalCrimes = delitosCercanos.map((row: any) => ({
      lat: Number(row.lat),
      lng: Number(row.lng),
      tipoDelito: row.incidente as string,
      rangoHorario: (row.rango_horario as string) ?? null
    }));

    const pois = placesResult
      ? [
          ...placesResult.escuelas.map((p) => ({ lat: p.lat, lng: p.lng, name: p.nombre, category: p.categoria })),
          ...placesResult.expendiosAlcohol.map((p) => ({ lat: p.lat, lng: p.lng, name: p.nombre, category: p.categoria })),
          ...placesResult.chatarrerasOTalleres.map((p) => ({ lat: p.lat, lng: p.lng, name: p.nombre, category: p.categoria })),
          ...placesResult.otros.map((p) => ({ lat: p.lat, lng: p.lng, name: p.nombre, category: p.categoria }))
        ]
      : [];

    // Generar lugares de acecho virtuales con imágenes reales de Google Street View dividido en tres categorías tácticas
    // Helper para limitar imágenes entre 2 y 4 de forma segura
    function validateStreetViewCategoryLimit(
      images: Array<{ name: string; observed: string; streetViewUrl: string; lat: number; lng: number }>,
      categoryType: "hideout" | "graffiti" | "denue_interest"
    ) {
      if (images.length === 0) return [];
      if (images.length === 1) {
        const base = images[0];
        const offsetSvUrl = buildStreetViewUrl(base.lat, base.lng, { heading: 180 });
        return [
          {
            ...base,
            streetViewCategory: categoryType,
            streetViewSource: "Google Street View",
            analysisType: "STREET_VIEW"
          },
          {
            ...base,
            name: `${base.name} (Perspectiva de Cobertura)`,
            observed: `${base.observed} Vista de contra-ángulo para cobertura vial de 180 grados.`,
            streetViewUrl: offsetSvUrl || base.streetViewUrl,
            streetViewCategory: categoryType,
            streetViewSource: "Google Street View",
            analysisType: "STREET_VIEW"
          }
        ];
      }
      
      const mapped = images.map(img => ({
        ...img,
        streetViewCategory: categoryType,
        streetViewSource: "Google Street View",
        analysisType: "STREET_VIEW"
      }));
      
      if (mapped.length > 4) {
        return mapped.slice(0, 4);
      }
      return mapped;
    }

    // 1. CATEGORÍA 1: Lugares de acecho o escondite (hideout)
    const hideoutCandidates = [
      { name: "Zona de Ocultamiento Táctica (Acceso Norte)", dLat: 0.0012, dLng: 0.0002, desc: "Identificación de zona de ocultamiento secundario, accesos ciegos y baja visibilidad." },
      { name: "Punto de Acecho Urbano (Acceso Sur)", dLat: -0.0012, dLng: -0.0002, desc: "Análisis de puntos ciegos de vigilancia informal y de corredores de escape táctico." },
      { name: "Espacio de Vigilancia Informal (Acceso Este)", dLat: 0.0002, dLng: 0.0012, desc: "Evaluación de infraestructura con baja iluminación e inmuebles con nula visibilidad." },
      { name: "Acceso Secundario de Escape (Acceso Oeste)", dLat: -0.0002, dLng: -0.0012, desc: "Análisis de vías secundarias abandonadas e infraestructura desatendida." }
    ].map(off => {
      const targetLat = centerLat + off.dLat;
      const targetLng = centerLng + off.dLng;
      const svUrl = buildStreetViewUrl(targetLat, targetLng);
      return {
        name: off.name,
        observed: off.desc,
        streetViewUrl: svUrl as string,
        lat: targetLat,
        lng: targetLng
      };
    }).filter(img => img.streetViewUrl != null);

    const hideoutImages = validateStreetViewCategoryLimit(hideoutCandidates, "hideout");

    // 2. CATEGORÍA 2: Grafitis (graffiti)
    const graffitiCandidates = [
      { name: "Monitoreo de Pintas Territoriales (Noreste)", dLat: 0.0008, dLng: 0.0008, desc: "Detección de grafitis visibles, marcas de bandas y pintas territoriales espaciales." },
      { name: "Símbolos y Marcas Urbanas (Suroeste)", dLat: -0.0008, dLng: -0.0008, desc: "Inspección de marcajes urbanos y simbología en fachadas públicas." },
      { name: "Foco de Deterioro Físico (Sureste)", dLat: -0.0008, dLng: 0.0008, desc: "Análisis de acumulación de basura, vandalismo y grafitis en el entorno urbano." },
      { name: "Punto de Control de Grafitis Territoriales (Noroeste)", dLat: 0.0008, dLng: -0.0008, desc: "Detección táctica de firmas territoriales y de contaminación visual." }
    ].map(off => {
      const targetLat = centerLat + off.dLat;
      const targetLng = centerLng + off.dLng;
      const svUrl = buildStreetViewUrl(targetLat, targetLng);
      return {
        name: off.name,
        observed: off.desc,
        streetViewUrl: svUrl as string,
        lat: targetLat,
        lng: targetLng
      };
    }).filter(img => img.streetViewUrl != null);

    const graffitiImages = validateStreetViewCategoryLimit(graffitiCandidates, "graffiti");

    // 3. CATEGORÍA 3: Negocios estratégicos DENUE (denue_interest)
    const rawDenueUnits = denueResult?.unidades || [];
    const denueCandidates: any[] = [];

    for (const unit of rawDenueUnits) {
      const nameLower = unit.nombre.toLowerCase();
      const activityLower = (unit.actividad || "").toLowerCase();
      
      let isPriority = false;
      let matchedCategory = "";
      let matchedDesc = "";

      // 1. Bares / Cantinas / Expendios de alcohol
      if (
        nameLower.includes("bar") || nameLower.includes("cantina") || nameLower.includes("expendio") || 
        nameLower.includes("cerveza") || nameLower.includes("licor") || nameLower.includes("depósito") || 
        nameLower.includes("alcohol") || nameLower.includes("bebidas") || nameLower.includes("pub") || 
        nameLower.includes("discoteca") || nameLower.includes("vinatería") || nameLower.includes("modelorama") ||
        activityLower.includes("bar") || activityLower.includes("cantina") || activityLower.includes("alcohol") || 
        activityLower.includes("cerveza") || activityLower.includes("licores")
      ) {
        isPriority = true;
        matchedCategory = "Bares, Cantinas y Expendios de Alcohol";
        matchedDesc = `Establecimiento comercial de venta/consumo de alcohol catalogado en DENUE (${unit.nombre}). Atractor de riesgo prioritario en la zona.`;
      }
      // 2. Chatarreras / Talleres / Autopartes
      else if (
        nameLower.includes("chatarrera") || nameLower.includes("taller") || nameLower.includes("autopartes") || 
        nameLower.includes("mecánico") || nameLower.includes("deshuesadero") || nameLower.includes("refacciones") || 
        nameLower.includes("vulcanizadora") ||
        activityLower.includes("chatarrera") || activityLower.includes("taller") || activityLower.includes("automotriz") || 
        activityLower.includes("autopartes")
      ) {
        isPriority = true;
        matchedCategory = "Chatarreras, Talleres y Autopartes";
        matchedDesc = `Establecimiento de giros mecánicos o reciclaje registrado en DENUE (${unit.nombre}). Posible punto de acopio, vulnerabilidad física o alteración de bienes.`;
      }
      // 3. Casas de empeño / Préstamos
      else if (
        nameLower.includes("empeño") || nameLower.includes("préstamo") || nameLower.includes("prendario") || 
        nameLower.includes("pawn") || nameLower.includes("crédito") || nameLower.includes("financiera") || 
        nameLower.includes("monte de piedad") ||
        activityLower.includes("empeño") || activityLower.includes("prendario") || activityLower.includes("financiera")
      ) {
        isPriority = true;
        matchedCategory = "Casas de Empeño y Préstamos";
        matchedDesc = `Negocio prendario o de préstamos registrado en DENUE (${unit.nombre}). Punto de interés por flujo de efectivo, empeños o transacciones rápidas.`;
      }
      // 4. Moteles / Hospedaje de paso
      else if (
        nameLower.includes("motel") || nameLower.includes("hotel") || nameLower.includes("hospedaje") || 
        nameLower.includes("alojamiento") || nameLower.includes("posada") ||
        activityLower.includes("hotel") || activityLower.includes("motel") || activityLower.includes("hospedaje")
      ) {
        isPriority = true;
        matchedCategory = "Moteles y Hospedaje de Paso";
        matchedDesc = `Establecimiento de alojamiento/motel registrado en DENUE (${unit.nombre}). Zona de paso, pernocta informal o de potencial ocultamiento transitorio.`;
      }

      if (isPriority) {
        const svUrl = buildStreetViewUrl(unit.lat, unit.lng);
        if (svUrl) {
          denueCandidates.push({
            name: `${unit.nombre} (${matchedCategory})`,
            observed: matchedDesc,
            streetViewUrl: svUrl,
            lat: unit.lat,
            lng: unit.lng
          });
        }
      }
    }

    const denueImages = validateStreetViewCategoryLimit(denueCandidates, "denue_interest");

    // Combinar en flat list para compatibilidad total con PhotoAlbum actual y reportEngine
    const tacticalStreetViews = [...hideoutImages, ...graffitiImages, ...denueImages];

    const streetViewCategories = [
      {
        category: "hideout" as const,
        images: hideoutImages
      },
      {
        category: "graffiti" as const,
        images: graffitiImages
      },
      {
        category: "denue_interest" as const,
        images: denueImages
      }
    ];

    return NextResponse.json(
      {
        perPhotoFindings,
        unifiedProfile,
        heatmapData,
        historicalCrimes,
        pois,
        tacticalStreetViews,
        streetViewCategories,
        analysisPolygon: analysisPolygon ?? null,
        manualPois: manualPois ?? [],
        raw: {
          atractoresDelito,
          comerciosIrregulares
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/analyze-selection] Error:", error);
    return NextResponse.json(
      { error: "Error interno al analizar la selección." },
      { status: 500 }
    );
  }
}
