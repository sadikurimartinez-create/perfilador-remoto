import fs from "node:fs";
import path from "node:path";

const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn();

jest.mock("../src/lib/db", () => ({
  getPool: jest.fn(() => ({
    connect: mockConnect,
  })),
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
    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_START = "2026-01-01";
    process.env.CRIME_INCIDENCE_DATASET_TEMPORAL_END = "2026-12-31";
    mockQuery.mockResolvedValue({ rows: [] });
    mockRelease.mockImplementation(() => undefined);
    mockConnect.mockResolvedValue({ query: mockQuery, release: mockRelease });
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
      if (String(sql).includes("INSERT INTO incidencia_estadistica")) {
        throw new Error("insert failed");
      }
      return { rows: [] };
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
});
