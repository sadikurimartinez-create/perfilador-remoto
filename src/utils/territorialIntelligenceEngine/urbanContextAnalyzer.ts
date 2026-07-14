import { UrbanStructure } from "./models/territorialEvidenceTypes";

export class UrbanContextAnalyzer {
  public static analyze(
    projectData: any,
    tceData: any
  ): UrbanStructure {
    // 1. Determinar el uso de suelo dominante a partir del TCE o projectData
    let landUse = "Residencial";
    if (tceData?.landUse) {
      landUse = tceData.landUse;
    } else if (projectData?.areaGeografica?.toLowerCase().includes("centro") || projectData?.areaGeografica?.toLowerCase().includes("comercial")) {
      landUse = "Mixto (Comercial / Residencial)";
    } else if (projectData?.areaGeografica?.toLowerCase().includes("industrial") || projectData?.areaGeografica?.toLowerCase().includes("parque industrial")) {
      landUse = "Industrial";
    }

    // 2. Clasificar la cuadrícula de calles (trama urbana)
    let streetGridType: "GRID" | "ORGANIC" | "LINEAR" | "CUL_DE_SAC" = "GRID";
    const geoLower = (projectData?.areaGeografica || "").toLowerCase();
    if (geoLower.includes("lomas") || geoLower.includes("cerro") || geoLower.includes("paseos")) {
      streetGridType = "ORGANIC";
    } else if (geoLower.includes("fraccionamiento") || geoLower.includes("coto") || geoLower.includes("cerrada")) {
      streetGridType = "CUL_DE_SAC";
    } else if (geoLower.includes("avenida") || geoLower.includes("bulevar")) {
      streetGridType = "LINEAR";
    }

    // 3. Evaluar la permeabilidad física y la vulnerabilidad de las vialidades
    let vesselVulnerability: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    let permeabilityScore = 65; // Valor medio estándar por defecto

    if (streetGridType === "ORGANIC") {
      vesselVulnerability = "HIGH"; // Tramas orgánicas con curvas dificultan persecuciones cerradas o visibilidad directa
      permeabilityScore = 45; // Menor permeabilidad por calles intrincadas
    } else if (streetGridType === "CUL_DE_SAC") {
      vesselVulnerability = "LOW"; // Calles cerradas autolimitan flujos rápidos
      permeabilityScore = 30; // Muy baja permeabilidad
    } else if (streetGridType === "LINEAR") {
      vesselVulnerability = "HIGH"; // Corredores lineales facilitan escape rápido y alta exposición vial
      permeabilityScore = 85; // Alta permeabilidad
    } else {
      // GRID standard
      vesselVulnerability = "MEDIUM";
      permeabilityScore = 70;
    }

    return {
      landUse,
      streetGridType,
      vesselVulnerability,
      permeabilityScore
    };
  }
}
