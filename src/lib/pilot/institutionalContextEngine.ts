import { GeointPilotController } from "./geointPilotController";
import { GeoDecision } from "../iri/decision/geoDecisionEngine";

export enum OperationalTier {
  TIER_1 = "TIER_1_OBSERVATION_AND_ANALYSIS",
  TIER_2 = "TIER_2_OPERATIONAL_MONITORING",
  TIER_3 = "TIER_3_ASSISTED_DECISION_HITL",
  TIER_4 = "TIER_4_SUPERVISED_INSTITUTIONAL_RESPONSE"
}

export interface InstitutionalModeConfig {
  mode: "INSTITUTIONAL";
  hitl_required: boolean;
  audit_required: boolean;
  auto_execution: boolean;
  traceability: "full";
}

export interface InstitutionalAuditEntry {
  audit_id: string;
  event_id: string;
  decision: string;
  actor: "human" | "system";
  timestamp: string;
  justification: string;
  source_trace: string[];
}

export class InstitutionalContextEngine {
  private static instance: InstitutionalContextEngine | null = null;

  private jurisdiction = "ESTADO_DE_AGUASCALIENTES_MX";
  private operationalLevel = "ESTATAL_PROTECCION_CIVIL";
  private useType = "MONITOREO_Y_ALERTA_TEMPRANA_DE_INUNDACIONES";
  private currentTier: OperationalTier = OperationalTier.TIER_3; // Default Tier 3 (Decisión asistida / HITL)
  
  private config: InstitutionalModeConfig = {
    mode: "INSTITUTIONAL",
    hitl_required: true,
    audit_required: true,
    auto_execution: false, // Strict block on automatic dispatch for critical actions
    traceability: "full"
  };

  // Static/In-Memory Institutional Audit Trail Log
  private static auditTrail: Map<string, InstitutionalAuditEntry> = new Map();

  private constructor() {
    this.seedDefaultAuditTrail();
  }

  public static getInstance(): InstitutionalContextEngine {
    if (!InstitutionalContextEngine.instance) {
      InstitutionalContextEngine.instance = new InstitutionalContextEngine();
    }
    return InstitutionalContextEngine.instance;
  }

  public getContext() {
    return {
      jurisdiction: this.jurisdiction,
      operational_level: this.operationalLevel,
      use_type: this.useType,
      tier: this.currentTier,
      config: this.config
    };
  }

  /**
   * Retrieves the formalized institutional status output (inst_005 schema).
   */
  public getInstitutionalStatus() {
    return {
      system_mode: "INSTITUTIONAL",
      operational_tier: 3, // Tier 3 is the active operational standard for HITL
      decision_flow: "HITL_CONTROLLED",
      audit_status: "ACTIVE",
      risk_compliance: "ENFORCED"
    };
  }

  /**
   * Log an event, action, or decision to the formal institutional Audit Trail.
   */
  public logAudit(
    eventId: string,
    decision: string,
    actor: "human" | "system",
    justification: string,
    sourceTrace: string[]
  ): InstitutionalAuditEntry {
    const auditId = `AUD-INST-${eventId.replace("EVT-", "")}-${Date.now().toString().slice(-6)}`;
    const entry: InstitutionalAuditEntry = {
      audit_id: auditId,
      event_id: eventId,
      decision,
      actor,
      timestamp: new Date().toISOString(),
      justification,
      source_trace: sourceTrace
    };

    InstitutionalContextEngine.auditTrail.set(auditId, entry);
    console.log(`[INSTITUTIONAL_AUDIT] Entry ${auditId} registered. Actor: ${actor} | Event: ${eventId}`);
    return entry;
  }

  /**
   * Retrieves all institutional audit trails in reverse chronological order.
   */
  public getAuditTrail(): InstitutionalAuditEntry[] {
    return Array.from(InstitutionalContextEngine.auditTrail.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Evaluates the Governance Rule:
   * System suggests -> Human Approves -> System Executes -> Audit Records
   */
  public processInstitutionalDecision(
    decision: GeoDecision,
    humanApproved: boolean,
    humanActor: string,
    justification: string
  ): {
    status: "APPROVED" | "REJECTED" | "HOLD" | "DENIED_AUTO_EXECUTION";
    message: string;
    audit_record?: InstitutionalAuditEntry;
  } {
    // SECURITY RULE: AUTO-EXECUTION BLOCKED FOR CRITICAL
    if (decision.classification === "CRITICAL_RESPONSE" && !humanApproved) {
      const msg = `[GOVERNANCE_VIOLATION_BLOCKED] Attempted automatic execution of CRITICAL response for event ${decision.event_id} blocked. Human in the Loop (HITL) approval is mandatory under INSTITUTIONAL rules.`;
      console.warn(msg);
      
      const record = this.logAudit(
        decision.event_id,
        `Proposición de acción crítica: ${decision.recommendation.join(", ")}`,
        "system",
        "AUTO-EXECUTION BLOCKED: System flagged critical response requiring immediate human approval.",
        ["iri_engine", "decision_engine"]
      );

      return {
        status: "DENIED_AUTO_EXECUTION",
        message: msg,
        audit_record: record
      };
    }

    if (humanApproved) {
      const msg = `[HITL_APPROVED] Decision for event ${decision.event_id} approved by ${humanActor}.`;
      console.log(msg);

      const record = this.logAudit(
        decision.event_id,
        `Aprobación de Respuesta Operativa: ${decision.recommendation.join(", ")}`,
        "human",
        justification || `Acción validada por operador institucional (${humanActor}) según protocolos estándar.`,
        ["iri_engine", "decision_engine", "human_authorizer"]
      );

      // Trigger intercept in pilot controller to align status
      const controller = GeointPilotController.getInstance();
      try {
        controller.resolveHITLAction(decision.event_id, "APPROVE");
      } catch (e) {
        // Safe fallback if not found in queue
      }

      return {
        status: "APPROVED",
        message: msg,
        audit_record: record
      };
    } else {
      const msg = `[HITL_REJECTED] Decision for event ${decision.event_id} rejected or put on hold.`;
      console.log(msg);

      const record = this.logAudit(
        decision.event_id,
        `Rechazo / Retención de Respuesta Operativa`,
        "human",
        justification || "Rechazado por operador técnico o fuera de jurisdicción.",
        ["iri_engine", "decision_engine", "human_authorizer"]
      );

      return {
        status: "REJECTED",
        message: msg,
        audit_record: record
      };
    }
  }

  private seedDefaultAuditTrail() {
    if (InstitutionalContextEngine.auditTrail.size === 0) {
      this.logAudit(
        "EVT-PILOT-001",
        "Aprobación de Evacuación de Río San Pedro (Sección Norte)",
        "human",
        "Se aprueba la evacuación preventiva de las zonas bajas de Río San Pedro debido a coincidencia de alertas pluviales en NOAA y CONAGUA.",
        ["noaa", "conagua", "human_operator_pc"]
      );

      this.logAudit(
        "EVT-PILOT-004",
        "Activación de Alerta de Almacenamiento Crítico en Presa Plutarco Elías Calles",
        "human",
        "Se ratifica el plan de desvío e incremento de patrullaje preventivo en las inmediaciones de la cortina.",
        ["conagua", "cenapred", "human_operator_pc"]
      );
    }
  }
}

export default InstitutionalContextEngine;
