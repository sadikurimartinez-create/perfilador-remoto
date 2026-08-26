/**
 * ADR-019.17 — Estado operativo unico de Gobernanza GEOINT.
 * Nuevas escrituras deben usar exclusivamente estos valores.
 */
export enum GeointGovernanceStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED_EVIDENCE = "APPROVED_EVIDENCE",
  REJECTED_FINDING = "REJECTED_FINDING",
}

export type GeointGovernanceStatusValue = `${GeointGovernanceStatus}`;

export type LegacyGeointGovernanceStatus =
  | GeointGovernanceStatusValue
  | "GENERATED"
  | "GENERADO"
  | "PENDIENTE_REVISION"
  | "APROBADO"
  | "IGNORADO"
  | "APPROVED"
  | "RECHAZADO";

export function normalizeGeointGovernanceStatus(
  status?: LegacyGeointGovernanceStatus | string | null
): GeointGovernanceStatus {
  switch ((status || "").toUpperCase()) {
    case GeointGovernanceStatus.APPROVED_EVIDENCE:
    case "APROBADO":
    case "APPROVED":
      return GeointGovernanceStatus.APPROVED_EVIDENCE;
    case GeointGovernanceStatus.REJECTED_FINDING:
    case "IGNORADO":
    case "RECHAZADO":
      return GeointGovernanceStatus.REJECTED_FINDING;
    case "GENERATED":
    case "GENERADO":
    case "PENDIENTE_REVISION":
    case GeointGovernanceStatus.PENDING_REVIEW:
    default:
      return GeointGovernanceStatus.PENDING_REVIEW;
  }
}

export function buildGeointTraceabilityId(
  prefix: string,
  parts: Array<string | number | undefined | null>
): string {
  const normalizedParts = parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== "")
    .map((part) => String(part).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48));

  return `${prefix}-${normalizedParts.join("-")}-${Date.now()}`;
}
