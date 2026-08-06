import { EvidenceConfidenceLevel, ConfidenceFactors } from "@/context/ProjectContext";

export interface GovernanceAssessment {
  confidenceLevel: EvidenceConfidenceLevel;
  confidencePercentage: number;
  confidenceFactors: ConfidenceFactors;
  justification: string;
}

/**
 * SSPE-CEIPOL - STREET VIEW GOVERNANCE EVALUATOR v2.1
 * Evalúa la confiabilidad de la evidencia de gabinete en función de la antigüedad de la toma,
 * precisión de la fuente y validación analítica.
 */
export function evaluateStreetViewGovernance(
  captureDate?: string,
  gpsAccuracyMeters: number = 5
): GovernanceAssessment {
  const currentYear = new Date().getFullYear();
  let captureYear = currentYear;

  if (captureDate) {
    // Formatos típicos de Google Street View: "2024-05" o "2023"
    const yearMatch = captureDate.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      captureYear = parseInt(yearMatch[1], 10);
    }
  }

  const ageYears = currentYear - captureYear;

  // Factores de ponderación
  let imageryAgeScore = 100;
  if (ageYears <= 2) {
    imageryAgeScore = 100;
  } else if (ageYears <= 5) {
    imageryAgeScore = 75;
  } else {
    imageryAgeScore = 50;
  }

  if (!captureDate) {
    imageryAgeScore = 50; // Sin fecha comprobable se penaliza a basal
  }

  const geographicPrecision = gpsAccuracyMeters <= 10 ? 100 : 80;
  const sourceReliability = 95; // Google Maps Street View API
  const analystValidation = 100; // Confirmado manualmente por el analista en el visor 360°

  // Promedio ponderado (40% antigüedad, 30% precisión geo, 15% fuente, 15% analista)
  const weightedScore = Math.round(
    imageryAgeScore * 0.4 +
    geographicPrecision * 0.3 +
    sourceReliability * 0.15 +
    analystValidation * 0.15
  );

  let confidenceLevel: EvidenceConfidenceLevel = "HIGH";
  let confidencePercentage = 100;
  let justification = "";

  if (weightedScore >= 85) {
    confidenceLevel = "HIGH";
    confidencePercentage = 100;
    justification = `Cobertura reciente de fuente oficial (${captureDate || "Actual"}), alta precisión geográfica y validación de gabinete.`;
  } else if (weightedScore >= 65) {
    confidenceLevel = "MEDIUM";
    confidencePercentage = 75;
    justification = `Cobertura intermedia (${captureDate || "2-5 años"}). Se registra posible variación por modificaciones urbanas recientes.`;
  } else {
    confidenceLevel = "LOW";
    confidencePercentage = 50;
    justification = `Cobertura desactualizada (>5 años o sin fecha). Requiere verificación prioritaria in situ.`;
  }

  return {
    confidenceLevel,
    confidencePercentage,
    confidenceFactors: {
      imageryAgeScore,
      geographicPrecision,
      sourceReliability,
      analystValidation,
    },
    justification,
  };
}

export default evaluateStreetViewGovernance;
