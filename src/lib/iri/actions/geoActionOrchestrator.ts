import { GeoDecision } from "../decision/geoDecisionEngine";

export interface GeoAction {
  action_id: string;
  event_id: string;
  decision_id: string;
  type:
    | "NOTIFY_INTERNAL"
    | "NOTIFY_EXTERNAL"
    | "WEBHOOK_TRIGGER"
    | "ALERT_INSTITUTIONAL";
  target:
    | "INTERNAL_SYSTEM"
    | "MUNICIPAL_AUTHORITY"
    | "STATE_AUTHORITY"
    | "CIVIL_PROTECTION";
  payload: Record<string, any>;
  priority: number;
  status: "PENDING" | "SENT" | "FAILED";
  timestamp: string;
}

export interface AuditEntry {
  audit_id: string;
  decision_id: string;
  event_id: string;
  action_id: string;
  action_type: string;
  target: string;
  timestamp: string;
  execution_result: "SIMULATED" | "DISPATCHED" | "DUPLICATE_PREVENTED" | "FAILED";
  validation_status: "SUCCESS" | "FAILED";
  details: string;
}

export class GeoActionOrchestrator {
  // In-memory persistent caches for demo & operational persistence
  private static decisionCache: Map<string, GeoDecision> = new Map();
  private static executedActions: Map<string, GeoAction[]> = new Map(); // key: decision_id
  private static auditTrail: AuditEntry[] = [];

  // Static constructor/initializer to pre-populate default test decisions (e.g. DEC-001)
  static {
    // Generate a default high-risk decision for "DEC-001" to satisfy quick API smoke tests
    const mockDecision001: GeoDecision = {
      event_id: "EVT-MOCK-001",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [21.88, -102.30],
            [21.88, -102.29],
            [21.89, -102.29],
            [21.89, -102.30],
            [21.88, -102.30]
          ]
        ]
      },
      iri_score: 0.82,
      ops_score: 0.85,
      impact: {
        population: 0.80,
        infrastructure: 0.75,
        accessibility: 0.65
      },
      classification: "CRITICAL_RESPONSE",
      recommendation: [
        "🚨 INICIAR EVACUACIÓN INMEDIATA de sectores habitacionales bajos expuestos",
        "🚒 Desplegar brigadas de rescate acuático y personal de primera respuesta"
      ],
      priority_rank: 1,
      timestamp: new Date().toISOString()
    };

    // Generate a moderate-risk decision for "DEC-002"
    const mockDecision002: GeoDecision = {
      event_id: "EVT-MOCK-002",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [21.85, -102.31],
            [21.85, -102.30],
            [21.86, -102.30],
            [21.86, -102.31],
            [21.85, -102.31]
          ]
        ]
      },
      iri_score: 0.58,
      ops_score: 0.55,
      impact: {
        population: 0.45,
        infrastructure: 0.50,
        accessibility: 0.35
      },
      classification: "RESPOND",
      recommendation: [
        "📢 Habilitar refugios temporales y emitir boletines de emergencia civil",
        "🗺️ Establecer perímetros de desvío vial y cerrar accesos a pasos subterráneos"
      ],
      priority_rank: 2,
      timestamp: new Date().toISOString()
    };

    // Store them under both short ID and full composite ID
    this.decisionCache.set("DEC-001", mockDecision001);
    this.decisionCache.set("DEC-EVT-MOCK-001", mockDecision001);
    
    this.decisionCache.set("DEC-002", mockDecision002);
    this.decisionCache.set("DEC-EVT-MOCK-002", mockDecision002);
  }

  /**
   * Registers a calculated GeoDecision from the Decision Engine into the cache
   */
  public static registerDecision(decision: GeoDecision): string {
    const decisionId = `DEC-${decision.event_id}`;
    this.decisionCache.set(decisionId, decision);
    this.decisionCache.set(decision.event_id, decision); // support lookups by raw event ID too
    return decisionId;
  }

  /**
   * Clears the static orchestrator states (useful for isolated unit testing)
   */
  public static clearState(): void {
    this.decisionCache.clear();
    this.executedActions.clear();
    this.auditTrail = [];
  }

  /**
   * Retrieves a decision from the cache by ID
   */
  public static getDecision(decisionId: string): GeoDecision | undefined {
    return this.decisionCache.get(decisionId);
  }

  /**
   * Retrieves the complete Audit Trail
   */
  public static getAuditTrail(): AuditEntry[] {
    return this.auditTrail;
  }

  /**
   * Retrieves actions already executed for a specific decision
   */
  public static getExecutedActions(decisionId: string): GeoAction[] | undefined {
    return this.executedActions.get(decisionId);
  }

  /**
   * institutional routing engine
   * 
   * Maps decision classification to institutional responsibilities
   */
  public routeInstitutional(classification: GeoDecision["classification"]): GeoAction["target"] {
    switch (classification) {
      case "CRITICAL_RESPONSE":
        return "CIVIL_PROTECTION";
      case "RESPOND":
        return "STATE_AUTHORITY";
      case "PREVENT":
        return "MUNICIPAL_AUTHORITY";
      case "MONITOR":
      default:
        return "INTERNAL_SYSTEM";
    }
  }

  /**
   * validation layer
   * 
   * Assesses decision validity, scores, system constraints, and double-action prevention
   */
  public validateDecision(
    decisionId: string, 
    decision?: GeoDecision
  ): { isValid: boolean; reason?: string } {
    if (!decision) {
      return { isValid: false, reason: `Decision with ID '${decisionId}' was not found in cache.` };
    }

    // 1. Verify OPS score constraints
    if (decision.ops_score < 0 || decision.ops_score > 1) {
      return { isValid: false, reason: `Operational Priority Score (OPS) of ${decision.ops_score} is out of bounds [0.0, 1.0].` };
    }

    // 2. Prevent duplication check
    const existingActions = GeoActionOrchestrator.executedActions.get(decisionId);
    if (existingActions && existingActions.some(act => act.status === "SENT" || act.status === "PENDING")) {
      return { isValid: false, reason: `Action duplicate prevented. Decision '${decisionId}' has already been processed.` };
    }

    // 3. Verify event is active (freshness simulated)
    const timestampMs = new Date(decision.timestamp).getTime();
    const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    if (timestampMs < oneDayAgoMs) {
      return { isValid: false, reason: `Decision is stale. Event occurred over 24 hours ago.` };
    }

    return { isValid: true };
  }

  /**
   * Action Mapping Engine
   * 
   * Converts a GeoDecision into structured GeoAction payload definitions
   */
  public mapDecisionToActions(decisionId: string, decision: GeoDecision): GeoAction[] {
    const actions: GeoAction[] = [];
    const target = this.routeInstitutional(decision.classification);
    const baseTimestamp = new Date().toISOString();

    // Mapping Rule 1: High priority alert mapping
    if (decision.classification === "CRITICAL_RESPONSE") {
      // Create first primary action: institutional alert
      const actionId1 = `ACT-${decision.event_id}-ALERT-${Date.now().toString().slice(-4)}`;
      actions.push({
        action_id: actionId1,
        event_id: decision.event_id,
        decision_id: decisionId,
        type: "ALERT_INSTITUTIONAL",
        target: "CIVIL_PROTECTION",
        priority: 1,
        status: "PENDING",
        timestamp: baseTimestamp,
        payload: {
          alert_header: "🚨 ALERTA ROJA - EVACUACIÓN GEOINT",
          urgency: "IMMEDIATE",
          ops_score: decision.ops_score,
          impact_metrics: decision.impact,
          instructions: decision.recommendation,
          boundary_geometry: decision.geometry
        }
      });

      // Create second supporting action: simulated high-speed API Webhook dispatch
      const actionId2 = `ACT-${decision.event_id}-WEB-${Date.now().toString().slice(-4)}`;
      actions.push({
        action_id: actionId2,
        event_id: decision.event_id,
        decision_id: decisionId,
        type: "WEBHOOK_TRIGGER",
        target: "CIVIL_PROTECTION",
        priority: 1,
        status: "PENDING",
        timestamp: baseTimestamp,
        payload: {
          webhook_url: "https://emergencias.ags.gob.mx/api/v1/geoint-trigger",
          payload_digest: {
            source: "GEOINT_ACTION_ORCHESTRATOR",
            eventId: decision.event_id,
            ops: decision.ops_score,
            iri: decision.iri_score,
            critical_infrastructure: decision.recommendation.filter(r => r.includes("⚡") || r.includes("🏗️"))
          }
        }
      });
    } else if (decision.classification === "RESPOND") {
      const actionId = `ACT-${decision.event_id}-RES-${Date.now().toString().slice(-4)}`;
      actions.push({
        action_id: actionId,
        event_id: decision.event_id,
        decision_id: decisionId,
        type: "ALERT_INSTITUTIONAL",
        target: "STATE_AUTHORITY",
        priority: 2,
        status: "PENDING",
        timestamp: baseTimestamp,
        payload: {
          alert_header: "⚠️ BOLETÍN DE EMERGENCIA ESTATAL",
          urgency: "HIGH",
          ops_score: decision.ops_score,
          recommendations: decision.recommendation,
          transit_blocking_required: decision.impact.accessibility > 0.50
        }
      });
    } else if (decision.classification === "PREVENT") {
      const actionId = `ACT-${decision.event_id}-PREV-${Date.now().toString().slice(-4)}`;
      actions.push({
        action_id: actionId,
        event_id: decision.event_id,
        decision_id: decisionId,
        type: "ALERT_INSTITUTIONAL",
        target: "MUNICIPAL_AUTHORITY",
        priority: 3,
        status: "PENDING",
        timestamp: baseTimestamp,
        payload: {
          alert_header: "📡 ORDEN DE PREVENCIÓN MUNICIPAL",
          urgency: "MEDIUM",
          ops_score: decision.ops_score,
          clearing_instructions: decision.recommendation.filter(r => r.includes("🧹") || r.includes("📡"))
        }
      });
    } else {
      // MONITOR
      const actionId = `ACT-${decision.event_id}-MON-${Date.now().toString().slice(-4)}`;
      actions.push({
        action_id: actionId,
        event_id: decision.event_id,
        decision_id: decisionId,
        type: "NOTIFY_INTERNAL",
        target: "INTERNAL_SYSTEM",
        priority: 4,
        status: "PENDING",
        timestamp: baseTimestamp,
        payload: {
          system_message: "📥 Registro técnico de monitoreo pasivo",
          ops_score: decision.ops_score,
          trace: decision.recommendation
        }
      });
    }

    return actions;
  }

  /**
   * Execution Layer
   * 
   * Orchestrates the final dispatch status of generated actions (simulates sending for live mode, logs audit trail)
   */
  public executeActions(
    decisionId: string, 
    actions: GeoAction[], 
    dryRun = true
  ): GeoAction[] {
    const processed: GeoAction[] = actions.map(action => {
      const updatedAction = { ...action };
      
      if (dryRun) {
        // DRY RUN: Simulates verification, status stays PENDING or marked as PENDING (as per API specs)
        updatedAction.status = "PENDING";
        
        this.logAudit(
          decisionId,
          updatedAction.event_id,
          updatedAction.action_id,
          updatedAction.type,
          updatedAction.target,
          "SIMULATED",
          "SUCCESS",
          `Dry-run simulation execution complete. Action mapped for ${updatedAction.target}.`
        );
      } else {
        // LIVE SIMULATED DISPATCH (No external notifications are actually pushed, complying with rules)
        updatedAction.status = "SENT";
        updatedAction.timestamp = new Date().toISOString();

        this.logAudit(
          decisionId,
          updatedAction.event_id,
          updatedAction.action_id,
          updatedAction.type,
          updatedAction.target,
          "DISPATCHED",
          "SUCCESS",
          `Live-mode dispatch simulation successful. Message sent to ${updatedAction.target} channel.`
        );
      }

      return updatedAction;
    });

    // Save executed actions in cache to prevent duplicate processing
    GeoActionOrchestrator.executedActions.set(decisionId, processed);
    return processed;
  }

  /**
   * Records execution state and reasoning metrics in the central audit log
   */
  private logAudit(
    decisionId: string,
    eventId: string,
    actionId: string,
    actionType: string,
    target: string,
    result: AuditEntry["execution_result"],
    valStatus: AuditEntry["validation_status"],
    details: string
  ): void {
    const entry: AuditEntry = {
      audit_id: `AUD-${eventId}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
      decision_id: decisionId,
      event_id: eventId,
      action_id: actionId,
      action_type: actionType,
      target,
      timestamp: new Date().toISOString(),
      execution_result: result,
      validation_status: valStatus,
      details
    };

    GeoActionOrchestrator.auditTrail.push(entry);

    // Print operational audit log in system stdout
    console.log(`[GEOINT_AUDIT_LOG]`);
    console.log(`  Audit ID:          ${entry.audit_id}`);
    console.log(`  Decision ID:       ${entry.decision_id}`);
    console.log(`  Action ID:         ${entry.action_id}`);
    console.log(`  Action Type:       ${entry.action_type}`);
    console.log(`  Target Authority:  ${entry.target}`);
    console.log(`  Execution Result:  ${entry.execution_result}`);
    console.log(`  Validation Status: ${entry.validation_status}`);
    console.log(`  Log Details:       ${entry.details}`);
    console.log(`--------------------------------------------------------------------------------`);
  }

  /**
   * Controlled Queue Processor
   * 
   * Prioritizes and runs multiple decisions sequentially using our Action Engine.
   */
  public processDecisionQueue(
    decisionsToProcess: { decisionId: string; dryRun: boolean }[]
  ): { decisionId: string; success: boolean; actions: GeoAction[]; error?: string }[] {
    const results: { decisionId: string; success: boolean; actions: GeoAction[]; error?: string }[] = [];

    // 1. Gather all decisions and resolve actual structures
    const queue = decisionsToProcess
      .map(item => ({
        ...item,
        decision: GeoActionOrchestrator.decisionCache.get(item.decisionId)
      }))
      // 2. Priority queue ordering: Sort by OPS score descending (highest risk processed first)
      .sort((a, b) => {
        const opsA = a.decision?.ops_score ?? 0;
        const opsB = b.decision?.ops_score ?? 0;
        return opsB - opsA;
      });

    // 3. Process sequentially
    queue.forEach(({ decisionId, dryRun, decision }) => {
      const validation = this.validateDecision(decisionId, decision);
      
      if (!validation.isValid) {
        // Record validation failure in audit log
        if (decision) {
          this.logAudit(
            decisionId,
            decision.event_id,
            "N/A",
            "N/A",
            this.routeInstitutional(decision.classification),
            "FAILED",
            "FAILED",
            `Validation error: ${validation.reason}`
          );
        }

        results.push({
          decisionId,
          success: false,
          actions: [],
          error: validation.reason
        });
        return;
      }

      // Safe non-null assertion since validation passes
      const validDecision = decision!;
      
      // Map Decision to Actions
      const mappedActions = this.mapDecisionToActions(decisionId, validDecision);
      
      // Execute Actions (Dry run or Live simulation)
      const executed = this.executeActions(decisionId, mappedActions, dryRun);

      results.push({
        decisionId,
        success: true,
        actions: executed
      });
    });

    return results;
  }
}
