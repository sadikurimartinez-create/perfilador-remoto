/**
 * Document Package Validator v1.0
 * ADR-013
 *
 * Auditoría previa al renderizado documental.
 */

export interface DocumentPackageAudit {
  valid: boolean;
  errors: string[];
  warnings: string[];
}


export function validateDocumentPackage(
  documentPackage: any
): DocumentPackageAudit {

  const errors: string[] = [];
  const warnings: string[] = [];


  if (!documentPackage) {
    return {
      valid: false,
      errors: [
        "DOCUMENT_PACKAGE_EMPTY"
      ],
      warnings
    };
  }


  if (
    !Array.isArray(documentPackage.chapters) ||
    documentPackage.chapters.length === 0
  ) {
    errors.push(
      "DOCUMENT_WITHOUT_CHAPTERS"
    );
  }


  if (
    !documentPackage.editorialPayload
  ) {
    errors.push(
      "MISSING_EDITORIAL_PAYLOAD"
    );
  }


  if (
    !documentPackage.certification
  ) {
    warnings.push(
      "DOCUMENT_WITHOUT_CERTIFICATION"
    );
  }


  if (
    !Array.isArray(documentPackage.evidences)
  ) {
    warnings.push(
      "NO_EVIDENCE_COLLECTION"
    );
  }


  if (
    !Array.isArray(documentPackage.visuals)
  ) {
    warnings.push(
      "NO_VISUAL_COLLECTION"
    );
  }


  return {
    valid: errors.length === 0,
    errors,
    warnings
  };

}