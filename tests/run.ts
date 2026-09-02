// --- INICIO STUB DOM PARA REPORT ENGINE ---
if (typeof global.document === "undefined") {
  const mockCanvasContext = new Proxy({}, {
    get: (target, prop) => {
      if (prop === "measureText") {
        return () => ({ width: 10 });
      }
      if (prop === "getImageData" || prop === "createImageData") {
        return () => ({ data: new Uint8ClampedArray(4) });
      }
      // Devolver función vacía para cualquier otro método de canvas 2D
      return () => {};
    }
  });
  const mockCanvas = {
    getContext: () => mockCanvasContext,
    width: 100,
    height: 100,
    toDataURL: () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  };
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === "canvas") {
        return mockCanvas;
      }
      return {};
    },
    getElementById: () => null,
  };

  // Stub de la clase Image para simular la carga asíncrona de recursos gráficos (tiles)
  (global as any).Image = class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src: string = "";
    constructor() {
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
  };
}
// --- FIN STUB DOM ---

import { runMigrationTests } from "./reportEngineIICMigration.test";
import { runAuthTests } from "./authHardening.test";
import { runGovernanceTests } from "./testADR01913Governance.test";
import { runGeointegrityTests } from "./testADR01915Geointegrity.test";
import { runADR01917ConnectivityTests } from "./testADR01917Connectivity.test";
import { runADR01918EventLedgerTests } from "./testADR01918EventLedger.test";
import { runADR01919FingerprintTests } from "./testADR01919Fingerprint.test";

async function runAllTests() {
  console.log("======================================================================");
  console.log("🚀 INICIANDO ORQUESTRADOR DE PRUEBAS INTEGRALES DE CERTIFICACIÓN v1.0");
  console.log("======================================================================");
  
  const started = Date.now();
  try {
    // 1. Ejecutar pruebas de regresión del Report Engine de la Fase 4
    await runMigrationTests();
    
    // 2. Ejecutar pruebas de hardening de autenticación de la Fase 1
    await runAuthTests();
    
    // 3. Ejecutar pruebas de Gobernanza Humana GEOINT ADR-019.13-F4
    await runGovernanceTests();
    
    // 4. Ejecutar pruebas de Integridad Geoespacial GEOINT ADR-019.15
    await runGeointegrityTests();

    // 5. Ejecutar pruebas de conectividad de contratos ADR-019.17
    await runADR01917ConnectivityTests();

    // 6. Ejecutar pruebas de Event Ledger forense operativo ADR-019.18
    await runADR01918EventLedgerTests();

    // 7. Ejecutar pruebas de Event Fingerprint & Idempotency Core ADR-019.19 Fase 1
    await runADR01919FingerprintTests();
    
    const durationSec = ((Date.now() - started) / 1000).toFixed(2);
    console.log("\n======================================================================");
    console.log(`🎉 ¡TODAS LAS PRUEBAS INTEGRALES PASARON CON ÉXITO EN ${durationSec}s!`);
    console.log("ESTADO: CERTIFICADO PARA PRODUCCIÓN (PERFILADOR REMOTO v1.0)");
    console.log("======================================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("\n======================================================================");
    console.error("❌ ERROR: Una o más pruebas de certificación fallaron.");
    console.error(err);
    console.error("======================================================================");
    process.exit(1);
  }
}

runAllTests();

