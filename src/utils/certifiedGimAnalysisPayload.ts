export function isCertifiedGimAnalysisPayload(item: unknown): boolean {
  const candidate = item as any;
  return candidate?.schemaVersion === "GIM-REPORT-1.0" &&
    candidate?.validatedByACE === true &&
    candidate?.validationStatus === "CERTIFIED" &&
    typeof candidate?.traceabilityReference === "string" &&
    candidate.traceabilityReference.trim().length > 0;
}
