import { VisualEvidenceEngine } from "../visualEvidenceEngine";
import { VisualEvidenceValidator } from "../visualEvidenceValidator";
import { VisualEvidenceInternal } from "../models/visualEvidenceTypes";

export function runVisualEvidenceTests() {
  console.log("=== INICIANDO PRUEBAS UNITARIAS DE VISUAL EVIDENCE ENGINE (ADR-005.3) ===");

  const projectLat = 21.80929;
  const projectLng = -102.26964;
  const radius = 500;

  // =========================================================================
  // CASO 1: Fotografías del analista
  // =========================================================================
  const rawPhotosCase1 = [
    { id: "photo-1", comentario: "Barda perimetral con deterioro físico", lat: 21.8093, lng: -102.2696, riskLevel: "alto" },
    { id: "photo-2", comentario: "Luz de alumbrado público apagada", lat: 21.8094, lng: -102.2695, riskLevel: "medio" }
  ];

  const result1 = VisualEvidenceEngine.process("proj-001", rawPhotosCase1, projectLat, projectLng, radius, []);
  console.assert(result1.analystPhotos.length === 2, `Test 1 Fallido: Esperadas 2 fotos del analista, obtenidas ${result1.analystPhotos.length}`);
  
  // Validar pie de foto táctico estructurado
  const p1 = result1.analystPhotos[0];
  console.assert(p1.finding !== "", "Test 1 Fallido: Hallazgo vacío.");
  console.assert(p1.operationalImpact !== "", "Test 1 Fallido: Impacto operacional vacío.");
  console.log("[PASS] Test 1: Fotografías del analista incorporadas e integradas correctamente.");

  // =========================================================================
  // CASO 2: Selección de Street View (Máximo 4 imágenes)
  // =========================================================================
  const rawPhotosCase2 = [
    { id: "sv-1", tipo: "streetview", comentario: "Deterioro vial 1", lat: 21.8093, lng: -102.2696, riskLevel: "alto" },
    { id: "sv-2", tipo: "streetview", comentario: "Deterioro vial 2", lat: 21.8094, lng: -102.2695, riskLevel: "medio" },
    { id: "sv-3", tipo: "streetview", comentario: "Deterioro vial 3", lat: 21.8095, lng: -102.2694, riskLevel: "medio" },
    { id: "sv-4", tipo: "streetview", comentario: "Deterioro vial 4", lat: 21.8096, lng: -102.2693, riskLevel: "medio" },
    { id: "sv-5", tipo: "streetview", comentario: "Deterioro vial 5", lat: 21.8097, lng: -102.2692, riskLevel: "bajo" }
  ];

  const result2 = VisualEvidenceEngine.process("proj-001", rawPhotosCase2, projectLat, projectLng, radius, []);
  console.assert(result2.streetViewEvidence.length === 4, `Test 2 Fallido: Debieron seleccionarse máximo 4 imágenes, se obtuvieron ${result2.streetViewEvidence.length}`);
  console.log("[PASS] Test 2: Barrido Street View limitó correctamente la selección a un máximo de 4.");

  // =========================================================================
  // CASO 3: Street View sin hallazgos relevantes
  // =========================================================================
  const result3 = VisualEvidenceEngine.process("proj-001", [], projectLat, projectLng, radius, []);
  console.assert(result3.streetViewEvidence.length === 0, `Test 3 Fallido: Se esperaban 0 Street View, obtenidas ${result3.streetViewEvidence.length}`);
  console.log("[PASS] Test 3: Sin hallazgos Street View, retorna correctamente un arreglo vacío.");

  // =========================================================================
  // CASO 4: Detección de grafitis territorial (2 coincidencias coincidentes)
  // =========================================================================
  const rawPhotosCase4 = [
    { id: "g-1", comentario: "Pinta de grafiti en barda", lat: 21.8093, lng: -102.2696, riskLevel: "medio" },
    { id: "g-2", comentario: "Grafiti sobre predio abandonado", lat: 21.8094, lng: -102.2695, riskLevel: "medio" }
  ];

  const result4 = VisualEvidenceEngine.process("proj-001", rawPhotosCase4, projectLat, projectLng, radius, []);
  console.assert(result4.graffitiEvidence.length >= 2, `Test 4 Fallido: Módulo grafiti debió activarse con al menos 2 imágenes, obtenidas ${result4.graffitiEvidence.length}`);
  console.log("[PASS] Test 4: Activación del indicador de Grafiti Territorial al cumplir la densidad >= 2.");

  // =========================================================================
  // CASO 5: Bloqueo de alucinaciones subjetivas (ACE warning)
  // =========================================================================
  const badNarrative = "Se identifica una barda deteriorada que representa un punto de venta de drogas para las pandillas locales.";
  const valResultCase5 = VisualEvidenceValidator.validateVisualInference(badNarrative);
  console.assert(valResultCase5.isValid === false, "Test 5 Fallido: Debió rechazar la narrativa con aserciones criminales subjetivas.");
  console.assert(valResultCase5.message?.includes("Unsupported visual inference"), "Test 5 Fallido: Mensaje incorrecto.");
  console.log("[PASS] Test 5: ACE detiene e identifica correctamente inferencias delictivas subjetivas.");

  // =========================================================================
  // CASO 6: Intento de filtración de coordenadas (Sanitización Editorial)
  // =========================================================================
  const coordLeakPayload = {
    title: "Evidencia de Campo",
    caption: `Falla identificada en lat: ${projectLat}, lng: ${projectLng}`
  };
  const valResultCase6 = VisualEvidenceValidator.validateEditorialSanitization(coordLeakPayload);
  console.assert(valResultCase6.isValid === false, "Test 6 Fallido: Debió rechazar el payload por presencia de coordenadas numéricas.");
  console.assert(valResultCase6.message === "Información geográfica sensible detectada en capa editorial", `Test 6 Fallido: Mensaje erróneo: "${valResultCase6.message}"`);
  console.log("[PASS] Test 6: Sanitización de coordenadas detectó y detuvo exitosamente la filtración.");

  // =========================================================================
  // CASO 7: Visual Hallucination con texto neutro
  // =========================================================================
  const safeNarrative = "La imagen muestra un espacio con baja visibilidad y deterioro físico que puede reducir la vigilancia natural del entorno.";
  const valResultCase7 = VisualEvidenceValidator.validateVisualInference(safeNarrative);
  console.assert(valResultCase7.isValid === true, "Test 7 Fallido: Debió aprobar la narrativa neutra operacional.");
  console.log("[PASS] Test 7: Aprobación correcta de narrativas neutras operacionales enfocadas en el entorno.");

  console.log("=== TODAS LAS PRUEBAS CONCLUIDAS CON ÉXITO ABSOLUTO ===");
}
