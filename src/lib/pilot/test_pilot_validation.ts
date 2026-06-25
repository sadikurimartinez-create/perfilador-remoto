import { PilotValidationEngine } from "./pilotValidationEngine";
import { GLOBAL_AUTHORITY_MATRIX, SourceAuthorityClass } from "../iri/governance/modelGovernanceEngine";
import { GeointReliabilityEngine } from "../infra/geointReliabilityEngine";
import { GeointPilotController } from "./geointPilotController";
import { GeoDecision } from "../iri/decision/geoDecisionEngine";

async function runPilotValidationTuningTests() {
  console.log("=== STARTING PILOT VALIDATION & OPERATIONAL TUNING LAYER TESTS ===");

  const engine = PilotValidationEngine.getInstance();
  const controller = GeointPilotController.getInstance();

  // Reset any historical context
  engine.resetHistory();

  // -------------------------------------------------------------
  // TEST 1: ADAPTIVE AUTHORITY TUNING ("Dynamic Authority Drift")
  // -------------------------------------------------------------
  console.log("\n[TEST 1] Verifying Adaptive Authority Tuning & Dynamic Authority Drift...");
  
  // A. Check initial baseline authority for NOAA and CONAGUA
  const originalNoaaAuth = GLOBAL_AUTHORITY_MATRIX["noaa"].authorityScore;
  console.log(`  Original NOAA Authority Score: ${originalNoaaAuth}`);

  // B. Trigger update with perfect reliability
  engine.updateAdaptiveAuthorities();
  const baselineUpdatedNoaaAuth = GLOBAL_AUTHORITY_MATRIX["noaa"].authorityScore;
  console.log(`  Updated Baseline NOAA Authority Score: ${baselineUpdatedNoaaAuth}`);

  // C. Simulate a Stress Mode: DATA_LOSS to trigger authority degradation
  console.log("  Simulating stress mode: DATA_LOSS...");
  engine.simulateOperationalStress("DATA_LOSS");
  const degradedNoaaAuth = GLOBAL_AUTHORITY_MATRIX["noaa"].authorityScore;
  console.log(`  Degraded NOAA Authority Score under DATA_LOSS: ${degradedNoaaAuth}`);
  
  if (degradedNoaaAuth >= baselineUpdatedNoaaAuth) {
    throw new Error("❌ Test 1 Failed: NOAA authority did not degrade under DATA_LOSS.");
  }
  console.log("  ✅ Authority drift and context stability penalty verified.");

  // D. OSINT Overload suppression
  console.log("  Simulating stress mode: OSINT_OVERLOAD (protect uncertified signal overreaction)...");
  engine.simulateOperationalStress("OSINT_OVERLOAD");
  const overloadedTelegramAuth = GLOBAL_AUTHORITY_MATRIX["telegram"].authorityScore;
  console.log(`  Telegram Authority under OSINT_OVERLOAD: ${overloadedTelegramAuth}`);
  if (overloadedTelegramAuth > 0.15) {
    throw new Error("❌ Test 1 Failed: OSINT authority not properly suppressed under overload.");
  }
  console.log("  ✅ OSINT authority suppression under overload verified.");

  // Reset stress mode
  engine.simulateOperationalStress("NONE");

  // -------------------------------------------------------------
  // TEST 2: IRI BEHAVIOR TUNING (Temporal Smoothing & Spike Damping)
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Verifying IRI Behavior Tuning (Smoothing & Spike Damping)...");
  
  const cellId = "cell_test_001";
  
  // A. Baseline reading
  const s1 = engine.observeAndSmooth(cellId, 0.15);
  console.log(`  Step 1 (Baseline 0.15): Smoothed IRI = ${s1} (Expected: 0.15)`);
  if (s1 !== 0.15) {
    throw new Error("❌ Test 2 Failed: Initial baseline IRI mismatch.");
  }

  // B. Trigger a sudden, unconfirmed spike from 0.15 to 0.75 (delta of 0.60)
  const s2 = engine.observeAndSmooth(cellId, 0.75, false);
  console.log(`  Step 2 (Unconfirmed spike 0.75): Smoothed IRI = ${s2} (Expected: ~0.345 due to damping factor of 0.65)`);
  
  if (s2 >= 0.75) {
    throw new Error("❌ Test 2 Failed: Sudden unconfirmed spike was not damped.");
  }
  console.log("  ✅ Sudden spike damping factor successfully applied.");

  // C. Test smoothing temporal window convergence over another tick
  const s3 = engine.observeAndSmooth(cellId, 0.40);
  console.log(`  Step 3 (Tick 0.40): Smoothed IRI = ${s3} (Expected: moving average around 0.30)`);
  
  if (s3 > 0.45 || s3 < 0.25) {
    throw new Error("❌ Test 2 Failed: Moving average window did not smooth the curve.");
  }
  console.log("  ✅ Moving average temporal window is active and smoothing successfully.");

  // -------------------------------------------------------------
  // TEST 3: EVENT ENGINE VALIDATION (Anti-Flapping State Guard)
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Verifying Event Engine Validation & Anti-Flapping State Guard...");
  
  // A. Transition NORMAL -> CRITICAL
  const trans1 = engine.validateEventTransition(cellId, "CRITICAL");
  console.log(`  First Transition to CRITICAL: State allowed = ${trans1.allowedState} | Code: ${trans1.code}`);
  if (trans1.allowedState !== "CRITICAL") {
    throw new Error("❌ Test 3 Failed: Normal first transition to CRITICAL was blocked.");
  }

  // B. Rapid oscillation to NORMAL
  const trans2 = engine.validateEventTransition(cellId, "NORMAL");
  console.log(`  Oscillation to NORMAL: State allowed = ${trans2.allowedState}`);

  // C. Rapid oscillation back to CRITICAL within less than 3 minutes
  const trans3 = engine.validateEventTransition(cellId, "CRITICAL");
  console.log(`  Oscillation back to CRITICAL (Within 3min): State allowed = ${trans3.allowedState} | Flapped: ${trans3.hasFlapped} | Code: ${trans3.code}`);
  
  if (trans3.allowedState !== "WARNING" || trans3.code !== "STATE_FLAPPING_WARNING") {
    throw new Error("❌ Test 3 Failed: Flapping guard failed to lock state to WARNING.");
  }
  console.log("  ✅ Event oscillation and flapping suppressed, locked state to WARNING.");

  // -------------------------------------------------------------
  // TEST 4: DECISION ENGINE TUNING (Contradiction & Duplication)
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Verifying Decision Engine Tuning...");
  
  // Generate some dummy conflicting/duplicate decisions
  const dummyDecisions: GeoDecision[] = [
    {
      event_id: "evt_test_dup",
      geometry: { type: "Polygon", coordinates: [] },
      iri_score: 0.85,
      ops_score: 0.88,
      impact: { population: 0.8, infrastructure: 0.7, accessibility: 0.6 },
      classification: "CRITICAL_RESPONSE",
      recommendation: [
        "🚨 INICIAR EVACUACIÓN INMEDIATA de sectores habitacionales bajos expuestos",
        "📥 Mantener guardia técnica pasiva de protección civil" // Contradictory recommendation!
      ],
      priority_rank: 1,
      timestamp: new Date().toISOString()
    },
    {
      event_id: "evt_test_dup", // Duplicate decision for same event!
      geometry: { type: "Polygon", coordinates: [] },
      iri_score: 0.85,
      ops_score: 0.88,
      impact: { population: 0.8, infrastructure: 0.7, accessibility: 0.6 },
      classification: "CRITICAL_RESPONSE",
      recommendation: [
        "🚨 INICIAR EVACUACIÓN INMEDIATA de sectores habitacionales bajos expuestos"
      ],
      priority_rank: 2,
      timestamp: new Date().toISOString()
    }
  ];

  const tuned = engine.tuneDecisionCommands(dummyDecisions);
  console.log(`  Number of tuned decisions: ${tuned.length} (Expected: 1 due to duplication suppression)`);
  if (tuned.length !== 1) {
    throw new Error("❌ Test 4 Failed: Duplicate decisions for the same event were not suppressed.");
  }

  console.log("  Tuned recommendations in decision:");
  tuned[0].recommendation.forEach(r => console.log(`    - ${r}`));
  
  const hasPassive = tuned[0].recommendation.some(r => r.includes("guardia técnica pasiva"));
  if (hasPassive) {
    throw new Error("❌ Test 4 Failed: Contradictory recommendation was not suppressed.");
  }
  console.log("  ✅ Decision contradiction and duplication suppressed successfully.");

  // -------------------------------------------------------------
  // TEST 5: STABILITY SCORING
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Verifying System Stability Score & Telemetry Indicator...");
  
  const stats = engine.calculateStabilityScore();
  console.log("  Calculated Stability Stats JSON Output:");
  console.log(JSON.stringify(stats, null, 2));

  if (typeof stats.stability_score !== "number" || stats.stability_score <= 0.0 || stats.stability_score > 1.0) {
    throw new Error("❌ Test 5 Failed: Stability score calculation returned invalid format.");
  }
  if (typeof stats.iri_volatility !== "number" || typeof stats.authority_drift !== "number" || typeof stats.decision_consistency !== "number") {
    throw new Error("❌ Test 5 Failed: Malformed telemetry scoring keys.");
  }
  console.log("  ✅ Stability scoring schema verified successfully.");

  console.log("\n=== 🏆 ALL PILOT VALIDATION & TUNING TESTS PASSED SUCCESSFULLY ===");
}

runPilotValidationTuningTests().catch(err => {
  console.error("❌ Test crashed:", err);
  process.exit(1);
});
