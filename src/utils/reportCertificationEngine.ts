import * as crypto from "crypto";

export enum CertificationStatus {
  READY_FOR_CERTIFICATION = "READY_FOR_CERTIFICATION",
  CERTIFIED = "CERTIFIED",
  CERTIFICATION_BLOCKED = "CERTIFICATION_BLOCKED"
}

export interface DocumentHash {
  hash: string;
  algorithm: "SHA-256";
  generatedAt: string;
}

export interface CertificationRecord {
  certificationId: string;   // Formato: CEIPOL-CERT-YYYYMMDD-[SHORT_HASH] o "CERTIFICATION_BLOCKED"
  reportId: string;
  hash: string;
  algorithm: string;
  engineVersion: string;     // Report Quality Governance Engine Version (e.g. "1.1.1")
  certificateVersion: string; // Version of the certificate format (e.g. "CEIPOL-CERT-v1")
  qualityScore: number;
  status: "CERTIFIED" | "CERTIFICATION_BLOCKED";
  createdAt: string;
  auditTrail: string;        // JSON stringified tracking indicators and quality details
}

export interface VerificationPayload {
  certificationId: string;
  hash: string;
  algorithm: string;
  version: string;           // Maps to certificateVersion for external validation format
  status: string;
}

export class DocumentHashGenerator {
  /**
   * Generates a stable, reproducible SHA-256 hash based on canonical, platform-independent analytic data.
   */
  public static generateHash(
    reportId: string,
    projectId: string,
    expedienteId: string,
    payload: any,
    qualityAssessment: any,
    engineVersion: string = "1.1.1"
  ): DocumentHash {
    const canonical = {
      projectId: projectId || "UNKNOWN_PROJECT",
      reportId: reportId || "UNKNOWN_REPORT",
      expedienteId: expedienteId || "UNKNOWN_EXPEDIENTE",
      reportQualityVersion: engineVersion,
      
      // Hypothesis ledger fields (ADR-011 / HIE)
      hypothesisConfidence: payload.hieData?.confidence?.level || payload.hypothesisLifecycle?.nivelConfianza || "UNKNOWN",
      initialHypothesis: payload.hieData?.initialHypothesis || payload.hypothesisLifecycle?.hipotesisInicial || "",
      finalHypothesis: payload.finalHypothesis || payload.hypothesisLifecycle?.evaluacionFinal || "",
      
      // Chapter content hashes to verify text integrity and detect modifications
      contextoTerritorialHash: crypto.createHash("sha256").update(payload.contextoTerritorial || "").digest("hex"),
      pandillasAnalysisHash: crypto.createHash("sha256").update(payload.pandillasAnalysis || "").digest("hex"),
      conclusionesTextHash: crypto.createHash("sha256").update(payload.conclusionesText || "").digest("hex"),
      
      // Quality Gate Assessment metrics
      qualityScore: qualityAssessment?.qualityScore ?? qualityAssessment?.score ?? 0,
      qualityStatus: qualityAssessment?.status || "UNKNOWN",
      issuesCount: qualityAssessment?.issues?.length || 0,
      
      // Executive summary properties
      executiveSummaryTitle: payload.executiveSummaryReport?.title || "Resumen de Inteligencia"
    };

    // Sort keys alphabetically to guarantee absolute deterministic serialization
    const orderedKeys = Object.keys(canonical).sort();
    const orderedCanonical: any = {};
    for (const key of orderedKeys) {
      orderedCanonical[key] = (canonical as any)[key];
    }

    const serializedData = JSON.stringify(orderedCanonical);
    const hash = crypto.createHash("sha256").update(serializedData).digest("hex");

    return {
      hash,
      algorithm: "SHA-256",
      generatedAt: new Date().toISOString()
    };
  }
}

export class CertificationGate {
  /**
   * Evaluates the QA report status to authorize or block certification.
   */
  public static evaluate(qualityAssessment: any): CertificationStatus {
    if (!qualityAssessment) {
      return CertificationStatus.CERTIFICATION_BLOCKED;
    }
    
    // Strict quality threshold check
    if (qualityAssessment.status === "PASS") {
      return CertificationStatus.READY_FOR_CERTIFICATION;
    }
    
    return CertificationStatus.CERTIFICATION_BLOCKED;
  }
}

export class CertificationRecordBuilder {
  /**
   * Assembles the formal Certification Record including unique ID derivation and audit trail preservation.
   */
  public static build(
    reportId: string,
    hashObj: DocumentHash,
    qualityAssessment: any,
    status: CertificationStatus,
    engineVersion: string = "1.1.1",
    certificateVersion: string = "CEIPOL-CERT-v1"
  ): CertificationRecord {
    const isApproved = status === CertificationStatus.READY_FOR_CERTIFICATION;
    
    // Format date as YYYYMMDD
    const dateObj = new Date(hashObj.generatedAt);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const dateStr = `${year}${month}${day}`;
    
    const shortHash = hashObj.hash.substring(0, 5).toUpperCase();
    const certificationId = isApproved 
      ? `CEIPOL-CERT-${dateStr}-${shortHash}` 
      : "CERTIFICATION_BLOCKED";

    const auditTrailObj = {
      auditedAt: hashObj.generatedAt,
      qualityScore: qualityAssessment?.qualityScore ?? qualityAssessment?.score ?? 0,
      unlinkedFindingsCount: qualityAssessment?.traceabilityReport?.unlinkedFindingsCount ?? 0,
      totalIssuesCount: qualityAssessment?.issues?.length || 0,
      criticalIssues: (qualityAssessment?.issues || [])
        .filter((i: any) => i.severity === "HIGH" || i.severity === "MEDIUM")
        .map((i: any) => ({ id: i.id, chapter: i.chapter, type: i.type, message: i.message }))
    };

    return {
      certificationId,
      reportId: reportId || "UNKNOWN",
      hash: hashObj.hash,
      algorithm: hashObj.algorithm,
      engineVersion,
      certificateVersion,
      qualityScore: qualityAssessment?.qualityScore ?? qualityAssessment?.score ?? 0,
      status: isApproved ? "CERTIFIED" : "CERTIFICATION_BLOCKED",
      createdAt: hashObj.generatedAt,
      auditTrail: JSON.stringify(auditTrailObj)
    };
  }
}

export class CertificationTraceManager {
  /**
   * Generates a formal security trace of the certification transaction.
   */
  public static logTrace(record: CertificationRecord): string {
    return `[CUSTODIA CEIPOL] Documento ${record.reportId} procesado bajo v${record.engineVersion} (${record.certificateVersion}). Estatus: ${record.status}. ID Certificación: ${record.certificationId}. Hash: ${record.hash}. Score QA: ${record.qualityScore}%`;
  }
}

export class VerificationPayloadGenerator {
  /**
   * Generates the non-sensitive public payload for QR validation.
   */
  public static generate(record: CertificationRecord): VerificationPayload {
    return {
      certificationId: record.certificationId,
      hash: record.status === "CERTIFIED" ? record.hash : "BLOCKED",
      algorithm: record.algorithm,
      version: record.certificateVersion,
      status: record.status
    };
  }
}

export class ReportCertificationEngine {
  /**
   * Orchestrates the complete certification workflow.
   */
  public static certify(
    reportId: string,
    projectId: string,
    expedienteId: string,
    payload: any,
    qualityAssessment: any,
    engineVersion: string = "1.1.1",
    certificateVersion: string = "CEIPOL-CERT-v1"
  ): CertificationRecord {
    // 1. Generate Canonical Hash
    const hashObj = DocumentHashGenerator.generateHash(
      reportId,
      projectId,
      expedienteId,
      payload,
      qualityAssessment,
      engineVersion
    );
    
    // 2. Evaluate Quality Gate status
    const gateStatus = CertificationGate.evaluate(qualityAssessment);
    
    // 3. Construct formal Certification Record
    const record = CertificationRecordBuilder.build(
      reportId,
      hashObj,
      qualityAssessment,
      gateStatus,
      engineVersion,
      certificateVersion
    );
    
    // 4. Log formal traceability custody string
    console.log(CertificationTraceManager.logTrace(record));
    
    return record;
  }
}
