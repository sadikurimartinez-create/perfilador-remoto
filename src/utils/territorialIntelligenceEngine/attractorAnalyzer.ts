import { EconomicAttractor } from "./models/territorialEvidenceTypes";

export class AttractorAnalyzer {
  private static getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  public static analyze(
    rawAttractors: any[],
    centerLat: number,
    centerLng: number,
    radiusMeters: number,
    hotspots: { lat: number; lng: number; weight?: number }[]
  ): EconomicAttractor[] {
    const validatedAttractors: EconomicAttractor[] = [];

    rawAttractors.forEach((item, idx) => {
      const itemLat = item.lat || item.latitude || 0;
      const itemLng = item.lng || item.longitude || 0;

      // 1. Filtrado de radio métrico riguroso (Test 1 y Test 2)
      const distToCenter = this.getDistanceMeters(centerLat, centerLng, itemLat, itemLng);
      if (distToCenter > radiusMeters) {
        // Rechazado por estar fuera del polígono/radio de análisis
        return;
      }

      // 2. Medir distancia al hotspot de la SEM más cercano
      let minDistanceToHotspot = 999999;
      if (hotspots && hotspots.length > 0) {
        hotspots.forEach(hs => {
          const dist = this.getDistanceMeters(itemLat, itemLng, hs.lat, hs.lng);
          if (dist < minDistanceToHotspot) {
            minDistanceToHotspot = dist;
          }
        });
      } else {
        minDistanceToHotspot = distToCenter; // fallback si no hay hotspots calculados
      }

      // 3. Determinar nivel de influencia situacional y rol criminológico no criminalizante
      const category = this.mapCategory(item.activityCode || item.giro || item.activity || "");
      const situationalInfluenceLevel = minDistanceToHotspot <= 80 ? "HIGH" : minDistanceToHotspot <= 200 ? "MEDIUM" : "LOW";
      
      const role = this.generateCriminologicalRole(category, item.name || "Establecimiento");

      validatedAttractors.push({
        id: item.id || `ATT-${(idx + 1).toString().padStart(3, "0")}`,
        name: item.name || "Establecimiento Comercial",
        activityCode: item.activityCode || "000000",
        category,
        address: item.address || item.direccion || "Domicilio no especificado",
        lat: itemLat,
        lng: itemLng,
        distanceToHotspotMeters: parseFloat(minDistanceToHotspot.toFixed(1)),
        situationalInfluenceLevel,
        criminologicalRole: role
      });
    });

    return validatedAttractors;
  }

  private static mapCategory(code: string): "COMERCIO" | "ESCUELA" | "SERVICIO" | "PARQUE" | "TRANSPORTE" | "PUNTO_REUNION" {
    const codeStr = String(code).toLowerCase();
    if (codeStr.includes("escuela") || codeStr.includes("primaria") || codeStr.includes("secundaria") || codeStr.includes("colegio") || codeStr.includes("461")) {
      return "ESCUELA";
    }
    if (codeStr.includes("parque") || codeStr.includes("plaza") || codeStr.includes("jardin") || codeStr.includes("deportivo") || codeStr.includes("recreacion")) {
      return "PARQUE";
    }
    if (codeStr.includes("parada") || codeStr.includes("transporte") || codeStr.includes("terminal") || codeStr.includes("camion") || codeStr.includes("estacion")) {
      return "TRANSPORTE";
    }
    if (codeStr.includes("bar") || codeStr.includes("cantina") || codeStr.includes("reunion") || codeStr.includes("club") || codeStr.includes("centro social")) {
      return "PUNTO_REUNION";
    }
    if (codeStr.includes("oxxo") || codeStr.includes("tienda") || codeStr.includes("comercial") || codeStr.includes("comercio") || codeStr.includes("super") || codeStr.includes("mercado")) {
      return "COMERCIO";
    }
    return "SERVICIO"; // Default fallback
  }

  private static generateCriminologicalRole(category: string, name: string): string {
    switch (category) {
      case "ESCUELA":
        return `Generador de alta concentración de flujos peatonales flotantes en horarios de entrada y salida, modificando temporalmente la densidad de personas expuestas en la vía pública.`;
      case "PARQUE":
        return `Espacio de recreación que propicia la permanencia prolongada de transeúntes. Requiere un control físico adecuado para preservar las condiciones de vigilancia natural.`;
      case "TRANSPORTE":
        return `Nodo de alta movilidad que concentra personas en tiempos de espera fijos, facilitando la afluencia continua y sirviendo como punto de transición en el territorio.`;
      case "PUNTO_REUNION":
        return `Punto de coincidencia social que incrementa la actividad peatonal en horarios nocturnos y de fin de semana, incidiendo sobre las condiciones de supervisión del entorno.`;
      case "COMERCIO":
        return `Establecimiento de atracción comercial que dinamiza el flujo diario de personas y vehículos, extendiendo las horas de actividad y modificando la dinámica de exposición situacional.`;
      default:
        return `Unidad de servicios generales que actúa como atractor secundario de traslados locales, aportando estabilidad y movimiento regulado al flujo social ordinario.`;
    }
  }
}
