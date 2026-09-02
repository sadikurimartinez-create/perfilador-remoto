import fs from "node:fs";
import path from "node:path";

const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn();
const mockBuildCrimeSourceFingerprint = jest.fn();

jest.mock("../src/lib/db", () => ({
  getPool: jest.fn(() => ({
    connect: mockConnect,
  })),
}));

jest.mock("@/utils/crimeIncidenceSourceFingerprint.server", () => ({
  buildCrimeSourceFingerprint: mockBuildCrimeSourceFingerprint,
}));

describe("ADR-020.21 Fase 2 - Canonical persistence and query reconciliation", () => {
  const originalEnv = process.env;
  const legacyDir = path.join(process.cwd(), "scratch", "adr02021-f2-legacy-csv");
  const legacyFile = path.join(legacyDir, "adr02021-f2.csv");

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    process.env.CRIME_INCIDENCE_CSV_DIR = legacyDir;
    process.env.CRIME_INCIDENCE_DATASET_NAME =
      "Test Crime Incidence Dataset";
    process.env.CRIME_INCIDENCE_DATASET_VERSION =
      "2026-TEST-v1";
    process.env.CRIME_INCIDENCE_SOURCE_ORGANIZATION =
      "Test Institutional Source";
    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START = "2026-01-01";
    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END = "2026-12-31";

    mockQuery.mockImplementation(
      async (sql: string) => {
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
            "SELECT id"
          ) &&
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
      }
    );

    mockRelease.mockImplementation(() => undefined);
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
    mockBuildCrimeSourceFingerprint.mockReturnValue(
      "a".repeat(64)
    );
    fs.rmSync(legacyDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(legacyDir, { recursive: true, force: true });
  });

  afterAll(() => {
    fs.rmSync(legacyDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  test("TEST A PostGIS canonical available returns querySource POSTGIS", async () => {
    process.env.DATABASE_URL = "postgresql://configured-for-test";
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          incidente: "Robo",
          fecha: "2026-07-01",
          hora: "07:00:00",
          rango_horario: "Matutino",
          nom_asen: "Centro",
          fuente_archivo: "db.csv",
          lat: 21.8818,
          lng: -102.2916,
          distancia_m: 25,
        },
      ],
    });
    const { queryCrimeIncidence } = await import("../src/lib/crimeIncidenceRepository");

    const result = await queryCrimeIncidence({ lat: 21.8818, lng: -102.2916, allowLegacyFallback: false });

    expect(result.success).toBe(true);
    expect(result.querySource).toBe("POSTGIS");
    expect(result.sourceStatus).toBe("POSTGIS_AVAILABLE");
    expect(result.lineage.querySource).toBe("POSTGIS");
    expect(result.data).toHaveLength(1);
  });

  test("TEST B PostGIS not configured returns explicit state without false success", async () => {
    const { queryCrimeIncidence } = await import("../src/lib/crimeIncidenceRepository");

    const result = await queryCrimeIncidence({ lat: 21.8818, lng: -102.2916, allowLegacyFallback: false });

    expect(result.success).toBe(false);
    expect(result.querySource).toBe("NONE");
    expect(result.sourceStatus).toBe("NOT_CONFIGURED");
    expect(result.data).toEqual([]);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  test("TEST C CSV fallback is identified as LEGACY_FALLBACK", async () => {
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(
      legacyFile,
      "INCIDENTE,FECHA,HORA,LAT,LONG\nRobo,2026-07-01,7,21.8818,-102.2916\n",
      "utf8"
    );
    const { queryCrimeIncidence } = await import("../src/lib/crimeIncidenceRepository");

    const result = await queryCrimeIncidence({ lat: 21.8818, lng: -102.2916 });

    expect(result.success).toBe(true);
    expect(result.querySource).toBe("CSV_LEGACY_FALLBACK");
    expect(result.sourceStatus).toBe("CSV_LEGACY_FALLBACK");
    expect(result.lineage.dataset).toBe("incidencia_csv_files");
    expect(result.lineage.filters.postgisStatus).toBe("NOT_CONFIGURED");
  });

  test("TEST D CSV fallback cannot be presented as PostGIS response", async () => {
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(
      legacyFile,
      "INCIDENTE,FECHA,HORA,LAT,LONG\nRobo,2026-07-01,7,21.8818,-102.2916\n",
      "utf8"
    );
    const { queryCrimeIncidence } = await import("../src/lib/crimeIncidenceRepository");

    const result = await queryCrimeIncidence({ lat: 21.8818, lng: -102.2916 });

    expect(result.querySource).not.toBe("POSTGIS");
    expect(result.lineage.querySource).toBe("CSV_LEGACY_FALLBACK");
  });

  test("TEST E inserted count reflects confirmed persistence only", async () => {
    const { POST } = await import("../src/app/api/upload-csv/route");
    const csv = "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\nRobo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";
    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.inserted).toBe(1);
    expect(body.attempted).toBe(1);
    expect(body.persistenceConfirmation).toBe("DB_CONFIRMED");
  });

  test("TEST E failure does not call attempted rows inserted", async () => {
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
        throw new Error("insert failed");
      }

      return {
        rows: [],
        rowCount: 0,
      };
    });
    const { POST } = await import("../src/app/api/upload-csv/route");
    const csv = "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\nRobo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";
    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.inserted).toBe(0);
    expect(body.persistenceConfirmation).toBe("FAILED");
  });

  test("TEST E3 valid upload crosses source fingerprint boundary before persistence", async () => {
    const { POST } = await import("../src/app/api/upload-csv/route");
    const csv =
      "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\nRobo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";
    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.inserted).toBe(1);
    expect(body.attempted).toBe(1);

    expect(mockBuildCrimeSourceFingerprint).toHaveBeenCalledTimes(1);

    const fingerprintedRow =
      mockBuildCrimeSourceFingerprint.mock.calls[0][0];

    expect(fingerprintedRow).toMatchObject({
      INCIDENTE: "Robo",
      FECHA: "2026-07-01",
      HORA: "7",
      LAT: "21.8818",
      LONG: "-102.2916",
    });

    const insertCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO public.incidencia_estadistica")
    );

    expect(insertCalls).toHaveLength(1);
  });

  test("TEST E4 invalid source fingerprint rolls back and confirms no insertion", async () => {
    mockBuildCrimeSourceFingerprint.mockReturnValue("invalid");

    const { POST } = await import("../src/app/api/upload-csv/route");
    const csv =
      "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\nRobo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";
    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.inserted).toBe(0);
    expect(body.persistenceConfirmation).toBe("FAILED");

    const sqlCalls = mockQuery.mock.calls.map(([sql]) =>
      String(sql).trim()
    );

    expect(sqlCalls).toContain("BEGIN");
    expect(sqlCalls).toContain("ROLLBACK");
    expect(sqlCalls).not.toContain("COMMIT");

    const insertCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO public.incidencia_estadistica")
    );

    expect(insertCalls).toHaveLength(0);
  });

  test("TEST E1 upload fails closed when temporal governance is absent", async () => {
    delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START;
    delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END;

    const { POST } = await import("../src/app/api/upload-csv/route");
    const csv =
      "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\nRobo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";
    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe(
      "CRIME_INCIDENCE_TEMPORAL_CONFIGURATION_REQUIRED"
    );
    expect(body.inserted).toBe(0);
    expect(body.attempted).toBe(0);
    expect(body.persistenceConfirmation).toBe(
      "BLOCKED_BY_TEMPORAL_GOVERNANCE"
    );
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("TEST E2 upload fails closed when temporal governance is invalid", async () => {
    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START = "2026-01-01";
    delete process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END;

    const { POST } = await import("../src/app/api/upload-csv/route");
    const csv =
      "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\nRobo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";
    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe(
      "CRIME_INCIDENCE_TEMPORAL_CONFIGURATION_INVALID"
    );
    expect(body.inserted).toBe(0);
    expect(body.attempted).toBe(0);
    expect(body.persistenceConfirmation).toBe(
      "BLOCKED_BY_TEMPORAL_GOVERNANCE"
    );
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("TEST F lineage preserves querySource", async () => {
    process.env.DATABASE_URL = "postgresql://configured-for-test";
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { queryCrimeIncidence } = await import("../src/lib/crimeIncidenceRepository");

    const result = await queryCrimeIncidence({ lat: 21.8818, lng: -102.2916, allowLegacyFallback: false });

    expect(result.lineage.querySource).toBe(result.querySource);
    expect(result.lineage.recordSubset.returnedRecords).toBe(0);
  });

  test("TEST G OUT_OF_COVERAGE returns empty without querying or fabricating points", async () => {
    process.env.DATABASE_URL = "postgresql://configured-for-test";
    const { queryCrimeIncidence } = await import("../src/lib/crimeIncidenceRepository");

    const result = await queryCrimeIncidence({ lat: 19.4326, lng: -99.1332 });

    expect(result.sourceStatus).toBe("OUT_OF_COVERAGE");
    expect(result.querySource).toBe("NONE");
    expect(result.data).toEqual([]);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  test("TEST H Fase 1 batch dedup remains operative", async () => {
    const { classifyCrimeDataset } = await import("../src/utils/crimeIncidenceCanonicalPipeline");

    const classified = classifyCrimeDataset(
      [
        { INCIDENTE: "Robo", FECHA: "2026-07-01", HORA: "7", LAT: "21.8818", LONG: "-102.2916" },
        { INCIDENTE: "Robo", FECHA: "2026-07-01", HORA: "7", LAT: "21.8818", LONG: "-102.2916" },
      ],
      "dupes.csv"
    );

    expect(classified.summary.received).toBe(2);
    expect(classified.summary.duplicates).toBe(1);
    expect(classified.summary.validated).toBe(1);
  });
  test("TEST I new canonical incidence persists canonical row and lineage", async () => {
    const { POST } = await import("../src/app/api/upload-csv/route");

    const csv =
      "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\n" +
      "Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";

    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attempted).toBe(1);
    expect(body.inserted).toBe(1);
    expect(body.persistenceConfirmation).toBe("DB_CONFIRMED");

    const canonicalInsertCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO public.incidencia_estadistica")
    );

    const lineageCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql).includes(
        "INSERT INTO public.crime_incidence_dataset_records"
      )
    );

    expect(canonicalInsertCalls).toHaveLength(1);
    expect(lineageCalls).toHaveLength(1);

    expect(String(canonicalInsertCalls[0][0])).toContain(
      "ON CONFLICT (source_fingerprint)"
    );

    expect(lineageCalls[0][1][3]).toBe("ROW:incidencia.csv:2");
  });

  test("TEST J existing canonical incidence is reused and lineage is preserved", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      const statement = String(sql);

      if (statement.includes("FROM public.crime_incidence_datasets")) {
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
        return {
          rows: [],
          rowCount: 0,
        };
      }

      if (
        statement.includes("FROM public.incidencia_estadistica") &&
        statement.includes("WHERE source_fingerprint = $1")
      ) {
        return {
          rows: [
            {
              id: "33333333-3333-3333-3333-333333333333",
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

    const { POST } = await import("../src/app/api/upload-csv/route");

    const csv =
      "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\n" +
      "Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";

    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attempted).toBe(1);
    expect(body.inserted).toBe(0);

    const canonicalResolutionCalls = mockQuery.mock.calls.filter(([sql]) => {
      const statement = String(sql);

      return (
        statement.includes("FROM public.incidencia_estadistica") &&
        statement.includes("WHERE source_fingerprint = $1")
      );
    });

    const lineageCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql).includes(
        "INSERT INTO public.crime_incidence_dataset_records"
      )
    );

    expect(canonicalResolutionCalls).toHaveLength(1);
    expect(lineageCalls).toHaveLength(1);
    expect(lineageCalls[0][1][1]).toBe(
      "33333333-3333-3333-3333-333333333333"
    );
  });

  test("TEST K two physical rows with one fingerprint preserve two lineage records", async () => {
    let canonicalInsertOrdinal = 0;

    mockBuildCrimeSourceFingerprint.mockReturnValue(
      "d".repeat(64)
    );

    mockQuery.mockImplementation(async (sql: string) => {
      const statement = String(sql);

      if (statement.includes("FROM public.crime_incidence_datasets")) {
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
                id: "44444444-4444-4444-4444-444444444444",
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
        statement.includes("FROM public.incidencia_estadistica") &&
        statement.includes("WHERE source_fingerprint = $1")
      ) {
        return {
          rows: [
            {
              id: "44444444-4444-4444-4444-444444444444",
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

    const { POST } = await import("../src/app/api/upload-csv/route");

    const csv =
      "OID,INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\n" +
      "1,Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n" +
      "105,Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";

    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attempted).toBe(2);
    expect(body.inserted).toBe(1);

    expect(mockBuildCrimeSourceFingerprint).toHaveBeenCalledTimes(2);

    const lineageCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql).includes(
        "INSERT INTO public.crime_incidence_dataset_records"
      )
    );

    expect(lineageCalls).toHaveLength(2);

    const locators = lineageCalls.map((call) => call[1][3]);

    expect(locators).toEqual([
      "1",
      "105",
    ]);

    expect(lineageCalls[0][1][1]).toBe(
      "44444444-4444-4444-4444-444444444444"
    );

    expect(lineageCalls[1][1][1]).toBe(
      "44444444-4444-4444-4444-444444444444"
    );
  });

  test("TEST L physical fallback locator preserves original CSV row number", async () => {
    mockBuildCrimeSourceFingerprint
      .mockReturnValueOnce("e".repeat(64))
      .mockReturnValueOnce("f".repeat(64));

    const { POST } = await import("../src/app/api/upload-csv/route");

    const csv =
      "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\n" +
      "Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n" +
      "Robo,2026-07-01,7,Matutino,Centro,999,-102.2916\n" +
      "Robo,2026-07-02,8,Matutino,Centro,21.8820,-102.2920\n";

    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attempted).toBe(2);
    expect(body.inserted).toBe(2);

    const lineageCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql).includes(
        "INSERT INTO public.crime_incidence_dataset_records"
      )
    );

    expect(lineageCalls).toHaveLength(2);

    const locators = lineageCalls.map((call) => call[1][3]);

    expect(locators).toEqual([
      "ROW:incidencia.csv:2",
      "ROW:incidencia.csv:4",
    ]);
  });

  test("TEST M lineage failure rolls back canonical transaction", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      const statement = String(sql);

      if (statement.includes("FROM public.crime_incidence_datasets")) {
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
        return {
          rows: [
            {
              id: "55555555-5555-5555-5555-555555555555",
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
        throw new Error("lineage insert failed");
      }

      return {
        rows: [],
        rowCount: 0,
      };
    });

    const { POST } = await import("../src/app/api/upload-csv/route");

    const csv =
      "INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\n" +
      "Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";

    const file = new File([csv], "incidencia.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const response = await POST({ formData: async () => form } as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.inserted).toBe(0);
    expect(body.persistenceConfirmation).toBe("FAILED");

    const sqlCalls = mockQuery.mock.calls.map(([sql]) =>
      String(sql).trim()
    );

    expect(sqlCalls).toContain("BEGIN");
    expect(sqlCalls).toContain("ROLLBACK");
    expect(sqlCalls).not.toContain("COMMIT");

    const canonicalInsertCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql).includes(
        "INSERT INTO public.incidencia_estadistica"
      )
    );

    const lineageCalls = mockQuery.mock.calls.filter(([sql]) =>
      String(sql).includes(
        "INSERT INTO public.crime_incidence_dataset_records"
      )
    );

    expect(canonicalInsertCalls).toHaveLength(1);
    expect(lineageCalls).toHaveLength(1);
  });
  test("TEST N immutable lineage accepts exact idempotent identity", async () => {
    const datasetId =
      "11111111-1111-1111-1111-111111111111";

    const canonicalId =
      "66666666-6666-6666-6666-666666666666";

    const fingerprint =
      "a".repeat(64);

    mockBuildCrimeSourceFingerprint.mockReturnValue(
      fingerprint
    );

    mockQuery.mockImplementation(
      async (sql: string) => {
        const statement = String(sql);

        if (
          statement.includes(
            "FROM public.crime_incidence_datasets"
          )
        ) {
          return {
            rows: [
              {
                id: datasetId,
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
          return {
            rows: [
              {
                id: canonicalId,
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
            rowCount: 0,
          };
        }

        if (
          statement.includes(
            "FROM public.crime_incidence_dataset_records"
          ) &&
          statement.includes(
            "source_row_locator = $2"
          )
        ) {
          return {
            rows: [
              {
                incidence_id:
                  canonicalId,
                source_fingerprint:
                  fingerprint,
                source_fingerprint_version:
                  "SOURCE_FINGERPRINT_V1",
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
    );

    const { POST } =
      await import(
        "../src/app/api/upload-csv/route"
      );

    const csv =
      "OID,INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\n" +
      "5001,Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";

    const file =
      new File(
        [csv],
        "incidencia.csv",
        {
          type: "text/csv",
        }
      );

    const form =
      new FormData();

    form.set(
      "file",
      file
    );

    const response =
      await POST(
        {
          formData:
            async () => form,
        } as any
      );

    const body =
      await response.json();

    expect(
      response.status
    ).toBe(200);

    expect(
      body.ok
    ).toBe(true);

    expect(
      body.attempted
    ).toBe(1);

    expect(
      body.inserted
    ).toBe(1);

    expect(
      body.persistenceConfirmation
    ).toBe(
      "DB_CONFIRMED"
    );

    const sqlCalls =
      mockQuery.mock.calls.map(
        ([sql]) =>
          String(sql).trim()
      );

    expect(
      sqlCalls
    ).toContain("BEGIN");

    expect(
      sqlCalls
    ).toContain("COMMIT");

    expect(
      sqlCalls
    ).not.toContain("ROLLBACK");

    const lineageInsertCalls =
      mockQuery.mock.calls.filter(
        ([sql]) =>
          String(sql).includes(
            "INSERT INTO public.crime_incidence_dataset_records"
          )
      );

    const lineageResolutionCalls =
      mockQuery.mock.calls.filter(
        ([sql]) =>
          String(sql).includes(
            "FROM public.crime_incidence_dataset_records"
          ) &&
          String(sql).includes(
            "source_row_locator = $2"
          )
      );

    expect(
      lineageInsertCalls
    ).toHaveLength(1);

    expect(
      lineageResolutionCalls
    ).toHaveLength(1);

    expect(
      String(
        lineageInsertCalls[0][0]
      )
    ).toContain(
      "DO NOTHING"
    );

    expect(
      String(
        lineageInsertCalls[0][0]
      )
    ).not.toContain(
      "DO UPDATE"
    );

    expect(
      lineageResolutionCalls[0][1]
    ).toEqual([
      datasetId,
      "5001",
    ]);
  });

  test("TEST O immutable lineage rejects locator identity conflict", async () => {
    const datasetId =
      "11111111-1111-1111-1111-111111111111";

    const canonicalId =
      "77777777-7777-7777-7777-777777777777";

    const fingerprint =
      "b".repeat(64);

    mockBuildCrimeSourceFingerprint.mockReturnValue(
      fingerprint
    );

    mockQuery.mockImplementation(
      async (sql: string) => {
        const statement = String(sql);

        if (
          statement.includes(
            "FROM public.crime_incidence_datasets"
          )
        ) {
          return {
            rows: [
              {
                id: datasetId,
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
          return {
            rows: [
              {
                id: canonicalId,
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
            rowCount: 0,
          };
        }

        if (
          statement.includes(
            "FROM public.crime_incidence_dataset_records"
          ) &&
          statement.includes(
            "source_row_locator = $2"
          )
        ) {
          return {
            rows: [
              {
                incidence_id:
                  "88888888-8888-8888-8888-888888888888",
                source_fingerprint:
                  "c".repeat(64),
                source_fingerprint_version:
                  "SOURCE_FINGERPRINT_V1",
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
    );

    const errorSpy =
      jest
        .spyOn(
          console,
          "error"
        )
        .mockImplementation(
          () => undefined
        );

    const { POST } =
      await import(
        "../src/app/api/upload-csv/route"
      );

    const csv =
      "OID,INCIDENTE,FECHA,HORA,RANGO,NOM_ASEN,LAT,LONG\n" +
      "5002,Robo,2026-07-01,7,Matutino,Centro,21.8818,-102.2916\n";

    const file =
      new File(
        [csv],
        "incidencia.csv",
        {
          type: "text/csv",
        }
      );

    const form =
      new FormData();

    form.set(
      "file",
      file
    );

    const response =
      await POST(
        {
          formData:
            async () => form,
        } as any
      );

    const body =
      await response.json();

    expect(
      response.status
    ).toBe(500);

    expect(
      body.inserted
    ).toBe(0);

    expect(
      body.persistenceConfirmation
    ).toBe(
      "FAILED"
    );

    const sqlCalls =
      mockQuery.mock.calls.map(
        ([sql]) =>
          String(sql).trim()
      );

    expect(
      sqlCalls
    ).toContain("BEGIN");

    expect(
      sqlCalls
    ).toContain("ROLLBACK");

    expect(
      sqlCalls
    ).not.toContain("COMMIT");

    const lineageInsertCalls =
      mockQuery.mock.calls.filter(
        ([sql]) =>
          String(sql).includes(
            "INSERT INTO public.crime_incidence_dataset_records"
          )
      );

    const lineageResolutionCalls =
      mockQuery.mock.calls.filter(
        ([sql]) =>
          String(sql).includes(
            "FROM public.crime_incidence_dataset_records"
          ) &&
          String(sql).includes(
            "source_row_locator = $2"
          )
      );

    expect(
      lineageInsertCalls
    ).toHaveLength(1);

    expect(
      lineageResolutionCalls
    ).toHaveLength(1);

    expect(
      String(
        lineageInsertCalls[0][0]
      )
    ).toContain(
      "DO NOTHING"
    );

    expect(
      String(
        lineageInsertCalls[0][0]
      )
    ).not.toContain(
      "DO UPDATE"
    );

    expect(
      errorSpy
    ).toHaveBeenCalled();

    const errorText =
      errorSpy.mock.calls
        .flat()
        .map((value) =>
          value instanceof Error
            ? value.message
            : String(value)
        )
        .join(" ");

    expect(
      errorText
    ).toContain(
      "CRIME_INCIDENCE_LINEAGE_IDENTITY_CONFLICT"
    );

    errorSpy.mockRestore();
  });
});
