const mockQuery = jest.fn();
jest.mock("../src/lib/db", () => ({ getPool: () => ({ connect: async () => ({ query: mockQuery, release: jest.fn() }) }) }));
jest.mock("@/utils/crimeIncidenceSourceFingerprint.server", () => ({ buildCrimeSourceFingerprint: jest.fn() }));
import { queryCrimeIncidence } from "../src/lib/crimeIncidenceRepository";
import { evaluateCrimeDatasetAdmission } from "../src/utils/crimeDatasetAdmissionGate";

describe("empty PostGIS result registry provenance", () => {
  const saved = process.env.DATABASE_URL;
  beforeEach(() => { process.env.DATABASE_URL = "synthetic-offline"; mockQuery.mockReset(); });
  afterAll(() => { if (saved === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved; });
  const metadata = { dataset_id: "synthetic", dataset_name: "Official fixture", dataset_version: "fixture-v1",
    source_organization: "Fixture institution", temporal_start: "2025-01-01", temporal_end: "2025-12-31" };
  async function run(rows: unknown[]) {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows });
    return queryCrimeIncidence({ lat: 21.88, lng: -102.29, radiusMeters: 1000 });
  }
  test("zero matches retains verified registry metadata and admission", async () => {
    const result = await run([metadata]);
    expect(result.sourceStatus).toBe("POSTGIS_AVAILABLE");
    expect(result.coverageStatus).toBe("IN_COVERAGE");
    expect(result.data).toEqual([]);
    expect(result.datasetIdentity?.temporalCoverage?.status).toBe("KNOWN");
    expect(evaluateCrimeDatasetAdmission(result.datasetIdentity!).status).toBe("ADMITTED");
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls.every(([sql]) => /^\s*SELECT\b/.test(sql))).toBe(true);
  });
  test.each([[], [{ dataset_id: null }], [metadata, { ...metadata, dataset_id: "other" }]])(
    "absent, unlinked or ambiguous registry fails closed", async (...args) => {
      const result = await run(args);
      expect(result.data).toEqual([]);
      expect(evaluateCrimeDatasetAdmission(result.datasetIdentity!).status).toBe("INCOMPLETE_PROVENANCE");
    });
});
