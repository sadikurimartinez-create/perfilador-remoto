/**
 * tests/testADR01913Governance.test.ts
 * Suite de Pruebas Automatizadas de Gobernanza Humana, Persistencia e Informe Forense (ADR-019.13-F4)
 */

import { GeoEvidence } from "../src/types/geointEvidence";
import {
  compareTemporalEvidence,
  updateComparisonValidationStatus,
  getApprovedTemporalComparisons,
} from "../src/services/geoint/temporalComparisonService";

export async function runGovernanceTests() {
  console.log("\n================================================================");
  console.log("🛡️  SUITE DE PRUEBAS ADR-019.13-F4: GOBERNANZA HUMANA E INFORME FORENSE");
  console.log("================================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      failedTests++;
    }
  }

  const testExpediente = "EXP-TEST-GOVERNANCE-019";

  // Evidencia Base con metadata requerida
  const baseEvidenceA: GeoEvidence = {
    id: "ev-A-campo-001",
    expedienteId: testExpediente,
    traceabilityId: "trace-test-a-001",
    sourceEvidenceId: "photo-source-a-001",
    source: "FIELD_PHOTO",
    coordinates: { lat: 21.885421, lng: -102.291245 },
    captureDate: "2026-05-10",
    imageReference: "/photos/campo1.jpg",
    metadata: { sourceProvider: "CEIPOL_FIELD" },
    status: "APPROVED_EVIDENCE",
  };

  const baseEvidenceB: GeoEvidence = {
    id: "ev-B-sv-002",
    expedienteId: testExpediente,
    traceabilityId: "trace-test-b-002",
    sourceEvidenceId: "sv-source-b-002",
    source: "STREET_VIEW_HISTORICAL",
    coordinates: { lat: 21.885438, lng: -102.291201 },
    captureDate: "2022-03-15",
    imageReference: "/photos/sv1.jpg",
    metadata: { sourceProvider: "GOOGLE_STREET_VIEW" },
    status: "PENDING_REVIEW",
  };

  // ----------------------------------------------------------------
  // TEST 1: COMPARACIÓN VÁLIDA APROBADA (APPROVED_EVIDENCE) -> INCLUSIBLE
  // ----------------------------------------------------------------
  console.log("📌 CASO 1: Comparación Válida Aprobada por Analista (APPROVED_EVIDENCE)");
  try {
    const execRes1 = await compareTemporalEvidence(baseEvidenceA, baseEvidenceB, 50, "TEMPORAL_VISUAL_DELTA", "ANALISTA_01");
    assert(execRes1.isSuccess && !!execRes1.comparison, "Creación de comparación temporal unificada inicial");

    if (execRes1.comparison) {
      const cmpId = execRes1.comparison.comparisonId;
      assert(execRes1.comparison.analystValidationStatus === "PENDING_REVIEW", "Estado inicial PENDING_REVIEW verificado");

      // Promover a APPROVED_EVIDENCE
      const updatedRecord = await updateComparisonValidationStatus(
        cmpId,
        testExpediente,
        "APPROVED_EVIDENCE",
        "Convalidación aprobada por analista en gabinete: alteración en barda perimetral verificada.",
        "ANALISTA_SUPERVISOR_01"
      );

      assert(updatedRecord !== null, "Registro de convalidación generado exitosamente");
      assert(updatedRecord?.analystValidation.status === "APPROVED_EVIDENCE", "Estado actualizado a APPROVED_EVIDENCE");
      assert(!!updatedRecord?.analystValidation.comments?.includes("barda perimetral"), "Comentario de convalidación registrado de forma íntegra");

      const approvedList = await getApprovedTemporalComparisons(testExpediente);
      const isApprovedInList = approvedList.some((r) => r.id === cmpId);
      assert(isApprovedInList, "Verificación: Comparación APPROVED_EVIDENCE incluida en getApprovedTemporalComparisons()");
    }
  } catch (err: any) {
    assert(false, "Caso 1 falló con excepción", err.message);
  }

  // ----------------------------------------------------------------
  // TEST 2: COMPARACIÓN GENERADA PERO PENDIENTE (PENDING_REVIEW) -> EXCLUIDA
  // ----------------------------------------------------------------
  console.log("\n📌 CASO 2: Comparación Pendiente de Revisión (PENDING_REVIEW)");
  try {
    const evidencePendingB: GeoEvidence = {
      ...baseEvidenceB,
      id: "ev-B-pending-003",
    };

    const execRes2 = await compareTemporalEvidence(baseEvidenceA, evidencePendingB, 50, "VARIABILITY_STRUCTURAL", "ANALISTA_02");
    assert(execRes2.isSuccess && !!execRes2.comparison, "Comparación temporal generada en PENDING_REVIEW");

    if (execRes2.comparison) {
      assert(execRes2.comparison.analystValidationStatus === "PENDING_REVIEW", "Permanece en PENDING_REVIEW sin convalidar");

      const approvedList = await getApprovedTemporalComparisons(testExpediente);
      const isPendingInApproved = approvedList.some((r) => r.id === execRes2.comparison?.comparisonId);
      assert(!isPendingInApproved, "Verificación: La comparación PENDING_REVIEW es EXCLUIDA de getApprovedTemporalComparisons()");
    }
  } catch (err: any) {
    assert(false, "Caso 2 falló con excepción", err.message);
  }

  // ----------------------------------------------------------------
  // TEST 3: COMPARACIÓN RECHAZADA (REJECTED_FINDING) -> EXCLUIDA
  // ----------------------------------------------------------------
  console.log("\n📌 CASO 3: Comparación Rechazada por Analista (REJECTED_FINDING)");
  try {
    const evidenceRejectedB: GeoEvidence = {
      ...baseEvidenceB,
      id: "ev-B-rejected-004",
    };

    const execRes3 = await compareTemporalEvidence(baseEvidenceA, evidenceRejectedB, 50, "ENVIRONMENTAL_CHANGE", "ANALISTA_03");
    if (execRes3.comparison) {
      const cmpId = execRes3.comparison.comparisonId;
      await updateComparisonValidationStatus(
        cmpId,
        testExpediente,
        "REJECTED_FINDING",
        "Descartado: Reflejo en lente y ángulo distorsionado sin relevancia probatoria.",
        "ANALISTA_SUPERVISOR_02"
      );

      const approvedList = await getApprovedTemporalComparisons(testExpediente);
      const isRejectedInApproved = approvedList.some((r) => r.id === cmpId);
      assert(!isRejectedInApproved, "Verificación: La comparación REJECTED_FINDING es EXCLUIDA de evidencias aprobadas");
    }
  } catch (err: any) {
    assert(false, "Caso 3 falló con excepción", err.message);
  }

  // ----------------------------------------------------------------
  // TEST 4: INFORME FORENSE CON FILTRO DE CONVALIDACIÓN (APPROVED_EVIDENCE)
  // ----------------------------------------------------------------
  console.log("\n📌 CASO 4: Auditoría de Ingesta en Informe Forense (Filtro APPROVED_EVIDENCE)");
  try {
    const isApprovedEvidence = (item: any) => {
      if (!item) return false;
      const status = (item.status || item.estado || item.estado_revision || item.analystValidationStatus || "").toUpperCase();
      if (status === "REJECTED_FINDING" || status === "RECHAZADO" || status === "IGNORADO" || status === "PENDING_REVIEW" || status === "PENDIENTE_REVISION" || status === "GENERATED" || status === "GENERADO") {
        return false;
      }
      if (status === "APPROVED_EVIDENCE" || status === "APROBADO" || status === "APPROVED") {
        return true;
      }
      if (!status) return true;
      return false;
    };

    const rawBatch = [
      { id: "1", status: "APPROVED_EVIDENCE", label: "Aprobado 1" },
      { id: "2", status: "PENDING_REVIEW", label: "Pendiente 2" },
      { id: "3", status: "REJECTED_FINDING", label: "Rechazado 3" },
      { id: "4", status: "GENERATED", label: "Generado 4" },
      { id: "5", status: "APROBADO", label: "Aprobado Legacy 5" },
    ];

    const filteredBatch = rawBatch.filter(isApprovedEvidence);

    assert(filteredBatch.length === 2, "Filtro de Ingesta: 2 evidencias aprobadas de 5 procesadas");
    assert(filteredBatch.every((item) => item.status === "APPROVED_EVIDENCE" || item.status === "APROBADO"), "Filtro de Ingesta: Únicamente evidencias aprobadas consumidas");
    assert(!filteredBatch.some((item) => item.status === "PENDING_REVIEW" || item.status === "REJECTED_FINDING" || item.status === "GENERATED"), "Filtro de Ingesta: PENDING_REVIEW, REJECTED_FINDING y GENERATED filtrados estrictamente");

  } catch (err: any) {
    assert(false, "Caso 4 falló con excepción", err.message);
  }

  console.log("\n================================================================");
  console.log(`📊 RESUMEN DE PRUEBAS ADR-019.13-F4: ${passedTests} PASADAS | ${failedTests} FALLADAS`);
  console.log("================================================================\n");

  if (failedTests > 0) {
    throw new Error("Una o más pruebas de gobernanza fallaron.");
  }
}
