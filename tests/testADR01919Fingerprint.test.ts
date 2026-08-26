/**
 * tests/testADR01919Fingerprint.test.ts
 * Suite de Pruebas Automatizadas — ADR-019.19 FASE 1: Event Fingerprint & Idempotency Core
 */

import { GeointEventFingerprintService } from "../src/services/geoint/geointEventFingerprintService";
import { GeointEventLogService } from "../src/services/geoint/geointEventLogService";

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
    throw new Error(testName);
  }
}

export async function runADR01919FingerprintTests() {
  console.log("\n================================================================");
  console.log("🛡️  SUITE ADR-019.19 FASE 1: EVENT FINGERPRINT & IDEMPOTENCY CORE");
  console.log("================================================================\n");

  const originalWindow = (global as any).window;
  (global as any).window = {};

  try {
    // CASO 1: Mismo evento enviado dos veces. Resultado: 1 solo registro (idempotente).
    console.log("➡️ CASO 1: Mismo evento enviado dos veces...");
    const expId1 = "EXP-01919-CASE1";
    const traceId1 = "trace-01919-1";
    const eventType1 = "GEOINT_SWEEP_STARTED";
    const entityId1 = "entity-01";

    const eventFirst = await GeointEventLogService.createAndPersistEvent(
      eventType1 as any,
      expId1,
      traceId1,
      "ANALYST_01",
      "TestRunner",
      "INITIATED",
      "SESSION",
      entityId1,
      { testCase: 1 }
    );

    const eventSecond = await GeointEventLogService.createAndPersistEvent(
      eventType1 as any,
      expId1,
      traceId1,
      "ANALYST_01",
      "TestRunner",
      "INITIATED",
      "SESSION",
      entityId1,
      { testCase: 1 }
    );

    assert(
      eventFirst.eventId === eventSecond.eventId,
      "CASO 1: Mismo evento enviado dos veces retorna exactamente el mismo eventId (Idempotencia)"
    );

    const history1 = await GeointEventLogService.getExpedientEventHistory(expId1);
    assert(
      history1.length === 1,
      `CASO 1: Solo existe 1 registro en geoint_event_logs (Total encontrados: ${history1.length})`
    );

    // CASO 2: Dos eventos diferentes. Resultado: 2 registros.
    console.log("\n➡️ CASO 2: Dos eventos diferentes...");
    const expId2 = "EXP-01919-CASE2";
    const traceId2A = "trace-01919-2A";
    const traceId2B = "trace-01919-2B";

    await GeointEventLogService.createAndPersistEvent(
      "GEOINT_SWEEP_STARTED",
      expId2,
      traceId2A,
      "ANALYST_01",
      "TestRunner",
      "INITIATED",
      "SESSION",
      "entity-02A",
      { note: "First" }
    );

    await GeointEventLogService.createAndPersistEvent(
      "PANORAMA_VALIDATED",
      expId2,
      traceId2B,
      "ANALYST_01",
      "TestRunner",
      "VALIDATED",
      "PANORAMA",
      "entity-02B",
      { note: "Second" }
    );

    const history2 = await GeointEventLogService.getExpedientEventHistory(expId2);
    assert(
      history2.length === 2,
      `CASO 2: Dos eventos diferentes generan exactamente 2 registros (Total encontrados: ${history2.length})`
    );

    // CASO 3: Mismo expediente pero diferente traceabilityId. Resultado: eventos independientes.
    console.log("\n➡️ CASO 3: Mismo expediente pero diferente traceabilityId...");
    const expId3 = "EXP-01919-CASE3";
    const entityId3 = "entity-03";

    const evtA = await GeointEventLogService.createAndPersistEvent(
      "GEOINT_SWEEP_STARTED",
      expId3,
      "trace-id-alpha",
      "ANALYST_01",
      "TestRunner",
      "INITIATED",
      "SWEEP",
      entityId3
    );

    const evtB = await GeointEventLogService.createAndPersistEvent(
      "GEOINT_SWEEP_STARTED",
      expId3,
      "trace-id-beta",
      "ANALYST_01",
      "TestRunner",
      "INITIATED",
      "SWEEP",
      entityId3
    );

    assert(
      evtA.eventId !== evtB.eventId,
      "CASO 3: Diferente traceabilityId genera eventos independientes con distintos eventIds"
    );

    const history3 = await GeointEventLogService.getExpedientEventHistory(expId3);
    assert(
      history3.length === 2,
      `CASO 3: Expediente con traceabilityIds distintos contiene 2 eventos independientes`
    );

    // CASO 4: Concurrencia simulada. Resultado: una única creación.
    console.log("\n➡️ CASO 4: Concurrencia simulada...");
    const expId4 = "EXP-01919-CASE4";
    const traceId4 = "trace-concurrent-019";
    const entityId4 = "entity-concurrent";

    const promises = Array.from({ length: 5 }).map(() =>
      GeointEventLogService.createAndPersistEvent(
        "TEMPORAL_COMPARISON_CREATED",
        expId4,
        traceId4,
        "ANALYST_CONCURRENT",
        "TestRunner",
        "CREATED",
        "COMPARISON",
        entityId4
      )
    );

    const concurrentResults = await Promise.all(promises);
    const firstId = concurrentResults[0].eventId;
    const allSame = concurrentResults.every((res) => res.eventId === firstId);

    assert(
      allSame,
      "CASO 4: Concurrencia simulada de 5 envíos idénticos retorna siempre el mismo eventId"
    );

    const history4 = await GeointEventLogService.getExpedientEventHistory(expId4);
    assert(
      history4.length === 1,
      `CASO 4: Concurrencia simulada resulta en exactamente 1 único registro almacenado (Total: ${history4.length})`
    );

    console.log("\n📊 RESUMEN ADR-019.19 FASE 1: FINGERPRINT & IDEMPOTENCY CORE PASS\n");
  } finally {
    (global as any).window = originalWindow;
  }
}

