export type PlaceCategory =
  | "escuela"
  | "expendioAlcohol"
  | "chatarreraOTaller"
  | "otro";

export type PlaceSummary = {
  placeId: string;
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
  categoria: PlaceCategory;
  fuente: "GOOGLE_PLACES";
  resenasOsint?: string[];
};

export type PlacesAnalysisResult = {
  escuelas: PlaceSummary[];
  expendiosAlcohol: PlaceSummary[];
  chatarrerasOTalleres: PlaceSummary[];
  otros: PlaceSummary[];
};

const GOOGLE_PLACES_BASE_URL =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

const GOOGLE_PLACE_DETAILS_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";

function getMapsApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    null
  );
}

function classifyPlace(types: string[], name: string): PlaceCategory {
  const normTypes = types.map((t) => t.toLowerCase());
  const normName = name.toLowerCase();

  if (
    normTypes.includes("school") ||
    normTypes.includes("university") ||
    /escuela|colegio|universidad|jard[ií]n de niñ|kinder/.test(normName)
  ) {
    return "escuela";
  }

  if (
    normTypes.includes("bar") ||
    normTypes.includes("night_club") ||
    normTypes.includes("liquor_store") ||
    /bar|cantina|antro|licorer[ií]a|licores|cervecer[ií]a/.test(normName)
  ) {
    return "expendioAlcohol";
  }

  if (
    /chatarr[aí]a|yonque|deshuesadero|taller mec[aá]nico|reciclaje|chatarra/.test(
      normName
    ) ||
    normTypes.includes("car_repair") ||
    normTypes.includes("car_dealer")
  ) {
    return "chatarreraOTaller";
  }

  return "otro";
}

export async function searchPlacesAround(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<PlacesAnalysisResult | null> {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    console.warn(
      "[googlePlaces] Falta GOOGLE_MAPS_API_KEY o NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en variables de entorno."
    );
    return null;
  }

  const url = new URL(GOOGLE_PLACES_BASE_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(radiusMeters));

  // Dejamos que Google devuelva múltiples tipos y filtramos por nombre/types

  const response = await fetch(url.toString());

  if (!response.ok) {
    console.error(
      "[googlePlaces] Error al llamar a Places API",
      response.status,
      await response.text()
    );
    return null;
  }

  const data = (await response.json()) as any;
  const rawResults: any[] = data.results ?? [];
  
  // Limitamos a los 10 lugares más relevantes para no saturar los tiempos de respuesta ni los tokens de IA
  const topResults = rawResults.slice(0, 10);

  // Extraer las reseñas (OSINT) de los lugares seleccionados
  const results = await Promise.all(topResults.map(async (place) => {
    if (!place.place_id) return place;
    try {
      const dUrl = new URL(GOOGLE_PLACE_DETAILS_URL);
      dUrl.searchParams.set("key", apiKey);
      dUrl.searchParams.set("place_id", place.place_id);
      dUrl.searchParams.set("fields", "reviews");
      dUrl.searchParams.set("language", "es");
      // Ordenar por las más recientes para detectar focos rojos actuales
      dUrl.searchParams.set("reviews_sort", "newest");
      const dRes = await fetch(dUrl.toString());
      if (dRes.ok) {
        const dData = await dRes.json();
        if (dData.result?.reviews) {
          // Guardamos hasta 5 reseñas incluyendo calificación y fecha relativa
          place.reviews = dData.result.reviews
            .filter((r: any) => r.text && r.text.trim().length > 0)
            .map((r: any) => `[${r.rating}⭐ | ${r.relative_time_description || 'Fecha desconocida'}] ${r.text.trim()}`)
            .slice(0, 5);
        }
      }
    } catch (e) {
      console.warn("[googlePlaces] No se pudieron obtener reseñas para", place.place_id);
    }
    return place;
  }));

  const escuelas: PlaceSummary[] = [];
  const expendiosAlcohol: PlaceSummary[] = [];
  const chatarrerasOTalleres: PlaceSummary[] = [];
  const otros: PlaceSummary[] = [];

  for (const place of results) {
    const name: string = place.name ?? "";
    const location = place.geometry?.location;
    if (!location) continue;

    const latP = Number(location.lat);
    const lngP = Number(location.lng);
    const types: string[] = place.types ?? [];

    const categoria = classifyPlace(types, name);

    const summary: PlaceSummary = {
      placeId: place.place_id ?? "",
      nombre: name,
      direccion: place.vicinity ?? place.formatted_address ?? "",
      lat: latP,
      lng: lngP,
      categoria,
      fuente: "GOOGLE_PLACES",
      resenasOsint: place.reviews ?? []
    };

    switch (categoria) {
      case "escuela":
        escuelas.push(summary);
        break;
      case "expendioAlcohol":
        expendiosAlcohol.push(summary);
        break;
      case "chatarreraOTaller":
        chatarrerasOTalleres.push(summary);
        break;
      default:
        otros.push(summary);
    }
  }

  return {
    escuelas,
    expendiosAlcohol,
    chatarrerasOTalleres,
    otros
  };
}
