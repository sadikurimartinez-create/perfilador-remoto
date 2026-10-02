"use server";
import { cookies } from "next/headers";
import { resolveAuthorizedInstitutionalReportSource } from "@/services/institutionalReportSourceService";

export async function getAuthorizedInstitutionalReportSource(projectId: string) {
  return resolveAuthorizedInstitutionalReportSource({ projectId, sessionToken: cookies().get("ceipol_session")?.value });
}
