import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { CrimeIncidenceAnalyticalProjection } from "../src/types/crimeIncidenceAnalyticalProjection";

type AnalyticsModule = typeof import("../src/components/crime-incidence/CrimeIncidenceAnalytics");

function loadAnalyticsModule(): AnalyticsModule {
  const filename = path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceAnalytics.tsx");
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
  const moduleRecord: { exports: Partial<AnalyticsModule> } = { exports: {} };
  const execute = new Function("require", "module", "exports", output);
  execute((specifier: string) => {
    if (specifier === "react") return React;
    throw new Error(`Unexpected test import: ${specifier}`);
  }, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports as AnalyticsModule;
}

const { CrimeIncidenceAnalytics } = loadAnalyticsModule();

function projection(empty = false): CrimeIncidenceAnalyticalProjection {
  return {
    projectionType: "DESCRIPTIVE_SUMMARY",
    analyticalLevel: "DESCRIPTIVE",
    sourceQuery: { status: "EXECUTED" },
    datasetReference: { datasetId: "crime-dataset-authorized" },
    geographicReference: { coverageStatus: "IN_COVERAGE" },
    temporalReference: { query: { start: "2026-01-01", end: "2026-01-31" } },
    metrics: {
      frequency: {
        totalRecords: empty ? undefined : 7,
        byIncidentType: empty ? [] : [{ value: "Robo", count: 5 }],
      },
      percentage: {
        basis: empty ? undefined : 7,
        byIncidentType: empty ? [] : [{ value: "Robo", count: 5, percentage: 71.4 }],
      },
      distribution: {
        byMunicipality: empty ? [] : [{ value: "Aguascalientes", count: 4 }],
        byOccurredDate: empty ? [] : [{ value: "2026-01-10", count: 2 }],
      },
      aggregation: {
        matchedRecords: empty ? undefined : 7,
        excludedRecords: empty ? undefined : 3,
        recordsWithCoordinates: empty ? undefined : 6,
      },
    },
    limitations: empty ? [] : ["Cobertura limitada al dataset autorizado"],
    lineage: { projectionId: "projection-0228e" },
  } as unknown as CrimeIncidenceAnalyticalProjection;
}

function render(input: CrimeIncidenceAnalyticalProjection) {
  return renderToStaticMarkup(React.createElement(CrimeIncidenceAnalytics, { projection: input }));
}

describe("ADR-022.8E analytical visualization", () => {
  test("renders descriptive metrics from the ADR-022.6 projection", () => {
    const markup = render(projection());
    for (const value of ["Total de eventos", ">7<", "Robo", "71.4%", "Aguascalientes", "2026-01-10"]) {
      expect(markup).toContain(value);
    }
  });

  test("consumes projection metadata and limitations", () => {
    const markup = render(projection());
    expect(markup).toContain("crime-dataset-authorized");
    expect(markup).toContain("IN_COVERAGE");
    expect(markup).toContain("Cobertura limitada al dataset autorizado");
  });

  test("does not recalculate projection metrics or mutate the projection", () => {
    const input = projection();
    const before = JSON.stringify(input);
    render(input);
    expect(JSON.stringify(input)).toBe(before);
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceAnalytics.tsx"), "utf8");
    expect(source).not.toMatch(/\.reduce\(|Math\.|\.sort\(|\.filter\(/);
  });

  test("shows explicit unavailability for empty analytical fields", () => {
    expect(render(projection(true))).toContain("Información no disponible");
  });

  test("preserves the descriptive analytical level", () => {
    expect(render(projection())).toContain("DESCRIPTIVE");
  });

  test("does not generate risk or predictive artifacts", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceAnalytics.tsx"), "utf8");
    expect(source).not.toMatch(/riskScore|prediction|predictiveModel/);
  });

  test("does not generate causal analysis", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceAnalytics.tsx"), "utf8");
    expect(source).not.toMatch(/causalAnalysis|causalFinding|causalScore/);
  });

  test("is integrated after the map and before the traceable table", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceWorkspace.tsx"), "utf8");
    expect(source.indexOf("<CrimeIncidenceMap")).toBeLessThan(source.indexOf("<CrimeIncidenceAnalytics"));
    expect(source.indexOf("<CrimeIncidenceAnalytics")).toBeLessThan(source.indexOf("Resultados trazables"));
  });

  test("standalone module renders the governed analytics component after the map and before records", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/incidencia/page.tsx"),
      "utf8"
    );

    expect(source).toContain("projectStandaloneCrimeIncidenceAnalytics");
    expect(source).toContain("<CrimeIncidenceAnalytics");
    expect(source).toContain("standalone-crime-incidence-analytics");

    expect(source.indexOf("<ProfessionalGeoMap"))
      .toBeLessThan(source.indexOf("<CrimeIncidenceAnalytics"));

    expect(source.indexOf("<CrimeIncidenceAnalytics"))
      .toBeLessThan(source.indexOf("Registros seleccionados"));

    for (const forbidden of [
      "useProject",
      "canonicalGeography",
      "PhotoAlbum",
      "CaptureAndAddPhoto",
      "tacticalStreetViews",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

});
