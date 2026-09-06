export const NUMERO_EXPEDIENTE_VERSION = "1.0";
export const NUMERO_EXPEDIENTE_SEQUENCE_WIDTH = 4;

export type NumeroExpedienteCounterScope = "GLOBAL" | "YEARLY";

export interface DocumentIdentityUser {
  perfiladorIniciales?: unknown;
  ppcInitials?: unknown;
  ppcIniciales?: unknown;
  profile?: {
    perfiladorIniciales?: unknown;
    ppcInitials?: unknown;
    ppcIniciales?: unknown;
  } | null;
}

export interface NumeroExpedienteFields {
  numeroExpediente: string;
  numeroExpedienteAsignadoAt: number;
  numeroExpedienteSequence: number;
  perfiladorIniciales: string;
  numeroExpedienteVersion: string;
}

function compact(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validatePerfiladorIniciales(value: unknown): string {
  const initials = compact(value).toLocaleUpperCase("es-MX");
  if (!/^[A-ZÑ]{2,5}$/.test(initials)) {
    throw new Error("PERFILADOR_INICIALES_INVALIDAS");
  }
  return initials;
}

export function resolvePerfiladorIniciales(user: DocumentIdentityUser | null | undefined): string {
  const explicit =
    compact(user?.perfiladorIniciales) ||
    compact(user?.ppcIniciales) ||
    compact(user?.ppcInitials) ||
    compact(user?.profile?.perfiladorIniciales) ||
    compact(user?.profile?.ppcIniciales) ||
    compact(user?.profile?.ppcInitials);

  if (!explicit) {
    throw new Error("PERFILADOR_INICIALES_REQUERIDAS");
  }
  return validatePerfiladorIniciales(explicit);
}

export function formatNumeroExpediente(input: {
  createdAt: Date;
  sequence: number;
  perfiladorIniciales: string;
  sequenceWidth?: number;
}): string {
  const sequenceWidth = input.sequenceWidth ?? NUMERO_EXPEDIENTE_SEQUENCE_WIDTH;
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new Error("NUMERO_EXPEDIENTE_SEQUENCE_INVALIDA");
  }
  const initials = validatePerfiladorIniciales(input.perfiladorIniciales);
  const dd = String(input.createdAt.getDate()).padStart(2, "0");
  const mm = String(input.createdAt.getMonth() + 1).padStart(2, "0");
  const yyyy = input.createdAt.getFullYear();
  const sequence = String(input.sequence).padStart(sequenceWidth, "0");
  return `${dd}${mm}${yyyy}-${sequence}-${initials}`;
}

export function buildNumeroExpedienteFields(input: {
  createdAt: Date;
  sequence: number;
  perfiladorIniciales: string;
  assignedAt?: number;
  version?: string;
}): NumeroExpedienteFields {
  return {
    numeroExpediente: formatNumeroExpediente(input),
    numeroExpedienteAsignadoAt: input.assignedAt ?? input.createdAt.getTime(),
    numeroExpedienteSequence: input.sequence,
    perfiladorIniciales: validatePerfiladorIniciales(input.perfiladorIniciales),
    numeroExpedienteVersion: input.version ?? NUMERO_EXPEDIENTE_VERSION,
  };
}

export function resolveVisibleNumeroExpediente(record: {
  numeroExpediente?: unknown;
  ceipolId?: unknown;
  projectId?: unknown;
  geographyId?: unknown;
  name?: unknown;
  estado?: unknown;
} | null | undefined): string {
  const numeroExpediente = compact(record?.numeroExpediente);
  if (numeroExpediente) return numeroExpediente;
  const ceipolId = compact(record?.ceipolId);
  if (ceipolId) return ceipolId;
  return "NO ASIGNADO";
}

export function sanitizeExpedienteFilePart(value: unknown, fallback: string): string {
  const raw = compact(value) || fallback;
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || fallback;
}

export function buildNumeroExpedienteFilename(input: {
  numeroExpediente?: unknown;
  ceipolId?: unknown;
  projectName?: unknown;
  extension: "docx" | "pdf" | "json";
}): string {
  const visibleNumber = resolveVisibleNumeroExpediente(input);
  const numberPart = sanitizeExpedienteFilePart(visibleNumber, "NO_ASIGNADO");
  const namePart = sanitizeExpedienteFilePart(input.projectName, "Expediente");
  return `${numberPart}_${namePart}.${input.extension}`;
}
