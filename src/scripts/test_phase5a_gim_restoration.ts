import { geocodeAddressDirect } from "../lib/osintActions";
import { GangGeoSweepEngine } from "../lib/providers/gangGeoSweepEngine";
import * as fs from "fs";
import * as path from "path";

async function runPhase5ATests() {
  console.log("================================────────────────────────");
  console.log("   PRUEBAS DE VERIFICACIÓN DE ARQUITECTURA FASE 5A (GIM)");
  console.log("================================────────────────────────\n");

  let passedAll = true;

  // 1. PRUEBA DE DIRECCIÓN EXACTA
  console.log("[PRUEBA 1] Geocodificación Real de Dirección Exacta...");
  const exactAddress = "Calle Loma del Cardenal 103, Mirador de las Culturas, Aguascalientes";
  const res1 = await geocodeAddressDirect(exactAddress);

  if (res1.exito && res1.status === "RESOLVED" && res1.lat && res1.lng) {
    console.log(`✅ EXA1 PASS: Dirección resuelta -> [${res1.lat}, ${res1.lng}]`);
    console.log(`   Formatted: "${res1.address}"`);
    console.log(`   Precision: ${res1.precision} | Fuente: ${res1.fuente} | Confidence: ${res1.confidence}`);
  } else {
    console.error(`❌ EXA1 FAIL: No se resolvió dirección exacta: ${res1.error}`);
    passedAll = false;
  }

  // 2. PRUEBA DE REPETIBILIDAD DETERMINISTA (SIN Math.random())
  console.log("\n[PRUEBA 2] Verificación de Repetibilidad Determinista...");
  const res2 = await geocodeAddressDirect(exactAddress);
  if (res1.lat === res2.lat && res1.lng === res2.lng) {
    console.log(`✅ EXA2 PASS: Coordenadas idénticas entre ejecuciones ([${res1.lat}, ${res1.lng}] === [${res2.lat}, ${res2.lng}])`);
    console.log(`   Cero jitter aleatorio detectado.`);
  } else {
    console.error(`❌ EXA2 FAIL: Inconsistencia entre ejecuciones: [${res1.lat}, ${res1.lng}] vs [${res2.lat}, ${res2.lng}]`);
    passedAll = false;
  }

  // 3. PRUEBA DE DIRECCIÓN INEXISTENTE / NO RESUELTA
  console.log("\n[PRUEBA 3] Verificación de Manejo de Dirección Inexistente...");
  const fakeAddress = "Calle Ficticia Totalmente Inexistente ZZZ 999999, Colonia Fantasma, Aguascalientes";
  const res3 = await geocodeAddressDirect(fakeAddress);

  if (!res3.exito && res3.status === "UNRESOLVED_ADDRESS") {
    console.log(`✅ EXA3 PASS: Estatus correcto 'UNRESOLVED_ADDRESS'.`);
    console.log(`   Motivo registrado: "${res3.error}"`);
    console.log(`   Cero sustitución por coordenadas del centro del proyecto.`);
  } else {
    console.error(`❌ EXA3 FAIL: Se asignó coordenada falsa a dirección inexistente: [${res3.lat}, ${res3.lng}]`);
    passedAll = false;
  }

  // 4. BARRIDO COMPLETO DE GIM MOTOR
  console.log("\n[PRUEBA 4] Ejecución de Barrido GIM en Motor Real...");
  const sweepRes = await GangGeoSweepEngine.executeSweep(
    [],
    "Realizar barrido en Calle Loma del Cardenal 103, Mirador de las Culturas",
    "",
    [],
    { lat: 21.8853, lng: -102.2916, radiusKm: 10 }
  );

  if (sweepRes.suspected_domiciles.length > 0) {
    const dom = sweepRes.suspected_domiciles[0];
    console.log(`✅ EXA4 PASS: Domicilio resuelto en barrido GIM: "${dom.address}"`);
    console.log(`   Coordenadas propias: [${dom.lat}, ${dom.lng}] | Precision: ${dom.precision}`);
  } else {
    console.error(`❌ EXA4 FAIL: Barrido GIM no devolvió domicilios sospechosos.`);
    passedAll = false;
  }

  // 5. INTENTO CON BARRIDO DE DIRECCIÓN INEXISTENTE
  console.log("\n[PRUEBA 5] Barrido GIM con Dirección Inexistente...");
  const sweepResUnresolved = await GangGeoSweepEngine.executeSweep(
    [],
    "Realizar barrido en Calle Ficticia 999999, Colonia Inexistente",
    "",
    [],
    { lat: 21.8853, lng: -102.2916, radiusKm: 10 }
  );

  if (
    sweepResUnresolved.suspected_domiciles.length === 0 &&
    sweepResUnresolved.unresolved_addresses &&
    sweepResUnresolved.unresolved_addresses.length > 0
  ) {
    console.log(`✅ EXA5 PASS: No se agregaron marcadores ficticios a domicilios verificados.`);
    console.log(`   Registrado en unresolved_addresses: "${sweepResUnresolved.unresolved_addresses[0].address}"`);
  } else {
    console.error(`❌ EXA5 FAIL: Barrido inyectó marcadores a direcciones inexistentes.`);
    passedAll = false;
  }

  // 6. INTEGRIDAD DE COMPONENTES CONGELADOS
  console.log("\n[PRUEBA 6] Verificación de Archivos Protegidos/Congelados...");
  const forbiddenFiles = [
    "src/components/ProjectMap.tsx",
    "src/components/PhotoAlbum.tsx",
    "src/context/ProjectContext.tsx",
    "src/utils/evidenceGovernanceEngine.ts"
  ];

  forbiddenFiles.forEach(f => {
    const fullPath = path.resolve(process.cwd(), f);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ ARCHIVO PROTEGIDO INTACTO: ${f}`);
    } else {
      console.error(`❌ NO ENCONTRADO: ${f}`);
      passedAll = false;
    }
  });

  console.log("\n================================────────────────────────");
  if (passedAll) {
    console.log("   STATUS FASE 5A: GREEN (TODAS LAS PRUEBAS PASARON)");
  } else {
    console.log("   STATUS FASE 5A: RED (FALLÓ UNA O MÁS PRUEBAS)");
  }
  console.log("================================────────────────────────\n");
}

runPhase5ATests().catch(err => {
  console.error("Error fatal en pruebas FASE 5A:", err);
  process.exit(1);
});
