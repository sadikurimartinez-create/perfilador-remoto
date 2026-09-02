import fs from "node:fs";
import path from "node:path";
import type { BuildCrimeIncidenceWorkspaceInput } from "../src/utils/crimeIncidenceWorkspaceAdapter";
import { bindCrimeIncidenceWorkspace } from "../src/utils/crimeIncidenceWorkspaceBinding";

function artifacts(options: { matched?: boolean; coverage?: "IN_COVERAGE" | "OUT_OF_COVERAGE" } = {}): BuildCrimeIncidenceWorkspaceInput {
  const coordinates = { lat: 21.881, lng: -102.291, originalLat: 21.881, originalLng: -102.291 };
  const matchedRecord = { id: "matched-1", coordinates };
  const excludedRecord = { id: "excluded-1", coordinates: { lat: 21.9, lng: -102.3, originalLat: 21.9, originalLng: -102.3 } };
  const queryResolution = { limitations: ["DATA_ONLY"] };
  const geographicResolution = {
    expedientGeography: { expedienteId: "EXP-0228D", geographyType: "INDIVIDUAL" },
    geometry: { mode: "POINT_RADIUS", geometry: { type: "Point", coordinates: [-102.29, 21.88] }, radiusMeters: 1000 },
    coverageStatus: options.coverage ?? "IN_COVERAGE",
    matchedRecords: options.matched === false ? [] : [matchedRecord],
    excludedRecords: options.matched === false ? [matchedRecord, excludedRecord] : [excludedRecord],
    queryResolution,
  };
  const metrics = { aggregation: { matchedRecords: options.matched === false ? 0 : 1, excludedRecords: 1, recordsWithCoordinates: options.matched === false ? 0 : 1 } };
  const analyticalProjection = {
    sourceQuery: queryResolution,
    metrics,
    limitations: ["DESCRIPTIVE_ONLY"],
    datasetReference: { datasetId: "crime-dataset-2026" },
    lineage: { dataset: "crime-dataset-2026" },
  };
  const exportContract = {
    exportId: "workspace-0228d",
    expedienteId: "EXP-0228D",
    projectionReference: analyticalProjection,
    limitations: ["INSTITUTIONAL_FIREWALL"],
    institutionalMetadata: {
      watermark: "CEIPOL",
      header: "Centro de Estudios en Seguridad y Política Criminal",
      footer: "Secretaría de Seguridad Pública del Estado de Aguascalientes",
    },
  };
  return {
    expedienteId: "EXP-0228D",
    canonicalGeography: {
      geographyId: "geo-EXP-0228D-individual",
      type: "INDIVIDUAL",
      geometry: { type: "Point", coordinates: [-102.29, 21.88] },
    },
    geographicResolution,
    analyticalProjection,
    exportContract,
  } as unknown as BuildCrimeIncidenceWorkspaceInput;
}

describe("ADR-022.8D Crime Incidence data binding", () => {
  test("binds a governed ready view model and preserves the expediente", () => {
    const input = artifacts();
    const result = bindCrimeIncidenceWorkspace(input);
    expect(result.state).toBe("READY");
    expect(result.viewModel?.expedienteId).toBe("EXP-0228D");
    expect(result.viewModel?.workspaceId).toBe("workspace-0228d");
  });

  test("preserves geography and coordinate references", () => {
    const input = artifacts();
    const result = bindCrimeIncidenceWorkspace(input);
    expect(result.viewModel?.geographyContext.canonicalGeography).toBe(input.canonicalGeography);
    expect(result.viewModel?.geographyContext.geographicResolution).toBe(input.geographicResolution);
    expect(result.viewModel?.incidents.matched[0].coordinates).toBe(input.geographicResolution.matchedRecords[0].coordinates);
  });

  test("keeps matched and excluded records separated", () => {
    const result = bindCrimeIncidenceWorkspace(artifacts());
    expect(result.viewModel?.incidents.matched.map((record) => record.id)).toEqual(["matched-1"]);
    expect(result.viewModel?.incidents.excluded.map((record) => record.id)).toEqual(["excluded-1"]);
  });

  test("consumes projection metrics without recalculation", () => {
    const input = artifacts();
    const result = bindCrimeIncidenceWorkspace(input);
    expect(result.viewModel?.metrics).toBe(input.analyticalProjection.metrics);
  });

  test("represents loading, empty, and no coverage states", () => {
    expect(bindCrimeIncidenceWorkspace().state).toBe("LOADING");
    expect(bindCrimeIncidenceWorkspace(artifacts({ matched: false })).state).toBe("EMPTY");
    expect(bindCrimeIncidenceWorkspace(artifacts({ matched: false, coverage: "OUT_OF_COVERAGE" })).state).toBe("NO_COVERAGE");
  });

  test("returns an error state for an inconsistent governance chain", () => {
    const input = artifacts();
    input.expedienteId = "EXP-MISMATCH";
    const result = bindCrimeIncidenceWorkspace(input);
    expect(result.state).toBe("ERROR");
    expect(result.viewModel).toBeNull();
  });

  test("does not create evidence or mutate source artifacts", () => {
    const input = artifacts();
    const before = JSON.stringify(input);
    const result = bindCrimeIncidenceWorkspace(input) as unknown as Record<string, unknown>;
    expect(result.evidenceRef).toBeUndefined();
    expect(result.findingRef).toBeUndefined();
    expect(JSON.stringify(input)).toBe(before);
  });

  test("binding contains no acquisition, spatial calculation, or prohibited analytical logic", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/utils/crimeIncidenceWorkspaceBinding.ts"), "utf8");
    expect(source).not.toMatch(/fetch\(|axios|firebase|postgres|queryCrimeIncidence/);
    expect(source).not.toMatch(/distance|centroid|radius|heatmap|cluster/);
    expect(source).not.toMatch(/evidenceRef|findingRef|riskScore|prediction|causalAnalysis/);
  });
});
