"use server";

import { cookies } from "next/headers";
import { resolveScinceDocumentPublication } from "@/services/scinceDocumentPublicationService";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { excludedScinceDocumentContext, type ScinceDocumentContext } from "@/utils/scinceDocumentContext";

export async function getScinceDocumentContext(projectId: string,
  reportGeography: CanonicalProjectGeography | null): Promise<ScinceDocumentContext> {
  try {
    return await resolveScinceDocumentPublication({ projectId, reportGeography,
      sessionToken: cookies().get("ceipol_session")?.value });
  } catch {
    return excludedScinceDocumentContext("INVALID", "SCINCE_DOCUMENT_ADMISSION_UNAVAILABLE");
  }
}
