import { saveInstitutionalGang, deleteInstitutionalGang } from "@/lib/institutionalGangActions";
import { listInstitutionalPandillasLegacyView } from "@/lib/institutionalPandillasReadActions";
import { GangEntity, FusionResult } from "./pandillas.mapper";
import {
  PANDILLAS_SWEEP_CLIENT_TIMEOUT_MS,
  PandillasSweepError,
  classifyPandillasHttpStatus,
  classifyPandillasResult,
} from "./pandillas.sweepStatus";

/**
 * Service class to manage Firestore data persistence and execute intelligence sweep requests.
 */
export class PandillasService {
  private static collectionName = "pandillas";

  /**
   * Triggers the full intelligence fusion engine from the backend API.
   */
  static async analyzeGang(
    gang: GangEntity,
    userContext: string,
    options: { timeoutMs?: number } = {}
  ): Promise<FusionResult & { isAiGenerated: boolean; warning?: string; sweepStatus?: string; providerProvenance?: any }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? PANDILLAS_SWEEP_CLIENT_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch("/api/pandillas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          projectId: gang.projectId,
          nombre: gang.nombre,
          zonaInfluencia: gang.zonaInfluencia,
          antagonicas: gang.antagonicas,
          integrantes: gang.integrantes,
          grafitiInfo: gang.grafitiInfo,
          archivosAnexos: gang.archivosAnexos || [],
          contextoUsuario: userContext
        }),
      });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new PandillasSweepError("TIMEOUT", "PANDILLAS_SWEEP_TIMEOUT", 504);
      }
      throw new PandillasSweepError("PROVIDER_ERROR", error?.message || "PANDILLAS_PROVIDER_ERROR");
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const sweepStatus = classifyPandillasHttpStatus(response.status);
      throw new PandillasSweepError(
        sweepStatus,
        payload?.error || payload?.message || `Error en el motor de barrido: ${response.statusText}`,
        response.status,
        payload
      );
    }

    return {
      ...payload,
      sweepStatus: classifyPandillasResult(payload),
    };
  }

  /**
   * Saves a new gang record or updates an existing one in Firestore.
   */
  static async saveGang(gang: GangEntity, _username: string): Promise<string> { return saveInstitutionalGang(gang); }
  static async saveExistingGangWithVersion(gang: GangEntity, expectedUpdatedAt: number | null): Promise<string> {
    if (!gang?.id?.trim()) throw new Error('PANDILLAS_TARGET_ID_REQUIRED');
    if (gang.id.trim().startsWith('static-gang-')) throw new Error('PANDILLAS_STATIC_TARGET_FORBIDDEN');
    if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== 'number' || !Number.isFinite(expectedUpdatedAt))) {
      throw new Error('PANDILLAS_EXPECTED_VERSION_REQUIRED');
    }
    return saveInstitutionalGang(gang, { requireExisting: true, checkVersion: true, expectedUpdatedAt });
  }
  static async getAllGangs(): Promise<GangEntity[]> { return listInstitutionalPandillasLegacyView(); }
  static async getGangByProjectId(projectId:string):Promise<GangEntity|null> { return (await this.getAllGangs()).find(gang=>gang.projectId===projectId)||null; }
  static async getGangByGeoReportId(geoReportId:string):Promise<GangEntity|null> { return (await this.getAllGangs()).find(gang=>gang.geoReportId===geoReportId)||null; }
  static async deleteGang(id:string):Promise<void> { await deleteInstitutionalGang(id); }
}
