import { 
  GangEvidenceMatrix, 
  GangPresenceEvidence, 
  TerritorialInfluence, 
  GraffitiTerritorialEvidence, 
  OsintGangEvidence, 
  GIMTraceabilityRecord 
} from "./models/gangIntelligenceTypes";

export class GangEvidenceBuilder {
  /**
   * Ensambla rigurosamente los componentes analizados en la GangEvidenceMatrix (GEM).
   * Actúa como ensamblador puro sin generar conclusiones criminalizantes ni alterar confianza.
   */
  public static assemble(
    presenceEvidence: GangPresenceEvidence,
    territorialInfluence: TerritorialInfluence[],
    graffitiEvidence: GraffitiTerritorialEvidence[],
    osintEvidenceEvents: OsintGangEvidence[],
    traceabilityLog: GIMTraceabilityRecord[]
  ): GangEvidenceMatrix {
    const timestamp = new Date().toISOString();

    // Determinar estatus de disponibilidad local del GIM de forma determinista
    let status: "READY" | "READY_WITH_LIMITATIONS" | "NOT_READY" = "NOT_READY";
    
    if (presenceEvidence.status !== "NO_EVIDENCE") {
      if (presenceEvidence.confidence === "HIGH" && graffitiEvidence.length > 0 && osintEvidenceEvents.length > 0) {
        status = "READY";
      } else {
        status = "READY_WITH_LIMITATIONS";
      }
    } else {
      status = "READY_WITH_LIMITATIONS";
    }

    return {
      metadata: {
        module: "GIM",
        version: "1.0.0",
        generatedAt: timestamp,
        schemaVersion: "ADR-008.2"
      },
      presenceEvidence,
      territorialInfluence,
      graffitiEvidence,
      osintEvidence: {
        eventsFound: osintEvidenceEvents.length,
        events: osintEvidenceEvents
      },
      traceabilityLog,
      status
    };
  }
}
