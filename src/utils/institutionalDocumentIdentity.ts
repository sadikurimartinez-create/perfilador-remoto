export const INSTITUTIONAL_ISSUER = "SECRETARÍA DE SEGURIDAD PÚBLICA DEL ESTADO DE AGUASCALIENTES";
export const INSTITUTIONAL_UNIT = "CEIPOL";
export const EXECUTIVE_GEOINT_OFFICIAL_TITLE = "INFORME EJECUTIVO GEOINT";
export const TECHNICAL_ANNEX_OFFICIAL_TITLE = "ANEXO TÉCNICO";

export function formatInstitutionalDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "NO CONSIGNADA";
  const normalized = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T12:00:00Z`)
    : new Date(normalized);
  if (Number.isNaN(date.getTime())) return value.trim();
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
