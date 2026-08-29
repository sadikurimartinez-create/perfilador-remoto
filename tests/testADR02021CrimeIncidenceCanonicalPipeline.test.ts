import { CrimeDatasetValidationEngine } from "../src/utils/crimeDatasetValidationEngine";
import {
  buildCrimeQueryLineage,
  classifyCrimeDataset,
  determineAguascalientesCoverage,
  normalizeCrimeRecord,
} from "../src/utils/crimeIncidenceCanonicalPipeline";

const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn();

jest.mock("../src/lib/db", () => ({
  getPool: jest.fn(() => ({
    connect: mockConnect,
  })),
}));

describe("ADR-020.21 - Crime incidence canonical pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    mockRelease.mockImplementation(() => undefined);
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
  });

  test("TEST 1 IN COVERAGE valid record preserves original coordinates and validates", () => {
    const record = normalizeCrimeRecord(
      {
        INCIDENTE: "Robo",
        FECHA: "2026-07-01",
        HORA: "7",
        LAT: "21.8818",
        LONG: "-102.2916",
      },
      "incidencia.csv"
    );

    expect(record.coverageStatus).toBe("IN_COVERAGE");
    expect(record.isValid).toBe(true);
    expect(record.originalLat).toBe(21.8818);
    expect(record.originalLng).toBe(-102.2916);
    expect(record.lat).toBe(21.8818);
    expect(record.lng).toBe(-102.2916);
    expect(record.geoValidationStatus).toBe("VALID_GEOLOCATION");
  });

  test("TEST 2 OUT OF COVERAGE is not relocated", () => {
    const record = normalizeCrimeRecord(
      {
        INCIDENTE: "Robo",
        FECHA: "2026-07-01",
        LAT: "19.4326",
        LONG: "-99.1332",
      },
      "cdmx.csv"
    );

    expect(record.coverageStatus).toBe("OUT_OF_COVERAGE");
    expect(record.originalLat).toBe(19.4326);
    expect(record.originalLng).toBe(-99.1332);
    expect(record.lat).toBeNull();
    expect(record.lng).toBeNull();
    expect(record.rejectionReason).toBe("OUT_OF_COVERAGE");
  });

  test("TEST 3 INVALID GEO is rejected", () => {
    const record = normalizeCrimeRecord(
      {
        INCIDENTE: "Robo",
        FECHA: "2026-07-01",
        LAT: "999",
        LONG: "-102.2916",
      },
      "bad.csv"
    );

    expect(record.isValid).toBe(false);
    expect(record.geoValidationStatus).not.toBe("VALID_GEOLOCATION");
    expect(record.lat).toBeNull();
    expect(record.lng).toBeNull();
  });

  test("TEST 4 dataset without explicit temporal coverage remains UNKNOWN", () => {
    const classified = classifyCrimeDataset(
      [
        {
          INCIDENTE: "Robo",
          LAT: "21.8818",
          LONG: "-102.2916",
        },
      ],
      "no-date.csv"
    );

    expect(classified.temporalCoverage).toEqual({
      start: null,
      end: null,
      status: "TEMPORAL_COVERAGE_UNKNOWN",
    });
    expect(JSON.stringify(classified)).not.toContain("2015");
    expect(JSON.stringify(classified)).not.toContain("2026");
  });

  test("TEST 5 schema-valid shape with invalid georeference is not global success", () => {
    const classified = classifyCrimeDataset(
      [
        {
          INCIDENTE: "Robo",
          FECHA: "2026-07-01",
          LAT: "0",
          LONG: "0",
        },
      ],
      "invalid-geo.csv"
    );

    expect(classified.status).toBe("GEO_INVALID");
    expect(classified.summary.validated).toBe(0);
    expect(classified.summary.rejected).toBe(1);
  });

  test("TEST 6 detectable duplicates are not double-counted", () => {
    const rows = [
      { INCIDENTE: "Robo", FECHA: "2026-07-01", HORA: "07", LAT: "21.8818", LONG: "-102.2916" },
      { INCIDENTE: "Robo", FECHA: "2026-07-01", HORA: "07", LAT: "21.8818", LONG: "-102.2916" },
    ];

    const classified = classifyCrimeDataset(rows, "dupes.csv");

    expect(classified.summary.received).toBe(2);
    expect(classified.summary.duplicates).toBe(1);
    expect(classified.records).toHaveLength(1);
    expect(classified.summary.validated).toBe(1);
  });

  test("TEST 7 upload differentiates received inserted rejected and duplicates", async () => {
    const { POST } = await import("../src/app/api/upload-csv/route");
    const csv = [
      "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG",
      "Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916",
      "Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916",
      "Robo,2026-07-01,7,Matutino,Centro,19.4326,-99.1332",
    ].join("\n");
    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      received: 3,
      validated: 1,
      rejected: 1,
      inserted: 1,
      duplicates: 1,
      validationStatus: "PARTIAL",
    });
    expect(mockQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockQuery).toHaveBeenCalledWith("COMMIT");
  });

  test("TEST 8 query lineage preserves dataset filters time range and geographic filter", () => {
    const lineage = buildCrimeQueryLineage({
      dataset: "incidencia_csv_files",
      centerLat: 21.8818,
      centerLng: -102.2916,
      radiusMeters: 1000,
      coverageStatus: determineAguascalientesCoverage(21.8818, -102.2916),
      totalScanned: 3,
      matched: 1,
      excluded: 1,
      duplicates: 1,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });

    expect(lineage.dataset).toBe("incidencia_csv_files");
    expect(lineage.filters.radiusMeters).toBe(1000);
    expect(lineage.timeRange).toEqual({ start: "2026-07-01", end: "2026-07-31", status: "KNOWN" });
    expect(lineage.geographicFilter).toMatchObject({
      center: { lat: 21.8818, lng: -102.2916 },
      coverageStatus: "IN_COVERAGE",
    });
    expect(lineage.recordSubset).toEqual({ totalScanned: 3, matched: 1, excluded: 1, duplicates: 1, returnedRecords: 1 });
  });

  test("validator does not fabricate 2015-2026 when temporal coverage is unknown", () => {
    const originalCwd = process.cwd;
    const existsSpy = jest.spyOn(require("node:fs"), "existsSync").mockReturnValue(false);

    try {
      const report = CrimeDatasetValidationEngine.validate();

      expect(report.success).toBe(false);
      expect(report.temporalCoverageStatus).toBe("TEMPORAL_COVERAGE_UNKNOWN");
      expect(report.yearMin).toBeNull();
      expect(report.yearMax).toBeNull();
    } finally {
      existsSpy.mockRestore();
      process.cwd = originalCwd;
    }
  });
});
