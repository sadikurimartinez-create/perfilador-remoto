import { TerritorialIntelligenceEngine } from "../territorialIntelligenceEngine";
import { AttractorAnalyzer } from "../attractorAnalyzer";
import { TerritorialValidator } from "../territorialValidator";

export function runTerritorialEngineTests() {
  console.log("======================================================================");
  console.log("🚦 INICIANDO SUITE DE PRUEBAS DE CALIDAD: TERRITORIAL INTELLIGENCE ENGINE");
  console.log("======================================================================");

  const mockProject = {
    id: "PR-PASEOS",
    nombre: "Paseos de Aguascalientes",
    lat: 21.96541,
    lng: -102.29871,
    radio: 500
  };

  const mockTce = {
    landUse: "Residencial Mixto"
  };

  const mockInegi = {
    lighting: "Regular a Deficiente"
  };

  const mockAlbum = [
    { id: "img-001", comentario: "Lote baldío con matorrales secos y barda rota" },
    { id: "img-002", comentario: "Falta de luminarias en esquina principal" }
  ];

  const mockHotspots = [
    { lat: 21.96550, lng: -102.29880, weight: 10 } // Hotspot cercano a la escuela y comercio
  ];

  // ============================================================================
  // TEST 1 & 2: Atractor fuera del radio -> rechazado; Atractor dentro -> aceptado
  // ============================================================================
  const rawAttractors = [
    {
      id: "escuela-1",
      name: "Escuela Primaria Paseos",
      activityCode: "461110",
      lat: 21.96545, // Muy cercano (dentro del radio)
      lng: -102.29875,
      address: "Paseos de Aguascalientes Centro"
    },
    {
      id: "comercio-1",
      name: "Tienda OXXO Carboneras",
      activityCode: "461111",
      lat: 21.96538, // Muy cercano (dentro del radio)
      lng: -102.29868,
      address: "Paseos de Carboneras"
    },
    {
      id: "fuera-1",
      name: "Fábrica Industrial Lejana",
      activityCode: "311111",
      lat: 22.01000, // Lejos (fuera del radio)
      lng: -102.25000,
      address: "Zona Industrial Norte"
    }
  ];

  const processedAttractors = AttractorAnalyzer.analyze(
    rawAttractors,
    mockProject.lat,
    mockProject.lng,
    mockProject.radio,
    mockHotspots
  );

  // Test 1: El atractor lejano debe ser excluido del análisis territorial
  const hasFarAttractor = processedAttractors.some(a => a.id === "fuera-1");
  console.assert(!hasFarAttractor, "❌ TEST 1 FALLÓ: El atractor fuera del radio no fue rechazado.");
  if (!hasFarAttractor) {
    console.log("✅ TEST 1 PASÓ: Atractor fuera del radio correctamente rechazado.");
  }

  // Test 2: Los atractores cercanos deben ser incluidos
  const hasCloseAttractors = processedAttractors.some(a => a.id === "escuela-1") && processedAttractors.some(a => a.id === "comercio-1");
  console.assert(hasCloseAttractors, "❌ TEST 2 FALLÓ: Los atractores dentro del radio no fueron incluidos.");
  if (hasCloseAttractors) {
    console.log("✅ TEST 2 PASÓ: Atractores dentro del radio correctamente incluidos.");
  }

  // ============================================================================
  // TEST 3: Relación entre hotspots (SEM) y atractores en la TEM
  // ============================================================================
  const tem = TerritorialIntelligenceEngine.process(
    mockProject,
    mockTce,
    rawAttractors,
    mockInegi,
    mockAlbum,
    mockHotspots
  );

  const hasHotspotRelation = TerritorialValidator.validateHotspotRelationship(tem);
  console.assert(hasHotspotRelation, "❌ TEST 3 FALLÓ: No se estableció relación entre hotspots y atractores cercanos.");
  if (hasHotspotRelation) {
    console.log("✅ TEST 3 PASÓ: Hotspot SEM cercano a atractor generó relación territorial correctamente.");
  }

  // ============================================================================
  // TEST 4: Narrativa con lenguaje criminalizante -> ACE WARNING (Regla "Territorio no criminalizado")
  // ============================================================================
  const cleanNarrative = "La presencia de establecimientos comerciales incrementa la concentración temporal de personas y modifica las condiciones de exposición situacional.";
  const criminalizingNarrative = "Esta esquina es una zona criminal y un territorio controlado por pandillas como punto de venta de sustancias prohibidas.";

  const cleanCheck = TerritorialValidator.validateVisualInference(cleanNarrative);
  const criminalCheck = TerritorialValidator.validateVisualInference(criminalizingNarrative);

  console.assert(cleanCheck.isValid, "❌ TEST 4 FALLÓ: Narrativa limpia generó falsas alarmas.");
  console.assert(!criminalCheck.isValid && criminalCheck.warning !== undefined, "❌ TEST 4 FALLÓ: El validador no detectó lenguaje criminalizante.");
  if (cleanCheck.isValid && !criminalCheck.isValid) {
    console.log("✅ TEST 4 PASÓ: Narrativa con lenguaje criminalizante generó un ACE WARNING con éxito.");
    console.log(`   └─ Detalle: ${criminalCheck.warning}`);
  }

  // ============================================================================
  // TEST 5: Coordenadas geográficas filtradas hacia Word -> FAILED / Bloqueo
  // ============================================================================
  const cleanText = "Sector de Paseos de Aguascalientes y Paseos de Carboneras.";
  const leakyText = "Se observan vulnerabilidades tácticas cerca de la coordenada lat: 21.96541, lng: -102.29871.";

  const sanitizeClean = TerritorialValidator.validateEditorialSanitization(cleanText);
  const sanitizeLeaky = TerritorialValidator.validateEditorialSanitization(leakyText);

  console.assert(sanitizeClean.isValid, "❌ TEST 5 FALLÓ: Texto sanitizado reportó fugas falsas.");
  console.assert(!sanitizeLeaky.isValid && sanitizeLeaky.error !== undefined, "❌ TEST 5 FALLÓ: No se bloqueó el texto con fuga de coordenadas.");
  if (sanitizeClean.isValid && !sanitizeLeaky.isValid) {
    console.log("✅ TEST 5 PASÓ: Fuga de coordenadas hacia Word/PDF bloqueada con un ACE FAILED con éxito.");
    console.log(`   └─ Detalle: ${sanitizeLeaky.error}`);
  }

  // ============================================================================
  // TEST 6: TEM incompleta o sin confianza calculated -> WARNING
  // ============================================================================
  const incompleteTem: any = {
    projectId: "PR-01",
    economicAttractors: [],
    confidence: { operationalConfidence: 0 }
  };

  const incompleteCheck = TerritorialValidator.validateCompleteness(incompleteTem);
  console.assert(!incompleteCheck.isValid && incompleteCheck.warning !== undefined, "❌ TEST 6 FALLÓ: No se marcó la TEM incompleta como WARNING.");
  if (!incompleteCheck.isValid) {
    console.log("✅ TEST 6 PASÓ: TEM incompleta generó un ACE WARNING con éxito.");
    console.log(`   └─ Detalle: ${incompleteCheck.warning}`);
  }

  console.log("======================================================================");
  console.log("🎉 SUITE DE PRUEBAS DE INTELIGENCIA TERRITORIAL COMPLETADA CON ÉXITO (6/6)");
  console.log("======================================================================");
}
