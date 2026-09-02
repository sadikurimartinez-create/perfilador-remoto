import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { CrimeIncidenceWorkspaceViewModel } from "../src/utils/crimeIncidenceWorkspaceAdapter";
import type { CrimeIncidenceWorkspaceBindingResult } from "../src/utils/crimeIncidenceWorkspaceBinding";

type WorkspaceModule = typeof import("../src/components/crime-incidence/CrimeIncidenceWorkspace");

function loadWorkspaceModule(): WorkspaceModule {
  const filename = path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceWorkspace.tsx");
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const uiModule = (name: string) => ({
    [name]: ({ children, title, description, message, subtitle, actions }: Record<string, unknown>) =>
      React.createElement("div", null, children ?? title ?? description ?? message ?? subtitle ?? actions),
  });
  const localRequire = (specifier: string) => {
    if (specifier === "react") return React;
    if (specifier.endsWith("CEIPOLBadge")) return uiModule("CEIPOLBadge");
    if (specifier.endsWith("CEIPOLButton")) return uiModule("CEIPOLButton");
    if (specifier.endsWith("CEIPOLEmptyState")) return uiModule("CEIPOLEmptyState");
    if (specifier.endsWith("CEIPOLErrorState")) return uiModule("CEIPOLErrorState");
    if (specifier.endsWith("CEIPOLLoadingState")) return uiModule("CEIPOLLoadingState");
    if (specifier.endsWith("CEIPOLSectionHeader")) return uiModule("CEIPOLSectionHeader");
    if (specifier.endsWith("CrimeIncidenceAnalytics")) {
      return { CrimeIncidenceAnalytics: () => React.createElement("div", null, "Crime Incidence Analytics") };
    }
    if (specifier.endsWith("CrimeIncidenceFilters")) {
      return { CrimeIncidenceFilters: () => React.createElement("div", null, "Crime Incidence Filters") };
    }
    if (specifier.endsWith("CrimeIncidenceMap")) {
      return { CrimeIncidenceMap: () => React.createElement("div", null, "Crime Incidence Map Container") };
    }
    if (specifier.endsWith("crimeIncidenceWorkspaceExport")) {
      return { prepareCrimeIncidenceInstitutionalExport: (contract: unknown) => ({ exportContract: contract }) };
    }
    if (specifier.endsWith("crimeIncidenceControlledFilters")) {
      return {
        createCrimeIncidenceFilterState: () => ({ temporal: { start: null, end: null }, incidentTypes: [], geographicCoverage: null }),
        createCrimeIncidenceFilterQueryIntent: (_request: unknown, filters: unknown) => ({ filters }),
      };
    }
    throw new Error(`Unexpected test import: ${specifier}`);
  };
  const moduleRecord: { exports: Partial<WorkspaceModule> } = { exports: {} };
  const execute = new Function("require", "module", "exports", output);
  execute(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports as WorkspaceModule;
}

const { CrimeIncidenceWorkspace, getCrimeIncidenceWorkspaceVisualState } = loadWorkspaceModule();

function viewModel(options: { coverage?: "IN_COVERAGE" | "OUT_OF_COVERAGE"; matched?: boolean } = {}) {
  const matched = options.matched === false ? [] : [{
    id: "incident-1",
    incidentType: "Robo",
    occurredDate: "2026-08-01",
    location: { municipality: "Aguascalientes" },
    source: { querySource: "POSTGIS", sourceReference: "incidencia_estadistica" },
    coverage: { geographic: options.coverage ?? "IN_COVERAGE" },
  }];
  return {
    workspaceId: "workspace-0228b",
    expedienteId: "EXP-0228B",
    geographyContext: {
      canonicalGeography: { geographyId: "geo-1" },
      geographicResolution: {
        coverageStatus: options.coverage ?? "IN_COVERAGE",
        coverageExplanation: options.coverage === "OUT_OF_COVERAGE" ? "QUERY_OUT_OF_AUTHORIZED_TERRITORIAL_COVERAGE" : "IN_COVERAGE",
      },
    },
    incidents: {
      matched,
      excluded: [],
      table: matched.map((incident) => ({ classification: "MATCHED", incident })),
    },
    metrics: { aggregation: { matchedRecords: matched.length, excludedRecords: 0, recordsWithCoordinates: 0 } },
    limitations: [],
    datasetReference: { datasetId: "crime-dataset-2026" },
    queryReference: { status: "EXECUTED" },
    exportReference: { analyticalLevel: "DESCRIPTIVE" },
    institutionalMetadata: { watermark: "CEIPOL" },
    lineage: { dataset: "crime-dataset-2026" },
  } as unknown as CrimeIncidenceWorkspaceViewModel;
}

function binding(model: CrimeIncidenceWorkspaceViewModel, state: "READY" | "EMPTY" | "NO_COVERAGE"): CrimeIncidenceWorkspaceBindingResult {
  return { state, viewModel: model, error: null };
}

function render(input?: CrimeIncidenceWorkspaceBindingResult) {
  return renderToStaticMarkup(React.createElement(CrimeIncidenceWorkspace, { binding: input }));
}

describe("ADR-022.8B Crime Incidence Workspace shell", () => {
  test("renders the component and loading state without a view model", () => {
    const markup = render();
    expect(markup).toContain("data-testid=\"crime-incidence-workspace\"");
    expect(markup).toContain("data-state=\"LOADING\"");
    expect(markup).toContain("Preparando incidencia delictiva");
  });

  test("renders the governed empty state", () => {
    const model = viewModel({ matched: false });
    const input = binding(model, "EMPTY");
    expect(getCrimeIncidenceWorkspaceVisualState(input)).toBe("EMPTY");
    expect(render(input)).toContain("Sin incidentes compatibles");
  });

  test("renders the no coverage state", () => {
    const model = viewModel({ coverage: "OUT_OF_COVERAGE", matched: false });
    const input = binding(model, "NO_COVERAGE");
    expect(getCrimeIncidenceWorkspaceVisualState(input)).toBe("NO_COVERAGE");
    expect(render(input)).toContain("Sin cobertura territorial");
  });

  test("renders the binding error state", () => {
    const input: CrimeIncidenceWorkspaceBindingResult = {
      state: "ERROR",
      viewModel: null,
      error: "CRIME_INCIDENCE_WORKSPACE_EXPEDIENT_MISMATCH",
    };
    expect(getCrimeIncidenceWorkspaceVisualState(input)).toBe("ERROR");
    expect(render(input)).toContain("No fue posible preparar el workspace");
  });

  test("renders governed results and planned table columns", () => {
    const markup = render(binding(viewModel(), "READY"));
    expect(markup).toContain("data-state=\"READY\"");
    expect(markup).toContain("Crime Incidence Map Container");
    expect(markup).toContain("Robo");
    expect(markup).toContain("Aguascalientes");
    for (const column of ["Fecha", "Tipo", "Municipio", "Fuente", "Cobertura", "Estado"]) {
      expect(markup).toContain(column);
    }
  });

  test("preserves the supplied view model", () => {
    const model = viewModel();
    const before = JSON.stringify(model);
    render(binding(model, "READY"));
    expect(JSON.stringify(model)).toBe(before);
    expect(model.incidents.matched[0].id).toBe("incident-1");
  });

  test("does not generate evidence or findings", () => {
    const markup = render(binding(viewModel(), "READY"));
    expect(markup).not.toMatch(/evidenceRef|findingRef/);
  });

  test("contains no causal, predictive, query, or map implementation logic", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceWorkspace.tsx"), "utf8");
    expect(source).not.toMatch(/causalAnalysis|riskScore|prediction/);
    expect(source).not.toMatch(/fetch\(|axios|GoogleMap|ProfessionalGeoMap|ProjectMap/);
  });
});
