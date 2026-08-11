import { DocumentPackage } from "@/utils/documentEngine";

export function adaptDocumentPackageForWord(
  documentPackage: DocumentPackage
): any {

  const payload: any =
    documentPackage.editorialPayload &&
    typeof documentPackage.editorialPayload === "object"
      ? {
          ...(documentPackage.editorialPayload as Record<string, any>)
        }
      : {};


  payload.certificationRecord =
    documentPackage.certification ??
    payload.certificationRecord;


  payload.documentAudit =
    documentPackage.audit;


  payload.documentChapters =
    documentPackage.chapters;


  payload.documentEvidences =
    documentPackage.evidences;


  payload.documentVisuals =
    documentPackage.visuals;


  return payload;
}