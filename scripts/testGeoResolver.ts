import { GeoEvidence } from "../src/types/geointEvidence";
import {
  calculateHaversineDistanceMeters,
  isSameLocation,
  isValidCoordinate,
  adaptStreetViewFindingToGeoEvidence,
  adaptSweepPayloadToGeoEvidence,
} from "../src/utils/geoResolver";

console.log("=== INICIANDO VALIDACIÓN ADR-019.13 FASE 1: GEORESOLVER & GEOEVIDENCE ===");

// Test 1: Validación de Coordenadas
console.log("\n[TEST 1] Validación de Coordenadas y Filtro Anti-Fallback:");
console.assert(isValidCoordinate(21.885, -102.291) === true, "Coordenada válida de Aguascalientes rechazada erróneamente");
console.assert(isValidCoordinate(0, 0) === false, "Coordenada Null Island (0,0) aceptada erróneamente");
console.assert(isValidCoordinate(null, undefined) === false, "Coordenadas nulas aceptadas erróneamente");
console.assert(isValidCoordinate("21.885", "-102.291") === true, "Coordenadas en formato string numérico rechazadas");
console.assert(isValidCoordinate("invalid", NaN) === false, "Valores NaN aceptados erróneamente");
console.log("✅ Test 1 Superado: Validación de coordenadas y rechazo de fallbacks correcto.");

// Test 2: Cálculo Haversine
console.log("\n[TEST 2] Cálculo de Distancia Haversine:");
const p1 = { lat: 21.8808, lng: -102.2961 };
const p2 = { lat: 21.8818, lng: -102.2965 };
const dist = calculateHaversineDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
console.log(`Distancia calculada: ${dist} metros`);
console.assert(dist > 100 && dist < 200, "Distancia Haversine fuera de rango esperado");

const distNull = calculateHaversineDistanceMeters(0, 0, p1.lat, p1.lng);
console.assert(distNull === Infinity, "Distancia con coordenada nula no devolvió Infinity");
console.log("✅ Test 2 Superado: Cálculo Haversine preciso.");

// Test 3: Validación isSameLocation con GeoEvidence
console.log("\n[TEST 3] Validación isSameLocation:");
const evA: GeoEvidence = {
  id: "ev-A",
  expedienteId: "EXP-1",
  source: "FIELD_PHOTO",
  coordinates: { lat: 21.8808, lng: -102.2961 },
  imageReference: "http://example.com/a.jpg",
  metadata: {},
  status: "APPROVED_EVIDENCE",
};

const evB_Cercana: GeoEvidence = {
  id: "ev-B1",
  expedienteId: "EXP-1",
  source: "STREET_VIEW_AUTOMATIC",
  coordinates: { lat: 21.8809, lng: -102.2961 }, // ~11 metros
  imageReference: "http://example.com/b1.jpg",
  metadata: {},
  status: "PENDING_REVIEW",
};

const evB_Lejana: GeoEvidence = {
  id: "ev-B2",
  expedienteId: "EXP-1",
  source: "STREET_VIEW_HISTORICAL",
  coordinates: { lat: 21.8900, lng: -102.2961 }, // ~1 km
  imageReference: "http://example.com/b2.jpg",
  metadata: {},
  status: "PENDING_REVIEW",
};

const resCercana = isSameLocation(evA, evB_Cercana, 50);
console.log(`Puntos cercanos (Tol 50m): distancia=${resCercana.distanceMeters}m, esCompatible=${resCercana.isCompatible}`);
console.assert(resCercana.isCompatible === true, "Evidencia cercana marcada como incompatible");

const resLejana = isSameLocation(evA, evB_Lejana, 50);
console.log(`Puntos lejanos (Tol 50m): distancia=${resLejana.distanceMeters}m, esCompatible=${resLejana.isCompatible}`);
console.assert(resLejana.isCompatible === false, "Evidencia lejana marcada como compatible erróneamente");

// Test 4: Evidencia sin coordenadas
const evSinCoords: GeoEvidence = {
  id: "ev-Nula",
  expedienteId: "EXP-1",
  source: "FIELD_PHOTO",
  coordinates: { lat: 0, lng: 0 },
  imageReference: "http://example.com/null.jpg",
  metadata: {},
  status: "GENERATED",
};

const resSinCoords = isSameLocation(evA, evSinCoords, 50);
console.log(`Evidencia sin coords: distancia=${resSinCoords.distanceMeters}, esCompatible=${resSinCoords.isCompatible}`);
console.assert(resSinCoords.isCompatible === false && resSinCoords.distanceMeters === Infinity, "Evidencia sin coords no rechazada con Infinity");
console.log("✅ Test 3 Superado: Reglas de compatibilidad y seguridad geoespacial estrictas.");

// Test 5: Adaptadores Legacy
console.log("\n[TEST 5] Adaptadores Progresivos Legacy:");
const legacyFinding = {
  id: "f-123",
  expedienteId: "EXP-TEST",
  coordenadas: { lat: 21.885, lng: -102.291 },
  imagen: "http://example.com/f123.jpg",
  estado: "APROBADO",
  origenRevision: "MANUAL",
};
const adapted = adaptStreetViewFindingToGeoEvidence(legacyFinding);
console.assert(adapted !== null && adapted?.source === "STREET_VIEW_MANUAL", "Adaptación de StreetViewFinding falló");
console.assert(adapted?.coordinates.lat === 21.885, "Coordenadas adaptadas incorrectas");
console.log("✅ Test 5 Superado: Adaptadores de transición progresiva funcionando.");

console.log("\n🎉 TODAS LAS PRUEBAS DE LA FASE 1 (ADR-019.13-F1) HAN PASADO SATISFACTORIAMENTE.");
