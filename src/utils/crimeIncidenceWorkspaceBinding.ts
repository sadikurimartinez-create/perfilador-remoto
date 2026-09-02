import {
  buildCrimeIncidenceWorkspace,
  type BuildCrimeIncidenceWorkspaceInput,
  type CrimeIncidenceWorkspaceViewModel,
} from "@/utils/crimeIncidenceWorkspaceAdapter";

export type CrimeIncidenceWorkspaceBindingState =
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "NO_COVERAGE"
  | "ERROR";

export type CrimeIncidenceWorkspaceBindingResult =
  | { state: "LOADING"; viewModel: null; error: null }
  | { state: "ERROR"; viewModel: null; error: string }
  | {
      state: "READY" | "EMPTY" | "NO_COVERAGE";
      viewModel: CrimeIncidenceWorkspaceViewModel;
      error: null;
    };

/** Binds completed ADR-022 artifacts without acquiring data or deriving spatial or analytical values. */
export function bindCrimeIncidenceWorkspace(
  input?: BuildCrimeIncidenceWorkspaceInput | null
): CrimeIncidenceWorkspaceBindingResult {
  if (!input) return { state: "LOADING", viewModel: null, error: null };

  try {
    const viewModel = buildCrimeIncidenceWorkspace(input);
    if (viewModel.geographyContext.geographicResolution.coverageStatus === "OUT_OF_COVERAGE") {
      return { state: "NO_COVERAGE", viewModel, error: null };
    }
    if (viewModel.incidents.matched.length === 0) {
      return { state: "EMPTY", viewModel, error: null };
    }
    return { state: "READY", viewModel, error: null };
  } catch (error: unknown) {
    return {
      state: "ERROR",
      viewModel: null,
      error: error instanceof Error ? error.message : "CRIME_INCIDENCE_WORKSPACE_BINDING_ERROR",
    };
  }
}
