/**
 * Document Validator v1.0
 * ADR-013
 *
 * Validaciones básicas de contenido documental.
 *
 * Responsabilidad:
 * Determinar si un bloque contiene información
 * utilizable antes de incorporarlo al documento final.
 */

export function hasDocumentContent(
  value: unknown
): boolean {

  if (value === null || value === undefined) {
    return false;
  }


  if (typeof value === "string") {
    return value.trim().length > 0;
  }


  if (Array.isArray(value)) {
    return value.length > 0;
  }


  if (typeof value === "object") {
    return Object.keys(value as object).length > 0;
  }


  return true;
}