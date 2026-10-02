import { assignInstitutionalNumeroExpediente } from "@/lib/institutionalNumeroExpedienteActions";
import type { DocumentIdentityUser } from "@/utils/documentIdentity";

/** Historical API retained. Browser profile is attribution, never authority. */
export async function assignNumeroExpedienteToExistingProject(projectId: string, _user: DocumentIdentityUser | null | undefined) {
  return assignInstitutionalNumeroExpediente(projectId);
}
