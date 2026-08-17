import { generateTraceabilityHash } from "../osintTerritorialV2";

export interface UnifiedEvidence {
  id: string;
  source: string;
  type: string;
  image: string;
  coordinates: {
    lat: number | null;
    lng: number | null;
  };
  metadata: {
    heading?: number;
    pitch?: number;
    fov?: number;
    captureDate?: string;
    description?: string;
    criminologicalInterpretation?: string;
    riskLevel?: string;
    sourceProvider?: string;
    [key: string]: any;
  };
  timestamp: string;
  hash: string;
  category: string;
  status: "APPROVED" | "VALIDATED" | "PENDING_REVIEW" | "CONFIRMED" | "REJECTED";
  hasImage: boolean;
  duplicateOf?: string;
}

export class EvidenceAdapterEngine {
  /**
   * Adapta y homologa cualquier formato de evidencia (StreetViewFinding, AlbumPhoto, StreetViewEvidence)
   * a un modelo UnifiedEvidence estandarizado e inmutable.
   */
  static adapt(raw: any, indexFallback: number = 0): UnifiedEvidence {
    if (!raw) {
      const fallbackId = `EV-FALLBACK-${Date.now()}-${indexFallback}`;
      return {
        id: fallbackId,
        source: "SISTEMA",
        type: "REMOTE_STREET_VIEW",
        image: "",
        coordinates: { lat: null, lng: null },
        metadata: { description: "Evidencia de reemplazo técnico por error de inicialización." },
        timestamp: new Date().toISOString(),
        hash: generateTraceabilityHash("SIN_DATA", new Date().toISOString(), fallbackId),
        category: "VULNERABILIDAD_FISICA",
        status: "APPROVED",
        hasImage: false
      };
    }

    // 1. Extraer ID
    const id = String(raw.id || raw.evidenceId || raw.uuid || `SV-00${indexFallback + 1}`);

    // 2. Extraer o resolver URL/Base64 de Imagen
    const image = String(
      raw.image ||
      raw.dataUrl ||
      raw.previewUrl ||
      raw.url ||
      raw.imageUrl ||
      raw.capturaPanoramica ||
      raw.panoramaUrl ||
      raw.streetViewMetadata?.staticUrl ||
      ""
    );

    // 3. Extraer Coordenadas
    const lat = Number(raw.lat ?? raw.gpsLat ?? raw.coordinates?.lat ?? raw.streetViewMetadata?.panoramaLat ?? null);
    const lng = Number(raw.lng ?? raw.gpsLng ?? raw.coordinates?.lng ?? raw.streetViewMetadata?.panoramaLng ?? null);

    // 4. Extraer Metadatos
    const heading = raw.heading ?? raw.streetViewMetadata?.heading ?? 0;
    const pitch = raw.pitch ?? raw.streetViewMetadata?.pitch ?? 0;
    const fov = raw.fov ?? raw.streetViewMetadata?.fov ?? 90;
    const captureDate = raw.captureDate ?? raw.date ?? raw.streetViewMetadata?.captureDate ?? new Date().toLocaleDateString("es-MX");
    const description = String(raw.comentario || raw.description || raw.observed || raw.indicadorCriminologico || raw.caption || "Sin descripción proporcionada.");
    const criminologicalInterpretation = String(raw.criminologicalInterpretation || raw.interpretation || raw.inferenciaAnalitica || raw.operationalImpact || "Análisis táctico territorial.");
    const riskLevel = String(raw.riskLevel || raw.nivelRiesgo || "MEDIO").toUpperCase();
    const sourceProvider = String(raw.sourceProvider || raw.fuente || (id.startsWith("SV") || raw.isStreetView ? "GOOGLE_STREET_VIEW" : "INSPECCION_CAMPO"));

    // 5. Determinar Categoría y Origen
    const isStreetView = id.startsWith("SV") || raw.isStreetView || raw.tipo?.toLowerCase().includes("street") || raw.evidenceType === "VIRTUAL_STREET_VIEW";
    const type = isStreetView ? "REMOTE_STREET_VIEW" : "PHOTO_FIELD";
    const source = isStreetView ? "GOOGLE_STREET_VIEW" : "ANALYST";
    const category = String(raw.category || raw.streetViewCategory || (isStreetView ? "STREET_VIEW" : "VULNERABILIDAD_FISICA"));

    // 6. Determinar Estado
    let status: UnifiedEvidence["status"] = "APPROVED";
    if (raw.status) {
      const upperStatus = String(raw.status).toUpperCase();
      if (["APPROVED", "VALIDATED", "PENDING_REVIEW", "CONFIRMED", "REJECTED"].includes(upperStatus)) {
        status = upperStatus as UnifiedEvidence["status"];
      }
    }

    // 7. Generar Hash Inmutable
    const timestamp = raw.createdAt || raw.fecha || raw.gpsTimestamp || new Date().toISOString();
    const hash = raw.traceabilityHash || generateTraceabilityHash(description, timestamp, `${id}-${lat}-${lng}`);

    return {
      id,
      source,
      type,
      image,
      coordinates: {
        lat: isNaN(lat) ? null : lat,
        lng: isNaN(lng) ? null : lng
      },
      metadata: {
        heading,
        pitch,
        fov,
        captureDate,
        description,
        criminologicalInterpretation,
        riskLevel,
        sourceProvider,
        ...raw.streetViewMetadata
      },
      timestamp,
      hash,
      category,
      status,
      hasImage: image.length > 20 && !image.includes("placeholder"),
      duplicateOf: raw.duplicateOf
    };
  }

  /**
   * Adapta un arreglo de evidencias heterogéneas
   */
  static adaptArray(rawList: any[]): UnifiedEvidence[] {
    if (!Array.isArray(rawList)) return [];
    return rawList.map((item, idx) => EvidenceAdapterEngine.adapt(item, idx));
  }
}
export default EvidenceAdapterEngine;
