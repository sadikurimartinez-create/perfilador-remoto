import type { ScinceCanonicalContextResult } from "@/types/scinceCanonicalContext";
import type { ScinceCanonicalSuccess } from "@/types/scinceCanonicalSnapshot";
import type { ScincePreparationResult } from "@/lib/scinceHumanContextActions";

export type ScinceHumanStatus = "IDLE" | "CONSULTANDO" | "RESULTADO_DISPONIBLE" | "INCORPORANDO" |
  "INCORPORADO" | "ERROR" | "NO_DISPONIBLE" | "GEOMETRIA_NO_COMPATIBLE" | "ACCESO_DENEGADO";
export type ScinceHumanState = { status: ScinceHumanStatus; result: ScinceCanonicalSuccess | null; message: string | null };
export type ScinceHumanContext = { projectId: string; readOnly: boolean; canQuery?: boolean; analysis: Record<string, unknown> | null;
  // The UI updates this token when its canonical geography changes during an asynchronous action.
  territoryRevision: unknown };
type Dependencies = {
  context: () => ScinceHumanContext;
  query: (projectId: string) => Promise<ScinceCanonicalContextResult>;
  prepare: (projectId: string, reviewed: ScinceCanonicalSuccess) => Promise<ScincePreparationResult>;
  updateProjectDetails: (details: { iaAnalysis: Record<string, unknown> }) => Promise<void>;
  setAnalysisResult: (analysis: Record<string, unknown>) => void;
  changed: (state: ScinceHumanState) => void;
};

/** Executable UI flow. Creation, consult and dismiss have no persistence path. */
export function createScinceHumanContextFlow(deps: Dependencies) {
  let state: ScinceHumanState = { status: "IDLE", result: null, message: null };
  let disposed = false;
  let sequence = 0;
  let reviewedTerritory: unknown;
  const emit = (next: ScinceHumanState) => { state = next; if (!disposed) deps.changed(next); };
  const sameContext = (context: ScinceHumanContext) => {
    const latest = deps.context();
    return !disposed && latest.projectId === context.projectId && (!latest.readOnly || latest.canQuery === true) && latest.territoryRevision === context.territoryRevision;
  };
  return {
    getState: () => state,
    activate() { disposed = false; },
    dispose() { disposed = true; sequence++; },
    dismiss() {
      if (state.status === "INCORPORANDO") return;
      sequence++;
      emit({ status: "IDLE", result: null, message: null });
    },
    async consult() {
      if (disposed || state.status === "CONSULTANDO" || state.status === "INCORPORANDO") return;
      const context = deps.context();
      if (!context.projectId || (context.canQuery === undefined ? context.readOnly : !context.canQuery)) return;
      const request = ++sequence;
      emit({ status: "CONSULTANDO", result: null, message: null });
      try {
        const result = await deps.query(context.projectId);
        if (request !== sequence || !sameContext(context)) {
          if (!disposed && request === sequence) emit({ status: "ERROR", result: null, message: "El expediente o territorio cambió. Consulte SCINCE nuevamente." });
          return;
        }
        if (result.success) {
          if (result.projectId !== context.projectId) throw new Error("PROJECT_MISMATCH");
          reviewedTerritory = context.territoryRevision;
          emit({ status: "RESULTADO_DISPONIBLE", result, message: null });
        } else if (result.code === "SCINCE_CANONICAL_ACCESS_DENIED") {
          emit({ status: "ACCESO_DENEGADO", result: null, message: "No tiene autorización institucional para consultar SCINCE en este expediente." });
        } else if (result.code === "SCINCE_CANONICAL_GEOMETRY_UNSUPPORTED") {
          emit({ status: "GEOMETRIA_NO_COMPATIBLE", result: null, message: "La geometría canónica no es válida para consultar SCINCE. Revise su definición territorial." });
        } else if (result.code === "SCINCE_CANONICAL_GEOGRAPHY_INVALID" || result.code === "SCINCE_CANONICAL_POINT_INVALID") {
          emit({status:"GEOMETRIA_NO_COMPATIBLE",result:null,message:"La geometría canónica es inválida; no se consultó la fuente."});
        } else if (result.code === "SCINCE_RADIUS_CONFIGURATION_REQUIRED") {
          emit({status:"NO_DISPONIBLE",result:null,message:"Falta configuración institucional aprobada del radio SCINCE."});
        } else if (result.code === "MULTIUNIT_QUERY_LIMIT_EXCEEDED" || result.code === "SCINCE_QUERY_TIMEOUT") {
          emit({status:"ERROR",result:null,message:result.code});
        } else {
          emit({ status: "NO_DISPONIBLE", result: null, message: "No hay contexto SCINCE canónico disponible para la geografía vigente." });
        }
      } catch {
        if (!disposed && request === sequence) emit({ status: "ERROR", result: null, message: "No fue posible consultar SCINCE. Intente nuevamente." });
      }
    },
    async incorporate() {
      if (disposed || state.status !== "RESULTADO_DISPONIBLE" || !state.result) return;
      const context = deps.context();
      if (!context.projectId || context.readOnly) return;
      if (context.territoryRevision !== reviewedTerritory) {
        emit({ status: "ERROR", result: null, message: "El territorio cambió. Consulte y revise SCINCE nuevamente." });
        return;
      }
      const reviewed = state.result;
      emit({ ...state, status: "INCORPORANDO", message: null });
      try {
        const prepared = await deps.prepare(context.projectId, reviewed);
        if (!sameContext(context)) {
          if (!disposed) emit({ status: "ERROR", result: null, message: "El expediente o territorio cambió. No se incorporó el resultado." });
          return;
        }
        if (!prepared.success) {
          emit({ status: prepared.code === "ACCESS_DENIED" ? "ACCESO_DENEGADO" : "ERROR", result: null,
            message: prepared.code === "ACCESS_DENIED" ? "No tiene autorización para incorporar SCINCE." :
              "No se incorporó SCINCE. Consulte y revise nuevamente el resultado vigente." });
          return;
        }
        // Use the latest analysis, preserving legacy SCINCE and all unrelated fields.
        const analysis = { ...(deps.context().analysis ?? {}), scinceCanonicalSnapshot: prepared.snapshot,
          scinceCanonicalIncorporation: prepared.incorporation };
        if(reviewed.compactSnapshot) {
          if(!('persisted' in prepared) || prepared.persisted!==true || prepared.snapshot.schemaVersion!=='SCINCE_COMPACT_SNAPSHOT_V2')throw new Error('SCINCE_COMPACT_SERVER_PERSISTENCE_REQUIRED');
        } else await deps.updateProjectDetails({ iaAnalysis: analysis });
        if (!sameContext(context)) return;
        deps.setAnalysisResult(analysis);
        emit({ status: "INCORPORADO", result: null, message: "Contexto sociodemográfico observado incorporado." });
      } catch {
        if (!disposed) emit({ status: "ERROR", result: null, message: "No fue posible confirmar la incorporación de SCINCE. Revise el expediente antes de reintentar." });
      }
    },
  };
}
