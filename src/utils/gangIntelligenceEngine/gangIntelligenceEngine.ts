import { GangEvidenceMatrix, GangPresenceEvidence, GIMTraceabilityRecord } from "./models/gangIntelligenceTypes";
import { GangOsintAnalyzer, RawOsintInput } from "./gangOsintAnalyzer";
import { GraffitiTerritorialAnalyzer } from "./graffitiTerritorialAnalyzer";
import { GangEvidenceBuilder } from "./gangEvidenceBuilder";
import { VisualEvidenceEditorial } from "../visualEvidenceEngine/models/visualEvidenceTypes";
import { GimEvidenceTraceability } from "./gimEvidenceTraceability";
import { GangEvidenceValidator } from "./gangEvidenceValidator";

export interface GIMEngineInput {
  projectId: string;
  projectLat: number;
  projectLng: number;
  rawOsintFeeds: RawOsintInput[];
  veeGraffitiFeeds: VisualEvidenceEditorial[];
  operatorId?: string;
  humanValidationStatus?: "NOT_REQUIRED" | "READY_FOR_HUMAN_REVIEW" | "APPROVED" | "REJECTED";
  validatedByUserId?: string | null;
  humanValidatedAt?: string | null;
}

export class GangIntelligenceEngine {
  /**
   * Punto de entrada y fachada principal para procesar y construir la GangEvidenceMatrix (GEM).
   * Coordina el flujo de análisis de forma desacoplada y estructurada.
   */
  public static buildGangIntelligence(input: GIMEngineInput): GangEvidenceMatrix {
    const operator = input.operatorId || "GIM_AUTOMATED_ENGINE";
    const timestamp = new Date().toISOString();
    
    // 1. Procesar fuentes OSINT
    const osintEvents = GangOsintAnalyzer.analyze(
      input.rawOsintFeeds,
      input.projectLat,
      input.projectLng
    );

    // 2. Procesar evidencias de graffiti del VEE
    const graffitiEvents = GraffitiTerritorialAnalyzer.analyze(
      input.veeGraffitiFeeds,
      input.projectLat,
      input.projectLng
    );

    // 3. Evaluar presencia y concordancia general de forma no criminalizante
    const matchedGroups = Array.from(
      new Set([
        ...osintEvents.map((e) => e.detectedGroup).filter((g) => g !== "No determinado"),
        ...graffitiEvents.map((g) => g.detectedGangName).filter((g) => g !== "Grupo Local No Identificado")
      ])
    );

    const findingsCount = osintEvents.length + graffitiEvents.length;
    let status: "CONFIRMED" | "REFERENCED" | "NO_EVIDENCE" = "NO_EVIDENCE";
    let confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE" = "NONE";

    if (findingsCount > 0) {
      if (graffitiEvents.length > 0 && osintEvents.length > 0) {
        status = "CONFIRMED";
        confidence = "HIGH";
      } else {
        status = "REFERENCED";
        confidence = "MEDIUM";
      }
    }

    const presenceEvidence: GangPresenceEvidence = {
      status,
      confidence,
      matchedGroups,
      findingsCount,
      remarks: findingsCount > 0
        ? `Se registran indicios perimetrales compatibles con dinámicas grupales locales.`
        : "No se identificaron registros ni indicios de pandillas activos en el polígono analizado."
    };

    // 4. Derivar influencia territorial basada en las evidencias recopiladas
    const territorialInfluence = matchedGroups.map((group) => ({
      gangName: group,
      subgroups: [],
      activityLevel: "LOW" as const,
      influenceType: "SYMBOLIC" as const,
      approximateCoordinates: { lat: input.projectLat, lng: input.projectLng }
    }));

    // 5. Compilar Libro de Trazabilidad e Historial de Procedencia
    const traceabilityLog: GIMTraceabilityRecord[] = [];

    osintEvents.forEach((event, idx) => {
      const traceId = GimEvidenceTraceability.generateTraceId("osint", idx + 1);
      const record = GimEvidenceTraceability.createTraceabilityRecord(
        traceId,
        "OSINT_CRAWLER",
        `Feed OSINT - ID ${event.eventId}`,
        operator,
        `Filtro geográfico perimetral Haversine (${event.distanceMeters}m)`,
        event.distanceMeters <= 250 ? 80 : 50,
        ["HIE", "ReportEngine"]
      );
      record.sourceAuthority = event.qualityStatus === "LIMITED" ? "NON_AUTHORITATIVE" : "AUTHORITATIVE";
      record.sourceIntegrityStatus = event.traceabilityHash ? "VERIFIED" : "HASH_UNAVAILABLE";
      record.evidenceId = event.eventId;
      record.providerProvenance = "OSINT";
      traceabilityLog.push(record);
    });

    graffitiEvents.forEach((graffiti, idx) => {
      const traceId = GimEvidenceTraceability.generateTraceId("graf", idx + 1);
      const record = GimEvidenceTraceability.createTraceabilityRecord(
        traceId,
        "VEE_GRAFFITI",
        `VEE Graffiti Editorial - ID ${graffiti.veeReferenceId}`,
        operator,
        `Mapeo simbólico e interpretación textual pasiva`,
        60,
        ["HIE", "ReportEngine"]
      );
      record.sourceAuthority = "AUTHORITATIVE";
      record.sourceIntegrityStatus = "HASH_UNAVAILABLE";
      record.evidenceId = graffiti.id;
      record.providerProvenance = "VEE_GRAFFITI";
      traceabilityLog.push(record);
    });

    // 6. Ensamblar la matriz certificada GEM
    const assembledGem = GangEvidenceBuilder.assemble(
      presenceEvidence,
      territorialInfluence,
      graffitiEvents,
      osintEvents,
      traceabilityLog
    );
    assembledGem.metadata.humanValidationStatus = input.humanValidationStatus || "READY_FOR_HUMAN_REVIEW";
    assembledGem.metadata.validatedByUserId = input.validatedByUserId || null;
    assembledGem.metadata.humanValidatedAt = input.humanValidatedAt || null;

    // 7. Ejecutar validación interna (Capa 1) para calibrar y certificar el estatus
    const validationResult = GangEvidenceValidator.validate(assembledGem);
    assembledGem.status = validationResult.status;
    assembledGem.metadata.sourceIntegrityStatus =
      validationResult.errors.length > 0 ? "NOT_READY" :
      validationResult.warnings.length > 0 ? "READY_WITH_LIMITATIONS" :
      "VERIFIED";
    assembledGem.metadata.authorityClassification =
      traceabilityLog.some((record) => record.sourceAuthority === "SIMULATED" || record.sourceAuthority === "NON_AUTHORITATIVE")
        ? "NON_AUTHORITATIVE"
        : "AUTHORITATIVE";

    return assembledGem;
  }
}
