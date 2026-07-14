import { OsintGangEvidence } from "./models/gangIntelligenceTypes";

export interface RawOsintInput {
  id: string;
  sourceUrl: string;
  text: string;
  lat: number;
  lng: number;
  date?: string;
  rawType?: string; // "RIÑA" | "AMENAZA" | "ENFRENTAMIENTO" | "REFERENCIA_GENERAL"
}

export class GangOsintAnalyzer {
  /**
   * Calcula la distancia en metros entre dos coordenadas geográficas usando la fórmula de Haversine.
   */
  public static calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  }

  /**
   * Clasifica de forma no criminalizante y basada puramente en evidencia un evento de texto OSINT.
   */
  private static classifyEventType(rawType?: string): "RIÑA" | "CONFLICTO" | "PRESENCIA_SOCIAL" | "OTRO" {
    if (!rawType) return "OTRO";
    const typeUpper = rawType.toUpperCase();

    if (typeUpper === "RIÑA" || typeUpper === "ENFRENTAMIENTO") {
      return "RIÑA";
    }
    if (typeUpper === "AMENAZA") {
      return "CONFLICTO";
    }
    if (typeUpper === "REFERENCIA_GENERAL" || typeUpper === "PRESENCIA_SOCIAL") {
      return "PRESENCIA_SOCIAL";
    }
    return "OTRO";
  }

  /**
   * Determina la relación territorial basándose estrictamente en la proximidad geográfica.
   * "DIRECT": Menor a 250 metros del centroide.
   * "INDIRECT": Entre 250 y 500 metros del centroide.
   * "NONE": Mayor a 500 metros.
   */
  public static getTerritorialRelation(distanceMeters: number): "DIRECT" | "INDIRECT" | "NONE" {
    if (distanceMeters <= 250) return "DIRECT";
    if (distanceMeters <= 500) return "INDIRECT";
    return "NONE";
  }

  /**
   * Normaliza y procesa un listado de feeds OSINT en bruto, aplicando filtros espaciales.
   */
  public static analyze(
    rawFeeds: RawOsintInput[],
    projectLat: number,
    projectLng: number
  ): OsintGangEvidence[] {
    const analyzedEvents: OsintGangEvidence[] = [];

    for (const feed of rawFeeds) {
      const distance = this.calculateHaversineDistance(
        projectLat,
        projectLng,
        feed.lat,
        feed.lng
      );

      // Extraer posible nombre de grupo mencionado de forma pasiva en el texto
      let detectedGroup = "No determinado";
      const match = feed.text.match(/(?:pandilla|grupo|banda|gang)\s+([A-Za-z0-9ÁÉÍÓÚáéíóúñ\s]{3,20})/i);
      if (match && match[1]) {
        detectedGroup = match[1].trim();
      }

      analyzedEvents.push({
        eventId: feed.id,
        sourceUrl: feed.sourceUrl,
        detectedGroup,
        eventType: this.classifyEventType(feed.rawType),
        coordinates: { lat: feed.lat, lng: feed.lng },
        distanceMeters: parseFloat(distance.toFixed(1)),
        validatedAt: feed.date || new Date().toISOString()
      });
    }

    return analyzedEvents;
  }
}
