import { GLOBAL_AUTHORITY_MATRIX, SourceAuthority, SourceAuthorityClass } from "../iri/governance/modelGovernanceEngine";
import { GeointReliabilityEngine } from "../infra/geointReliabilityEngine";
import { GeointPilotController } from "./geointPilotController";
import { GeoEvent } from "../iri/operations/iriEventEngine";
import { GeoDecision } from "../iri/decision/geoDecisionEngine";

export class PilotValidationEngine {
  private static instance: PilotValidationEngine | null = null;

  private iriHistory: Map<string, number[]> = new Map();
  private stateTransitions: Map<string, { state: string; timestamp: number }[]> = new Map();
  private registeredDecisions: GeoDecision[] = [];
  
  private originalAuthorities: Map<string, number> = new Map();
  private stressMode: "LATENCY_SPIKE" | "DATA_LOSS" | "OSINT_OVERLOAD" | "CONFLICTING_HYDRO" | "NONE" = "NONE";
  private fallbackExecutionCount = 0;
  private dataLossSeverity = 0.0;
  private osintOverloadMultiplier = 1.0;
  private conflictingSignalsActive = false;

  private constructor() {
    // Seed original authorities to allow drift reset/calibration
    for (const [providerId, authority] of Object.entries(GLOBAL_AUTHORITY_MATRIX)) {
      this.originalAuthorities.set(providerId, authority.authorityScore);
    }
  }

  public static getInstance(): PilotValidationEngine {
    if (!PilotValidationEngine.instance) {
      PilotValidationEngine.instance = new PilotValidationEngine();
    }
    return PilotValidationEngine.instance;
  }

  /**
   * Helper mapping provider to reliability key.
   */
  private mapToReliabilityKey(providerId: string): string {
    const p = providerId.toLowerCase();
    if (["telegram", "x", "reddit", "facebook", "instagram"].includes(p)) {
      return "osint";
    }
    return p;
  }

  /**
   * Adaptive Authority Tuning - "Dynamic Authority Drift"
   * effective_authority = base_authority * reliability_score * context_stability
   */
  public updateAdaptiveAuthorities(): void {
    for (const [providerId, authority] of Object.entries(GLOBAL_AUTHORITY_MATRIX)) {
      const baseAuthority = this.originalAuthorities.get(providerId) ?? authority.authorityScore;
      const reliabilityKey = this.mapToReliabilityKey(providerId);
      const reliabilityScore = GeointReliabilityEngine.getReliabilityScore(reliabilityKey);
      
      // Calculate context stability
      let contextStability = 1.0;
      if (this.stressMode === "DATA_LOSS") {
        contextStability -= this.dataLossSeverity * 0.35; // degrade stability during packet loss
      } else if (this.stressMode === "LATENCY_SPIKE" && reliabilityScore < 0.8) {
        contextStability -= 0.20; // lag penalty
      }

      // Base authority * reliability * stability
      let effectiveAuthority = baseAuthority * reliabilityScore * contextStability;

      // Dynamic authority drift: if consistent and highly reliable, gain authority
      const stats = GeointReliabilityEngine.computeHealthScore(reliabilityKey);
      if (stats.success_rate > 0.98 && stats.latency_ms < 1500) {
        effectiveAuthority = Math.min(1.0, effectiveAuthority + 0.05); // dynamic consistency bonus
      }

      // OSINT specific cohesion boost: if OSINT is dense and coherent across sources, boost OSINT authority up to +0.15
      const isOsintSource = ["telegram", "x", "reddit", "facebook", "instagram"].includes(providerId);
      if (isOsintSource) {
        if (this.stressMode === "OSINT_OVERLOAD") {
          // Under extreme overload, suppress uncertified OSINT to prevent critical overreaction
          effectiveAuthority = Math.max(0.05, effectiveAuthority * 0.2);
        } else {
          const cohesionActive = this.checkOSINTCohesion();
          if (cohesionActive) {
            effectiveAuthority = Math.min(0.55, effectiveAuthority + 0.15); // local cohesion boost
          }
        }
      }

      // Clamp and assign back to GLOBAL_AUTHORITY_MATRIX
      authority.authorityScore = parseFloat(Math.max(0.0, Math.min(1.0, effectiveAuthority)).toFixed(3));
    }
  }

  /**
   * Check if recent events show coherent OSINT reporting.
   */
  private checkOSINTCohesion(): boolean {
    const controller = GeointPilotController.getInstance();
    const events = controller.getEvents();
    const osintEvents = events.filter(e => 
      e.description.toLowerCase().includes("osint") || 
      e.description.toLowerCase().includes("reportes ciudadanos") ||
      (e.payload && e.payload.osint_cohesion === true)
    );
    return osintEvents.length >= 2;
  }

  /**
   * IRI Behavior Tuning & Smoothing Window
   * Temporal smoothing window (size = 3) prevents overreaction and false positive spikes.
   * Damping factor (alpha = 0.65) applied to spikes > 0.30 unless confirmed by level 1-2 source.
   */
  public observeAndSmooth(
    cellId: string,
    currentIri: number,
    confirmedByAuthSource: boolean = false
  ): number {
    if (!this.iriHistory.has(cellId)) {
      this.iriHistory.set(cellId, []);
    }
    const history = this.iriHistory.get(cellId)!;

    let smoothedIri = currentIri;
    if (history.length > 0) {
      const prevIri = history[history.length - 1];
      const delta = currentIri - prevIri;

      // Unconfirmed spike damping
      if (delta > 0.30 && !confirmedByAuthSource) {
        const alpha = 0.65;
        smoothedIri = prevIri + delta * alpha;
        console.log(`[PILOT_TUNING] Damping applied on ${cellId}. Raw: ${currentIri.toFixed(3)} -> Smoothed: ${smoothedIri.toFixed(3)}`);
      }
    }

    // Keep moving average window bounded to last 3 entries
    history.push(smoothedIri);
    if (history.length > 3) {
      history.shift();
    }

    const averageIri = history.reduce((sum, val) => sum + val, 0) / history.length;
    return parseFloat(Math.max(0.0, Math.min(1.0, averageIri)).toFixed(3));
  }

  /**
   * Event Engine Validation & Anti-Flapping State Guard
   * Prevents NORMAL <-> CRITICAL oscillation inside a 3-minute simulated window.
   */
  public validateEventTransition(
    cellId: string,
    nextState: "NORMAL" | "WATCH" | "WARNING" | "ALERT" | "CRITICAL"
  ): { allowedState: "NORMAL" | "WATCH" | "WARNING" | "ALERT" | "CRITICAL"; hasFlapped: boolean; code?: string } {
    const now = Date.now();
    if (!this.stateTransitions.has(cellId)) {
      this.stateTransitions.set(cellId, []);
    }

    const history = this.stateTransitions.get(cellId)!;

    // Filter to last 3 minutes (180 seconds)
    const threeMinutesAgo = now - 180000;
    const recent = history.filter(h => h.timestamp > threeMinutesAgo);

    let hasFlapped = false;
    let allowedState = nextState;
    let code: string | undefined = undefined;

    const hasNormal = recent.some(t => t.state === "NORMAL" || t.state === "WATCH");
    const hasCritical = recent.some(t => t.state === "CRITICAL" || t.state === "ALERT");

    if (recent.length >= 2 && hasNormal && hasCritical && (nextState === "CRITICAL" || nextState === "NORMAL")) {
      hasFlapped = true;
      allowedState = "WARNING"; // lock state to WARNING to suppress flapping
      code = "STATE_FLAPPING_WARNING";
      console.warn(`[PILOT_TUNING] Flapping detected on ${cellId}. Restricting state to WARNING.`);
    }

    history.push({ state: allowedState, timestamp: now });
    if (history.length > 10) {
      history.shift();
    }

    return { allowedState, hasFlapped, code };
  }

  /**
   * Decision Engine Tuning
   * Filters out contradictory decisions, multiple actions for the same event, or duplicate command recommendations.
   */
  public tuneDecisionCommands(decisions: GeoDecision[]): GeoDecision[] {
    const tunedDecisions: GeoDecision[] = [];
    const processedEvents = new Set<string>();
    const activeCommandRecs = new Set<string>();

    for (const dec of decisions) {
      // 1. Prevent duplicate actions for the same event
      if (processedEvents.has(dec.event_id)) {
        continue;
      }
      processedEvents.add(dec.event_id);

      const tunedRecommendations: string[] = [];
      for (const rec of dec.recommendation) {
        const normalizedRec = rec.trim();

        const isEvac = normalizedRec.includes("EVACUACIÓN") || normalizedRec.includes("evacuación");
        const isPassive = normalizedRec.includes("guardia técnica pasiva") || normalizedRec.includes("Vigilar");

        // Contradiction detection: Evacuating but monitoring passively
        if (isEvac && activeCommandRecs.has("PASSIVE_MONITOR")) {
          // Remove passive recommendations from earlier elements
          tunedDecisions.forEach(td => {
            td.recommendation = td.recommendation.filter(r => 
              !r.includes("guardia técnica pasiva") && !r.includes("MONITOREO")
            );
          });
        }

        if (isPassive && (activeCommandRecs.has("EVACUATION") || activeCommandRecs.has("RESPONSE"))) {
          continue; // skip passive if already evacuating or responding
        }

        if (isEvac) activeCommandRecs.add("EVACUATION");
        if (isPassive) activeCommandRecs.add("PASSIVE_MONITOR");

        // Suppress exact duplicate recommendations
        if (activeCommandRecs.has(normalizedRec)) {
          continue;
        }

        activeCommandRecs.add(normalizedRec);
        tunedRecommendations.push(rec);
      }

      tunedDecisions.push({
        ...dec,
        recommendation: tunedRecommendations
      });
    }

    this.registeredDecisions = tunedDecisions;
    return tunedDecisions;
  }

  /**
   * Returns the current active simulated operational stress scenario.
   */
  public getStressMode(): "LATENCY_SPIKE" | "DATA_LOSS" | "OSINT_OVERLOAD" | "CONFLICTING_HYDRO" | "NONE" {
    return this.stressMode;
  }

  /**
   * Stress Simulator Wrapper
   */
  public simulateOperationalStress(scenario: "LATENCY_SPIKE" | "DATA_LOSS" | "OSINT_OVERLOAD" | "CONFLICTING_HYDRO" | "NONE"): void {
    this.stressMode = scenario;
    console.log(`[PILOT_TUNING] Starting simulated operational stress: ${scenario}`);

    if (scenario === "LATENCY_SPIKE") {
      this.fallbackExecutionCount++;
    } else if (scenario === "DATA_LOSS") {
      this.dataLossSeverity = 0.50;
      this.fallbackExecutionCount++;
    } else if (scenario === "OSINT_OVERLOAD") {
      this.osintOverloadMultiplier = 5.0;
    } else if (scenario === "CONFLICTING_HYDRO") {
      this.conflictingSignalsActive = true;
    } else {
      this.dataLossSeverity = 0.0;
      this.osintOverloadMultiplier = 1.0;
      this.conflictingSignalsActive = false;
    }

    this.updateAdaptiveAuthorities();
  }

  /**
   * Stability Score Calculation (Fase Final)
   * System Stability Score = consistency + resilience + decision coherence + fallback effectiveness
   */
  public calculateStabilityScore(): {
    stability_score: number;
    iri_volatility: number;
    authority_drift: number;
    event_flapping: boolean;
    decision_consistency: number;
  } {
    // 1. Volatility (average delta in sliding history)
    let totalDeltas = 0;
    let deltaCount = 0;
    for (const history of this.iriHistory.values()) {
      for (let i = 1; i < history.length; i++) {
        totalDeltas += Math.abs(history[i] - history[i - 1]);
        deltaCount++;
      }
    }
    const iri_volatility = deltaCount > 0 ? parseFloat((totalDeltas / deltaCount).toFixed(3)) : 0.04;

    // 2. Drift
    let driftSum = 0;
    let driftCount = 0;
    for (const [providerId, original] of this.originalAuthorities.entries()) {
      const current = GLOBAL_AUTHORITY_MATRIX[providerId]?.authorityScore ?? original;
      driftSum += Math.abs(original - current);
      driftCount++;
    }
    const authority_drift = driftCount > 0 ? parseFloat((driftSum / driftCount).toFixed(3)) : 0.0;

    // 3. Flapping
    let event_flapping = false;
    const now = Date.now();
    for (const transitions of this.stateTransitions.values()) {
      const recent = transitions.filter(t => now - t.timestamp < 180000);
      if (recent.length >= 3) {
        event_flapping = true;
        break;
      }
    }

    // 4. Decision consistency
    let decision_consistency = 1.0;
    if (this.registeredDecisions.length > 0) {
      const recs = this.registeredDecisions.flatMap(d => d.recommendation);
      const isEvac = recs.some(r => r.includes("EVACUACIÓN"));
      const isPassive = recs.some(r => r.includes("guardia técnica pasiva"));
      if (isEvac && isPassive) {
        decision_consistency -= 0.15; // penalty for contradiction
      }

      const eventIds = this.registeredDecisions.map(d => d.event_id);
      const dups = eventIds.length - new Set(eventIds).size;
      if (dups > 0) {
        decision_consistency -= 0.10 * dups; // penalty for duplication
      }
    }
    decision_consistency = Math.max(0.60, decision_consistency);

    // 5. Score summation: base allocation is 0.25 for each
    const consistency = Math.max(0.05, 0.25 - iri_volatility * 0.4);
    
    const healthRegistry = GeointReliabilityEngine.getAllProviderHealths();
    const degradedProviders = Object.values(healthRegistry).filter(h => h.confidence_score < 60).length;
    const resilience = Math.max(0.05, 0.25 - degradedProviders * 0.04);

    const coherence = Math.max(0.05, 0.25 - (event_flapping ? 0.12 : 0.0) - (1.0 - decision_consistency) * 0.12);

    let fallbackEffectiveness = 0.25;
    if (this.stressMode !== "NONE" && this.fallbackExecutionCount === 0) {
      fallbackEffectiveness -= 0.06;
    }

    const stability_score = parseFloat(
      Math.min(1.0, Math.max(0.0, consistency + resilience + coherence + fallbackEffectiveness)).toFixed(3)
    );

    return {
      stability_score,
      iri_volatility,
      authority_drift,
      event_flapping,
      decision_consistency: parseFloat(decision_consistency.toFixed(3))
    };
  }

  // Resets for test execution
  public resetHistory(): void {
    this.iriHistory.clear();
    this.stateTransitions.clear();
    this.registeredDecisions = [];
    this.fallbackExecutionCount = 0;
    this.stressMode = "NONE";
    this.dataLossSeverity = 0.0;
    this.osintOverloadMultiplier = 1.0;
    this.conflictingSignalsActive = false;
    for (const [providerId, original] of this.originalAuthorities.entries()) {
      GLOBAL_AUTHORITY_MATRIX[providerId].authorityScore = original;
    }
  }
}

export default PilotValidationEngine;
