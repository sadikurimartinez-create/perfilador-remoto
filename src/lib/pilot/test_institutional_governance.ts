import { InstitutionalContextEngine, OperationalTier } from "./institutionalContextEngine";
import { GeoDecision } from "../iri/decision/geoDecisionEngine";

async function runInstitutionalGovernanceTests() {
  console.log("=== STARTING GEOINT INSTITUTIONAL OPERATIONALIZATION LAYER TESTS ===");

  const engine = InstitutionalContextEngine.getInstance();

  // -------------------------------------------------------------
  // TEST 1: INSTITUTIONAL CONTEXT & CONFIG CHECK (inst_004)
  // -------------------------------------------------------------
  console.log("\n[TEST 1] Verifying Institutional Context & Mode configuration parameters...");
  const context = engine.getContext();
  console.log(`  Jurisdiction: ${context.jurisdiction}`);
  console.log(`  Operational Level: ${context.operational_level}`);
  console.log(`  Operational Tier: ${context.tier} (Expected: TIER_3_ASSISTED_DECISION_HITL)`);
  console.log(`  Mode: ${context.config.mode} (Expected: INSTITUTIONAL)`);
  console.log(`  HITL Required: ${context.config.hitl_required} (Expected: true)`);
  console.log(`  Auto Execution: ${context.config.auto_execution} (Expected: false)`);

  if (
    context.tier !== OperationalTier.TIER_3 ||
    context.config.mode !== "INSTITUTIONAL" ||
    !context.config.hitl_required ||
    context.config.auto_execution !== false
  ) {
    throw new Error("❌ Test 1 Failed: Institutional configuration parameters mismatch.");
  }
  console.log("  ✅ Institutional configurations verified.");

  // -------------------------------------------------------------
  // TEST 2: INSTITUTIONAL OUTPUT STRUCTURE (inst_005)
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Verifying formalized institutional output structure...");
  const status = engine.getInstitutionalStatus();
  console.log("  Output Status:", JSON.stringify(status, null, 2));

  if (
    status.system_mode !== "INSTITUTIONAL" ||
    status.operational_tier !== 3 ||
    status.decision_flow !== "HITL_CONTROLLED" ||
    status.audit_status !== "ACTIVE" ||
    status.risk_compliance !== "ENFORCED"
  ) {
    throw new Error("❌ Test 2 Failed: Output structure does not match inst_005 schema.");
  }
  console.log("  ✅ Output structure successfully validated.");

  // -------------------------------------------------------------
  // TEST 3: OPERATIONAL GOVERNANCE ENGINE & BLOCKED DISPATCHES
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Verifying Operational Governance Rules (System Sugiere -> Human Aprueba)...");
  
  const criticalDecision: GeoDecision = {
    event_id: "EVT-TEST-PC-09",
    geometry: { type: "Polygon", coordinates: [] },
    iri_score: 0.88,
    ops_score: 0.91,
    impact: { population: 0.9, infrastructure: 0.8, accessibility: 0.8 },
    classification: "CRITICAL_RESPONSE",
    recommendation: ["🚨 EJECUTAR EVACUACIÓN INMEDIATA EN FRACCIONAMIENTO CONSTITUCIÓN"],
    priority_rank: 1,
    timestamp: new Date().toISOString()
  };

  // A. Attempting automatic execution without human approval should be BLOCKED
  console.log("  Simulating automatic system execution attempt on CRITICAL response...");
  const blockedAttempt = engine.processInstitutionalDecision(
    criticalDecision,
    false, // No human approval
    "system",
    "System automated scheduler try"
  );

  console.log(`  Result Status: ${blockedAttempt.status} (Expected: DENIED_AUTO_EXECUTION)`);
  console.log(`  Message: ${blockedAttempt.message}`);
  
  if (blockedAttempt.status !== "DENIED_AUTO_EXECUTION") {
    throw new Error("❌ Test 3 Failed: Automatic critical action was not blocked under institutional rules.");
  }
  console.log("  ✅ Auto-execution block on CRITICAL validated successfully.");

  // B. Approving decision with human validation (HITL)
  console.log("\n  Simulating Human-in-the-Loop (HITL) manual approval...");
  const approvedAttempt = engine.processInstitutionalDecision(
    criticalDecision,
    true, // Human Approved
    "director_proteccion_civil",
    "Se convalida la evacuación dadas las condiciones extremas reportadas por NOAA y CONAGUA."
  );

  console.log(`  Result Status: ${approvedAttempt.status} (Expected: APPROVED)`);
  if (approvedAttempt.status !== "APPROVED") {
    throw new Error("❌ Test 3 Failed: Human approval was not recognized.");
  }
  console.log("  ✅ Human-in-the-Loop flow (System -> Suggests, Human -> Approves) verified.");

  // -------------------------------------------------------------
  // TEST 4: IMMUTABLE AUDIT TRAIL ENGINE (inst_002)
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Verifying AuditTrailEngine logging and inst_002 schema...");
  const trail = engine.getAuditTrail();
  const matchEntry = trail.find(t => t.event_id === "EVT-TEST-PC-09" && t.actor === "human");

  if (!matchEntry) {
    throw new Error("❌ Test 4 Failed: Log entry for approved action not found in Audit Trail.");
  }

  console.log("  Approved Audit Log Entry:", JSON.stringify(matchEntry, null, 2));

  // Verify format parameters
  if (
    !matchEntry.audit_id ||
    !matchEntry.event_id ||
    !matchEntry.decision ||
    !matchEntry.actor ||
    !matchEntry.timestamp ||
    !matchEntry.justification ||
    !Array.isArray(matchEntry.source_trace)
  ) {
    throw new Error("❌ Test 4 Failed: Audit log entry format is missing fields of inst_002 schema.");
  }
  console.log("  ✅ Immutable audit trail logs match the inst_002 schema exactly.");

  console.log("\n=== 🏆 ALL GEOINT INSTITUTIONAL GOVERNANCE TESTS PASSED SUCCESSFULLY ===");
}

runInstitutionalGovernanceTests().catch(err => {
  console.error("❌ Test crashed:", err);
  process.exit(1);
});
