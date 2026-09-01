import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { CanonicalCrimeIncident } from "../src/types/crimeIncidenceWorkspace";
import type { CrimeIncidenceWorkspaceViewModel } from "../src/utils/crimeIncidenceWorkspaceAdapter";
import { toCrimeIncidenceLayerPoints } from "../src/components/maps/layers/CrimeIncidenceLayer";

type MapModule = typeof import("../src/components/crime-incidence/CrimeIncidenceMap");

function loadMapModule(): MapModule {
  const filename = path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceMap.tsx");
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const localRequire = (specifier: string) => {
    if (specifier === "react") return React;
    if (specifier.endsWith("ProfessionalGeoMap")) {
      return {
        ProfessionalGeoMap: ({ crimeIncidents }: { crimeIncidents: CanonicalCrimeIncident[] }) =>
          React.createElement("div", { "data-rendered-incidents": crimeIncidents.map((record) => record.id).join(",") }),
      };
    }
    throw new Error(`Unexpected test import: ${specifier}`);
  };
  const moduleRecord: { exports: Partial<MapModule> } = { exports: {} };
  new Function("require", "module", "exports", output)(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports as MapModule;
}

const { CrimeIncidenceMap, getCrimeIncidenceRendererGeography } = loadMapModule();

function incident(id: string, lat: number, lng: number): CanonicalCrimeIncident {
  return {
    id,
    incidentType: "Robo",
    occurredDate: "2026-08-01",
    occurredTime: null,
    timeRange: null,
    coordinates: { lat, lng, originalLat: lat, originalLng: lng },
    location: { municipality: "Aguascalientes" },
    source: { querySource: "POSTGIS", sourceStatus: "POSTGIS_AVAILABLE", sourceReference: "incidencia_estadistica" },
    coverage: { geographic: "IN_COVERAGE" },
    geoValidation: "VALID_GEOLOCATION",
    lineage: {} as CanonicalCrimeIncident["lineage"],
  };
}

function viewModel(): CrimeIncidenceWorkspaceViewModel {
  const matched = [incident("matched-1", 21.881, -102.291)];
  const excluded = [incident("excluded-1", 21.9, -102.3)];
  return {
    workspaceId: "workspace-0228c",
    expedienteId: "EXP-0228C",
    geographyContext: {
      canonicalGeography: { geometry: { type: "Point", coordinates: [-102.29, 21.88] } },
      geographicResolution: {
        geometry: { mode: "POINT_RADIUS", geometry: { type: "Point", coordinates: [-102.29, 21.88] }, radiusMeters: 1000 },
        geometryType: "POINT_RADIUS",
      },
    },
    incidents: { matched, excluded, table: [] },
    institutionalMetadata: { watermark: "CEIPOL" },
  } as unknown as CrimeIncidenceWorkspaceViewModel;
}

describe("ADR-022.8C Crime Incidence map integration", () => {
  test("renders the existing map renderer with the view model", () => {
    const markup = renderToStaticMarkup(React.createElement(CrimeIncidenceMap, { viewModel: viewModel() }));
    expect(markup).toContain("data-testid=\"crime-incidence-map\"");
    expect(markup).toContain("data-rendered-incidents=\"matched-1\"");
    expect(markup).toContain("CEIPOL");
  });

  test("renders authorized incidents and excludes non-matched records", () => {
    const model = viewModel();
    const points = toCrimeIncidenceLayerPoints(model.incidents.matched);
    expect(points.map((point) => point.technicalId)).toEqual(["matched-1"]);
    expect(points.map((point) => point.technicalId)).not.toContain("excluded-1");
  });

  test("preserves technical metadata and coordinate references", () => {
    const model = viewModel();
    const point = toCrimeIncidenceLayerPoints(model.incidents.matched)[0];
    expect(point.coordinates).toBe(model.incidents.matched[0].coordinates);
    expect(point.coordinates).toEqual({ lat: 21.881, lng: -102.291, originalLat: 21.881, originalLng: -102.291 });
    expect(point).toMatchObject({ technicalId: "matched-1", occurredDate: "2026-08-01", incidentType: "Robo", coverageStatus: "IN_COVERAGE" });
  });

  test("uses resolved point geometry without changing it", () => {
    const model = viewModel();
    const before = JSON.stringify(model);
    expect(getCrimeIncidenceRendererGeography(model)).toEqual({ center: { lat: 21.88, lng: -102.29 }, hasCoordinates: true });
    expect(JSON.stringify(model)).toBe(before);
  });

  test("renders an authoritative corridor without requiring a derived centroid", () => {
    const model = viewModel();
    model.geographyContext.geographicResolution.geometry = {
      mode: "CORRIDOR_COVERAGE",
      geometry: { type: "LineString", coordinates: [[-102.29, 21.88], [-102.28, 21.89]] },
    };
    const markup = renderToStaticMarkup(React.createElement(CrimeIncidenceMap, { viewModel: model }));
    expect(markup).toContain("data-rendered-incidents=\"matched-1\"");
    expect(markup).not.toContain("Cobertura geográfica no disponible");
  });

  test("shows unavailable coverage when the authoritative geometry has no coordinates", () => {
    const model = viewModel();
    model.geographyContext.geographicResolution.geometry = {
      mode: "CORRIDOR_COVERAGE",
      geometry: { type: "LineString", coordinates: [] },
    };
    const markup = renderToStaticMarkup(React.createElement(CrimeIncidenceMap, { viewModel: model }));
    expect(markup).toContain("Cobertura geográfica no disponible");
  });

  test("does not create evidence or mutate original records", () => {
    const model = viewModel();
    const before = JSON.stringify(model.incidents);
    const points = toCrimeIncidenceLayerPoints(model.incidents.matched) as unknown as Array<Record<string, unknown>>;
    expect(points[0].evidenceRef).toBeUndefined();
    expect(points[0].findingRef).toBeUndefined();
    expect(JSON.stringify(model.incidents)).toBe(before);
  });
});
