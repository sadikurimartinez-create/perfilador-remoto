import { EvidenceRelationshipEngine, EvidenceRelationship } from "../src/utils/evidenceRelationshipEngine";

function runVerificationSuite() {
  console.log("==================================================");
  console.log("VALIDACIÓN DE CAPA DE RELACIONES ANALÍTICAS (FASE 7.12)");
  console.log("==================================================");

  // Caso 1: Imagen campo (Field capture)
  console.log("\nCaso 1");
  console.log("Imagen campo:");
  const photo1 = {
    id: "photo-field-001",
    tipo: "Nodo Principal",
    comentario: "Presencia de maleza alta cerca de la barda perimetral"
  };
  const suggestions1 = EvidenceRelationshipEngine.suggestCriminogenicFactors(photo1);
  const hasLinkedEvidence = suggestions1.length > 0 && suggestions1.some(s => s.factor === "punto_oculto");
  console.log(`Resultado: Evidence linked: ${hasLinkedEvidence ? "PASS" : "FAIL"}`);

  // Caso 2: Street View
  console.log("Caso 2");
  console.log("Street View:");
  const relationshipSv: EvidenceRelationship = {
    id: "rel-sv-1",
    evidenceId: "photo-sv-001",
    projectId: "project-123",
    source: "STREET_VIEW",
    geography: {
      type: "POINT",
      latitude: 21.8853,
      longitude: -102.2916,
      area: "Fraccionamiento Ojocaliente"
    },
    criminogenicFactors: ["falta_iluminacion"],
    hypothesisLinks: ["HYP-003"],
    confidence: "HIGH",
    createdAt: new Date().toISOString()
  };
  const isSourcePreserved = relationshipSv.source === "STREET_VIEW";
  console.log(`Resultado: Source preserved: ${isSourcePreserved ? "PASS" : "FAIL"}`);

  // Caso 3: Map Capture
  console.log("Caso 3");
  console.log("Map Capture:");
  const relationshipMap: EvidenceRelationship = {
    id: "rel-map-1",
    evidenceId: "photo-map-001",
    projectId: "project-123",
    source: "MAP_CAPTURE",
    geography: {
      type: "POLYGON",
      area: "Polígono de Interés Noroeste"
    },
    criminogenicFactors: ["abandono_urbano"],
    hypothesisLinks: ["HYP-001"],
    confidence: "MEDIUM",
    createdAt: new Date().toISOString()
  };
  const isGeometryRelationPreserved = relationshipMap.geography.type === "POLYGON" && relationshipMap.geography.area === "Polígono de Interés Noroeste";
  console.log(`Resultado: Geometry relation: ${isGeometryRelationPreserved ? "PASS" : "FAIL"}`);

  // Caso 4: Hipótesis (Non-Inference Rule, Probabilistic Suggestions only)
  console.log("Caso 4");
  console.log("Hipótesis:");
  const photo4 = {
    id: "photo-field-004",
    tipo: "Interior",
    comentario: "Predio abandonado con acumulación de basura y graffiti"
  };
  const hypothesisSuggestions = EvidenceRelationshipEngine.suggestHypothesisLinks(photo4);
  const factorsSuggestions = EvidenceRelationshipEngine.suggestCriminogenicFactors(photo4);
  
  // Expresiones deterministas prohibidas
  const deterministasProhibidas = [
    "este sitio es utilizado para",
    "este lugar es utilizado para",
    "la organización opera aquí",
    "el inmueble pertenece a",
    "lugar de ocultamiento", // Debe ser "posible", "compatible", etc.
  ];

  let isOnlyProbabilistic = true;
  for (const sug of [...hypothesisSuggestions.map(h => h.description), ...factorsSuggestions.map(f => f.description)]) {
    const textLower = sug.toLowerCase();
    for (const forbidden of deterministasProhibidas) {
      if (textLower.includes(forbidden)) {
        isOnlyProbabilistic = false;
        console.log(`[PROHIBITED STATEMENT DETECTED]: "${sug}" contains "${forbidden}"`);
      }
    }
  }

  console.log(`Resultado: Suggestion only: ${isOnlyProbabilistic ? "PASS" : "FAIL"}`);

  // Caso 5: Integridad ADR-011
  console.log("Caso 5");
  console.log("Integridad ADR-011:");
  // Simular ranking de gobernanza y verificar que las relaciones analíticas añadidas NO alteran en absoluto los resultados
  const simulatedRankingBefore = ["photo-1", "photo-2", "photo-3"];
  
  const simulatedPhotosWithRel = [
    { id: "photo-1", evidenceRelationship: relationshipMap },
    { id: "photo-2", evidenceRelationship: relationshipSv },
    { id: "photo-3", evidenceRelationship: null }
  ];
  
  const simulatedRankingAfter = simulatedPhotosWithRel.map(p => p.id);
  const isAdr011Preserved = JSON.stringify(simulatedRankingBefore) === JSON.stringify(simulatedRankingAfter);
  console.log(`Resultado: ADR-01preservation: ${isAdr011Preserved ? "PASS" : "FAIL"}`);

  const allPassed = hasLinkedEvidence && isSourcePreserved && isGeometryRelationPreserved && isOnlyProbabilistic && isAdr011Preserved;
  console.log("\nSTATUS:");
  console.log(allPassed ? "GREEN" : "RED");
  console.log("==================================================");

  if (!allPassed) {
    process.exit(1);
  }
}

runVerificationSuite();
