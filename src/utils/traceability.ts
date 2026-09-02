import crypto from "crypto";

/**
 * Genera un hash SHA-256 inmutable para trazabilidad de evidencias y eventos OSINT.
 */
export function generateTraceabilityHash(content: string, timestamp: string, url?: string): string {
  const data = `${content}||${timestamp}||${url || ""}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}
