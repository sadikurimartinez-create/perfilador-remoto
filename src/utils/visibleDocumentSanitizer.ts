const RESERVED_CREDENTIAL = "[credencial reservada]";
const RESERVED_REFERENCE = "[referencia reservada]";
const RESERVED_PATH = "[ruta reservada]";
const RESERVED_IDENTIFIER = "[identificador reservado]";
const RESERVED_TECHNICAL_DETAIL = "[detalle tecnico reservado]";

const SECRET_NAME = "access_token|refresh_token|api[_-]?key|apikey|client_secret|password|database_url";

export function sanitizeVisibleDocumentText(
  value: unknown,
  fallback = "",
  options: { preserveWhitespace?: boolean } = {}
): string {
  if (typeof value !== "string") return fallback;
  const redacted = value
    .replace(/\bAuthorization\s*:\s*(?:Bearer\s+)?[^\s,;]+/gi, RESERVED_CREDENTIAL)
    .replace(/\bBearer\s+[^\s,;]+/gi, RESERVED_CREDENTIAL)
    .replace(new RegExp(`\\b(?:${SECRET_NAME})\\b\\s*[:=]\\s*(?:"[^"]*"|'[^']*'|[^\\s,;]+)`, "gi"), RESERVED_CREDENTIAL)
    .replace(/\bstoragePath\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, RESERVED_PATH)
    .replace(/\bprojectId\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, RESERVED_IDENTIFIER)
    .replace(/https?:\/\/[^\s<>"')\]]+/gi, RESERVED_REFERENCE)
    .replace(/(?:blob:|data:)[^\s<>"')\]]+/gi, RESERVED_REFERENCE)
    .replace(/gs:\/\/[^\s,;]+/gi, RESERVED_PATH)
    .replace(/\b(?:projects|buckets)\/[^\s,;]+/gi, RESERVED_PATH)
    .replace(/\b[A-Za-z]:\\[^\s,;]+/g, RESERVED_PATH)
    .replace(/\/(?:Users|home)\/[^\s,;]+/g, RESERVED_PATH)
    .replace(/^\s*at\s+(?:new\s+)?[\w$.<>]+(?:\s+\([^\n]*\))?\s*$/gim, RESERVED_TECHNICAL_DETAIL)
    .replace(/\b(?:TypeError|ReferenceError|SyntaxError|RangeError|Error):\s*[^.;\n]*(?:[.;]|$)/gi, RESERVED_TECHNICAL_DETAIL)
    .replace(/\bstack\s*trace\b|\bstacktrace\b/gi, RESERVED_TECHNICAL_DETAIL)
    .replace(/\[object Object\]/gi, RESERVED_TECHNICAL_DETAIL)
    .replace(new RegExp(`\\b(?:${SECRET_NAME}|Authorization|storagePath)\\b`, "gi"), RESERVED_TECHNICAL_DETAIL)
    .replace(/\bprojectId\b/gi, RESERVED_IDENTIFIER);
  const sanitized = options.preserveWhitespace
    ? redacted.trim()
    : redacted.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  return sanitized || fallback;
}
