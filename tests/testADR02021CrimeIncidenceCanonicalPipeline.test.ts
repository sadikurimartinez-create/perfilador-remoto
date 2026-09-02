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

  test("TEST 6A configured temporal window rejects out-of-scope records without rewriting dates", () => {
    const previousStart = process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START;
    const previousEnd = process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END;

    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START = "2025-01-01";
    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END = "2025-12-31";

    try {
      const classified = classifyCrimeDataset(
        [
          {
            INCIDENTE: "Robo",
            FECHA: "24/12/2025",
            HORA: "04:00",
            LAT: "21.93338",
            LONG: "-102.29069",
          },
          {
            INCIDENTE: "Robo",
            FECHA: "24/12/2026",
            HORA: "04:00",
            LAT: "21.93338",
            LONG: "-102.29069",
          },
        ],
        "Robo negocio 2025.csv"
      );

      expect(classified.status).toBe("PARTIAL");
      expect(classified.summary.received).toBe(2);
      expect(classified.summary.validated).toBe(1);
      expect(classified.summary.rejected).toBe(1);

      const accepted = classified.records.find(
        (record) => record.date === "2025-12-24"
      );
      const rejected = classified.records.find(
        (record) => record.date === "2026-12-24"
      );

      expect(accepted?.isValid).toBe(true);
      expect(rejected?.isValid).toBe(false);
      expect(rejected?.rejectionReason).toBe("TEMPORAL_OUT_OF_SCOPE");

      // El firewall rechaza; nunca corrige ni reescribe la fecha fuente.
      expect(rejected?.date).toBe("2026-12-24");

      expect(classified.temporalCoverage).toEqual({
        start: "2025-12-24",
        end: "2025-12-24",
        status: "KNOWN",
      });
    } finally {
      if (previousStart === undefined) {
        delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START;
      } else {
        process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START = previousStart;
      }

      if (previousEnd === undefined) {
        delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END;
      } else {
        process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END = previousEnd;
      }
    }
  });

  test("TEST 6B partial temporal configuration fails closed", () => {
    const previousStart = process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START;
    const previousEnd = process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END;

    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START = "2025-01-01";
    delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END;

    try {
      const record = normalizeCrimeRecord(
        {
          INCIDENTE: "Robo",
          FECHA: "24/12/2025",
          HORA: "04:00",
          LAT: "21.93338",
          LONG: "-102.29069",
        },
        "Robo negocio 2025.csv"
      );

      expect(record.isValid).toBe(false);
      expect(record.date).toBe("2025-12-24");
      expect(record.rejectionReason).toBe(
        "TEMPORAL_CONFIGURATION_INVALID"
      );
    } finally {
      if (previousStart === undefined) {
        delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START;
      } else {
        process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START = previousStart;
      }

      if (previousEnd === undefined) {
        delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END;
      } else {
        process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END = previousEnd;
      }
    }
  });

  test("TEST 7 upload differentiates received inserted rejected and duplicates", async () => {
    const previousName =
      process.env.CRIME_INCIDENCE_DATASET_NAME;
    const previousVersion =
      process.env.CRIME_INCIDENCE_DATASET_VERSION;
    const previousOrganization =
      process.env.CRIME_INCIDENCE_SOURCE_ORGANIZATION;
    const previousStart =
      process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START;
    const previousEnd =
      process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END;

    process.env.CRIME_INCIDENCE_DATASET_NAME =
      "Test Crime Incidence Dataset";
    process.env.CRIME_INCIDENCE_DATASET_VERSION =
      "2026-TEST-v1";
    process.env.CRIME_INCIDENCE_SOURCE_ORGANIZATION =
      "Test Institutional Source";
    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START = "2026-01-01";
    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END = "2026-12-31";

    let canonicalInsertOrdinal = 0;

    mockQuery.mockImplementation(async (sql: string) => {
      const statement = String(sql);

      if (
        statement.includes(
          "FROM public.crime_incidence_datasets"
        )
      ) {
        return {
          rows: [
            {
              id: "11111111-1111-1111-1111-111111111111",
            },
          ],
          rowCount: 1,
        };
      }

      if (
        statement.includes(
          "INSERT INTO public.incidencia_estadistica"
        )
      ) {
        canonicalInsertOrdinal++;

        if (canonicalInsertOrdinal === 1) {
          return {
            rows: [
              {
                id: "22222222-2222-2222-2222-222222222222",
              },
            ],
            rowCount: 1,
          };
        }

        return {
          rows: [],
          rowCount: 0,
        };
      }

      if (
        statement.includes(
          "FROM public.incidencia_estadistica"
        ) &&
        statement.includes(
          "WHERE source_fingerprint = $1"
        )
      ) {
        return {
          rows: [
            {
              id: "22222222-2222-2222-2222-222222222222",
            },
          ],
          rowCount: 1,
        };
      }

      if (
        statement.includes(
          "INSERT INTO public.crime_incidence_dataset_records"
        )
      ) {
        return {
          rows: [],
          rowCount: 1,
        };
      }

      return {
        rows: [],
        rowCount: 0,
      };
    });

    try {
      const { POST } = await import("../src/app/api/upload-csv/route");

      const csv = [
        "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG",
        "Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916",
        "Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916",
        "Robo,2026-07-01,7,Matutino,Centro,19.4326,-99.1332",
      ].join("\n");

      const file = new File(
        [csv],
        "incidencia.csv",
        { type: "text/csv" }
      );

      const form = new FormData();
      form.set("file", file);

      const response = await POST(
        { formData: async () => form } as any
      );

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

      expect(body.attempted).toBe(2);

      expect(mockQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockQuery).toHaveBeenCalledWith("COMMIT");

      const canonicalCalls = mockQuery.mock.calls.filter(([sql]) =>
        String(sql).includes(
          "INSERT INTO public.incidencia_estadistica"
        )
      );

      const lineageCalls = mockQuery.mock.calls.filter(([sql]) =>
        String(sql).includes(
          "INSERT INTO public.crime_incidence_dataset_records"
        )
      );

      expect(canonicalCalls).toHaveLength(2);
      expect(lineageCalls).toHaveLength(2);
    } finally {
      if (previousName === undefined) {
        delete process.env.CRIME_INCIDENCE_DATASET_NAME;
      }

      if (previousName !== undefined) {
        process.env.CRIME_INCIDENCE_DATASET_NAME =
          previousName;
      }

      if (previousVersion === undefined) {
        delete process.env.CRIME_INCIDENCE_DATASET_VERSION;
      }

      if (previousVersion !== undefined) {
        process.env.CRIME_INCIDENCE_DATASET_VERSION =
          previousVersion;
      }

      if (previousOrganization === undefined) {
        delete process.env.CRIME_INCIDENCE_SOURCE_ORGANIZATION;
      }

      if (previousOrganization !== undefined) {
        process.env.CRIME_INCIDENCE_SOURCE_ORGANIZATION =
          previousOrganization;
      }

      if (previousStart === undefined) {
        delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START;
      }

      if (previousStart !== undefined) {
        process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START =
          previousStart;
      }

      if (previousEnd === undefined) {
        delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END;
      }

      if (previousEnd !== undefined) {
        process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END =
          previousEnd;
      }
    }
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
