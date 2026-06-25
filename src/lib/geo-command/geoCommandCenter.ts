import { GeoDecision } from "../iri/decision/geoDecisionEngine";
import { GeoAction, GeoActionOrchestrator } from "../iri/actions/geoActionOrchestrator";

export interface CommandOperation {
  operation_id: string;
  decision_id: string;
  action_id: string;
  state: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXECUTED" | "CANCELLED";
  approver?: string;
  timestamp: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  metadata: Record<string, any>;
}

export type SystemState = "OPERATIONAL" | "DEGRADED" | "ALERT" | "EMERGENCY";

export interface SystemHealth {
  state: SystemState;
  active_events_count: number;
  pending_approvals_count: number;
  provider_latency_ms: number;
  stream_status: "CONNECTED" | "DISCONNECTED" | "BUFFERING";
  timestamp: string;
}

export class GeoCommandCenter {
  private static operationsCache: Map<string, CommandOperation> = new Map();
  private static globalSystemState: SystemState = "OPERATIONAL";
  private static commandAuditTrail: any[] = [];
  
  // Configuration for RESPOND (HIGH risk) approval requirement
  private static requireRespondApproval = true;

  static {
    // Pre-populate OP-001 corresponding to the default high-risk DEC-001 / EVT-MOCK-001 decision
    const op001: CommandOperation = {
      operation_id: "OP-001",
      decision_id: "DEC-001",
      action_id: "ACT-EVT-MOCK-001-ALERT-001", // Mapped to primary critical alert
      state: "PENDING_APPROVAL",
      timestamp: new Date().toISOString(),
      risk_level: "CRITICAL",
      metadata: {
        event_id: "EVT-MOCK-001",
        description: "🚨 ALERTA ROJA - EVACUACIÓN GEOINT",
        ops_score: 0.85,
        target_authority: "CIVIL_PROTECTION",
        notes: "Requires mandatory Human-in-the-Loop (HITL) approval prior to execution simulation."
      }
    };

    // Pre-populate OP-002 corresponding to the moderate-risk DEC-002 / EVT-MOCK-002 decision
    const op002: CommandOperation = {
      operation_id: "OP-002",
      decision_id: "DEC-002",
      action_id: "ACT-EVT-MOCK-002-RES-002",
      state: "PENDING_APPROVAL",
      timestamp: new Date().toISOString(),
      risk_level: "HIGH",
      metadata: {
        event_id: "EVT-MOCK-002",
        description: "⚠️ BOLETÍN DE EMERGENCIA ESTATAL",
        ops_score: 0.55,
        target_authority: "STATE_AUTHORITY",
        notes: "Requires validation (configured as high risk respond approval)."
      }
    };

    this.operationsCache.set("OP-001", op001);
    this.operationsCache.set("OP-002", op002);
  }

  /**
   * Resets the persistent in-memory states (useful for isolated unit testing)
   */
  public static clearState(): void {
    this.operationsCache.clear();
    this.globalSystemState = "OPERATIONAL";
    this.commandAuditTrail = [];
  }

  /**
   * Sets the global system state
   */
  public static setSystemState(state: SystemState): void {
    this.globalSystemState = state;
    console.log(`[GEOINT_COMMAND_SYSTEM] Global system state transition -> ${state}`);
  }

  /**
   * Retrieves the current global system state
   */
  public static getSystemState(): SystemState {
    return this.globalSystemState;
  }

  /**
   * Configures respond/high-risk approval requirement toggle
   */
  public static setRespondApprovalToggle(require: boolean): void {
    this.requireRespondApproval = require;
  }

  /**
   * Retrieves a command operation by its ID
   */
  public static getOperation(operationId: string): CommandOperation | undefined {
    return this.operationsCache.get(operationId);
  }

  /**
   * Retrieves all command operations in cache
   */
  public static getOperations(): CommandOperation[] {
    return Array.from(this.operationsCache.values());
  }

  /**
   * Retrieves the command audit trail logs
   */
  public static getAuditTrail(): any[] {
    return this.commandAuditTrail;
  }

  /**
   * Maps a decision and a set of generated actions to corresponding command operations
   */
  public registerActionsAsOperations(decision: GeoDecision, actions: GeoAction[]): CommandOperation[] {
    const ops: CommandOperation[] = [];

    // Map decision classification to Command Risk Level
    let riskLevel: CommandOperation["risk_level"] = "LOW";
    if (decision.classification === "CRITICAL_RESPONSE") {
      riskLevel = "CRITICAL";
    } else if (decision.classification === "RESPOND") {
      riskLevel = "HIGH";
    } else if (decision.classification === "PREVENT") {
      riskLevel = "MEDIUM";
    }

    actions.forEach(action => {
      const operationId = `OP-${action.action_id.replace("ACT-", "")}`;
      
      // Determine initial state based on Human-in-the-Loop (HITL) approval rules:
      // - CRITICAL_RESPONSE -> Mandatory approval ("PENDING_APPROVAL")
      // - RESPOND -> Configurable approval (Default: "PENDING_APPROVAL")
      // - PREVENT -> Automatic ("APPROVED")
      // - MONITOR -> Automatic ("APPROVED")
      let initialState: CommandOperation["state"] = "APPROVED";
      
      if (riskLevel === "CRITICAL") {
        initialState = "PENDING_APPROVAL";
      } else if (riskLevel === "HIGH" && GeoCommandCenter.requireRespondApproval) {
        initialState = "PENDING_APPROVAL";
      }

      const op: CommandOperation = {
        operation_id: operationId,
        decision_id: action.decision_id,
        action_id: action.action_id,
        state: initialState,
        timestamp: new Date().toISOString(),
        risk_level: riskLevel,
        metadata: {
          event_id: decision.event_id,
          classification: decision.classification,
          ops_score: decision.ops_score,
          target_authority: action.target,
          action_type: action.type,
          payload: action.payload,
          automatic_dispatch: initialState === "APPROVED"
        }
      };

      GeoCommandCenter.operationsCache.set(operationId, op);
      ops.push(op);

      // Log initial operational registration
      console.log(`[GEOINT_COMMAND_REGISTRATION] Op ID: ${op.operation_id} | Risk: ${op.risk_level} | Initial State: ${op.state}`);
    });

    // Update global system state dynamically based on risk hierarchy
    this.updateGlobalStateFromOperations();

    return ops;
  }

  /**
   * Evaluates and updates the global system state based on currently pending critical actions
   */
  private updateGlobalStateFromOperations(): void {
    const ops = Array.from(GeoCommandCenter.operationsCache.values());
    const hasCriticalPending = ops.some(o => o.risk_level === "CRITICAL" && o.state === "PENDING_APPROVAL");
    const hasHighPending = ops.some(o => o.risk_level === "HIGH" && o.state === "PENDING_APPROVAL");

    if (hasCriticalPending) {
      GeoCommandCenter.globalSystemState = "EMERGENCY";
    } else if (hasHighPending) {
      GeoCommandCenter.globalSystemState = "ALERT";
    } else {
      GeoCommandCenter.globalSystemState = "OPERATIONAL";
    }
  }

  /**
   * Executes or Simulates the Command Approval/Rejection action (HITL Layer)
   */
  public processCommandApproval(
    operationId: string,
    approve: boolean,
    approver = "OPERATOR-01",
    dryRun = true
  ): { success: boolean; operation?: CommandOperation; error?: string; audit_id?: string; feedback?: any } {
    const op = GeoCommandCenter.operationsCache.get(operationId);

    if (!op) {
      return { success: false, error: `Operation ID '${operationId}' not found in Command cache.` };
    }

    if (op.state !== "PENDING_APPROVAL") {
      return { success: false, error: `Operation is already in '${op.state}' state. Cannot re-process.` };
    }

    const previousState = op.state;
    const baseTimestamp = new Date().toISOString();

    if (approve) {
      op.state = "APPROVED";
      op.approver = approver;
      op.timestamp = baseTimestamp;

      // Log intermediate approval
      console.log(`[GEOINT_HITL_APPROVAL] Op ID ${op.operation_id} APPROVED by ${approver}. Mapped execution proceeding...`);

      // Execute the action simulation using action status toggles (respecting security limits)
      const executionResult = this.dispatchOperationalAction(op, dryRun);
      
      if (executionResult.success) {
        op.state = "EXECUTED";
        op.metadata.execution_mode = dryRun ? "DRY_RUN" : "LIVE_SIMULATED";
        op.metadata.execution_details = executionResult.details;
      } else {
        op.state = "PENDING_APPROVAL"; // Rollback to pending on fail
        return { success: false, error: `Execution failure: ${executionResult.error}` };
      }
    } else {
      op.state = "REJECTED";
      op.approver = approver;
      op.timestamp = baseTimestamp;
      op.metadata.rejection_reason = "Human-in-the-loop manual override rejection.";

      console.warn(`[GEOINT_HITL_REJECTION] Op ID ${op.operation_id} REJECTED by ${approver}. Execution canceled.`);
    }

    // Update global states after changes
    this.updateGlobalStateFromOperations();

    // Generate Audit Trail Entry
    const auditEntry = this.logCommandAudit(op, previousState, approve, approver, dryRun);

    // Compute feedback loop evaluation metrics
    const feedback = this.generateFeedbackLoop(op, approve);

    return {
      success: true,
      operation: op,
      audit_id: auditEntry.audit_id,
      feedback
    };
  }

  /**
   * Internal dispatcher representing physical/simulated execution
   */
  private dispatchOperationalAction(op: CommandOperation, dryRun: boolean): { success: boolean; details?: string; error?: string } {
    // Secure simulation mode as mandated by guidelines
    if (dryRun) {
      return {
        success: true,
        details: `Dry-run execution simulated successfully for ${op.metadata.target_authority}. Action state kept in dry run status.`
      };
    } else {
      // Live simulated execution (no real external webhook dispatch, fully compliant with security rules)
      return {
        success: true,
        details: `Simulated live dispatch successfully completed. Event notification triggered over virtual ${op.metadata.target_authority} secure gateway.`
      };
    }
  }

  /**
   * Records operational execution events inside the command audit logs
   */
  private logCommandAudit(
    op: CommandOperation,
    previousState: string,
    isApproved: boolean,
    approver: string,
    dryRun: boolean
  ): any {
    const entry = {
      audit_id: `AUD-CMD-${op.operation_id}-${Date.now().toString().slice(-4)}`,
      operation_id: op.operation_id,
      decision_id: op.decision_id,
      action_id: op.action_id,
      previous_state: previousState,
      new_state: op.state,
      approver,
      risk_level: op.risk_level,
      is_approved: isApproved,
      dry_run: dryRun,
      timestamp: new Date().toISOString(),
      details: isApproved
        ? `Manual operational execution ${dryRun ? "simulated in DRY_RUN" : "processed in LIVE_SIM"} after operator validation.`
        : `Manual override rejection. Action execution withheld.`
    };

    GeoCommandCenter.commandAuditTrail.push(entry);

    // Console printer
    console.log(`[GEOINT_COMMAND_AUDIT]`);
    console.log(`  Audit ID:          ${entry.audit_id}`);
    console.log(`  Operation ID:      ${entry.operation_id}`);
    console.log(`  Action ID:         ${entry.action_id}`);
    console.log(`  Decision ID:       ${entry.decision_id}`);
    console.log(`  Risk Level:        ${entry.risk_level}`);
    console.log(`  Operator Approver: ${entry.approver}`);
    console.log(`  Approval Verdict:  ${entry.is_approved ? "APPROVED" : "REJECTED"}`);
    console.log(`  New State:         ${entry.new_state}`);
    console.log(`  Execution Mode:    ${entry.dry_run ? "DRY_RUN" : "LIVE_SIMULATED"}`);
    console.log(`  Log Details:       ${entry.details}`);
    console.log(`--------------------------------------------------------------------------------`);

    return entry;
  }

  /**
   * FEEDBACK LOOP (OBLIGATORY)
   * 
   * Evaluates post-execution telemetry against IRI calculations to suggest OPS parameter tuning
   */
  public generateFeedbackLoop(op: CommandOperation, approved: boolean): Record<string, any> {
    if (!approved || op.state !== "EXECUTED") {
      return {
        message: "No feedback computed. Operation was rejected or is not executed.",
        computed: false
      };
    }

    const opsScore = op.metadata.ops_score || 0.50;
    
    // Simulate real-world sensor validation delta (typically +/- 5% variance)
    const simulatedGroundTruthIri = Math.min(1.0, Math.max(0.0, opsScore + (Math.random() * 0.1 - 0.05)));
    const variance = simulatedGroundTruthIri - opsScore;
    const precisionPct = (1 - Math.abs(variance)) * 100;

    // Suggest tuning actions based on variance:
    // - If variance is positive, we under-estimated impact -> Suggest increasing weights
    // - If variance is negative, we over-estimated impact -> Suggest decreasing weights
    let suggestedOpsTuning = "OPS parameters are optimal for this cell layout.";
    if (Math.abs(variance) > 0.03) {
      if (variance > 0) {
        suggestedOpsTuning = "⚠️ UNDERESTIMATION DETECTED: Suggest increasing PopulationImpact weight from 0.30 to 0.33 to compensate for housing density.";
      } else {
        suggestedOpsTuning = "🔍 OVERESTIMATION DETECTED: Suggest reducing AccessibilityRisk weight from 0.10 to 0.08 to account for local elevation structures.";
      }
    }

    const feedback = {
      computed: true,
      ops_estimated_score: Number(opsScore.toFixed(3)),
      simulated_ground_truth_iri: Number(simulatedGroundTruthIri.toFixed(3)),
      mathematical_variance: Number(variance.toFixed(4)),
      system_precision_percentage: Number(precisionPct.toFixed(2)),
      suggested_ops_tuning: suggestedOpsTuning,
      timestamp: new Date().toISOString()
    };

    // Print Feedback trace
    console.log(`[GEOINT_FEEDBACK_LOOP]`);
    console.log(`  Operation ID:      ${op.operation_id}`);
    console.log(`  Estimated OPS:     ${feedback.ops_estimated_score}`);
    console.log(`  Ground Truth IRI:  ${feedback.simulated_ground_truth_iri}`);
    console.log(`  Variance Delta:    ${feedback.mathematical_variance}`);
    console.log(`  Calculated Accuracy: ${feedback.system_precision_percentage}%`);
    console.log(`  Ops Tuning Advice: ${feedback.suggested_ops_tuning}`);
    console.log(`--------------------------------------------------------------------------------`);

    return feedback;
  }

  /**
   * Generates global operational command dashboard state summary
   */
  public generateDashboardSummary(): SystemHealth {
    const ops = Array.from(GeoCommandCenter.operationsCache.values());
    
    const active_events_count = Array.from(new Set(ops.map(o => o.metadata.event_id).filter(Boolean))).length;
    const pending_approvals_count = ops.filter(o => o.state === "PENDING_APPROVAL").length;

    return {
      state: GeoCommandCenter.globalSystemState,
      active_events_count,
      pending_approvals_count,
      provider_latency_ms: 35 + Math.floor(Math.random() * 25), // Simulating extremely fast provider connectivity
      stream_status: "CONNECTED",
      timestamp: new Date().toISOString()
    };
  }
}
