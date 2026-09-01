import fs from "node:fs";
import path from "node:path";
import type { CanonicalCrimeIncident } from "../src/types/crimeIncidenceWorkspace";
import {
  CRIME_INCIDENCE_RENDER_BATCH_SIZE,
  getNextCrimeIncidenceRenderCount,
  toCrimeIncidenceLayerPoints,
} from "../src/components/maps/layers/CrimeIncidenceLayer";

function incident(id: string, index: number): CanonicalCrimeIncident {
  const lat = 21.8 + index / 100000;
  const lng = -102.3 - index / 100000;
  return {
    id,
    incidentType: "Robo",
    occurredDate: "2026-08-01",
    occurredTime: null,
    timeRange: null,
    coordinates: { lat, lng, originalLat: lat, originalLng: lng },
    location: { municipality: "Aguascalientes" },
    source: { querySource: "POSTGIS", sourceStatus: "POSTGIS_AVAILABLE" },
    coverage: { geographic: "IN_COVERAGE" },
    geoValidation: "VALID_GEOLOCATION",
    lineage: {} as CanonicalCrimeIncident["lineage"],
  };
}

describe("ADR-022.8H cartographic performance and scalability", () => {
  test("projects a high-volume collection without losing record identity", () => {
    const records = Array.from({ length: 10000 }, (_, index) => incident(`incident-${index}`, index));
    const points = toCrimeIncidenceLayerPoints(records);
    expect(points).toHaveLength(10000);
    expect(points[0].technicalId).toBe("incident-0");
    expect(points[9999].technicalId).toBe("incident-9999");
  });

  test("preserves original coordinate objects at high volume", () => {
    const records = Array.from({ length: 1000 }, (_, index) => incident(`incident-${index}`, index));
    const points = toCrimeIncidenceLayerPoints(records);
    points.forEach((point, index) => expect(point.coordinates).toBe(records[index].coordinates));
  });

  test("advances rendering in deterministic bounded batches", () => {
    expect(CRIME_INCIDENCE_RENDER_BATCH_SIZE).toBe(250);
    expect(getNextCrimeIncidenceRenderCount(0, 10000, 250)).toBe(250);
    expect(getNextCrimeIncidenceRenderCount(9750, 10000, 250)).toBe(10000);
    expect(getNextCrimeIncidenceRenderCount(9999, 10000, 250)).toBe(10000);
  });

  test("memoizes point projection and the layer component", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/maps/layers/CrimeIncidenceLayer.ts"), "utf8");
    expect(source).toContain("React.useMemo(() => toCrimeIncidenceLayerPoints(matchedRecords), [matchedRecords])");
    expect(source).toContain("React.memo(CrimeIncidenceLayer)");
  });

  test("reports progressive loading to the Crime Incidence map", () => {
    const layer = fs.readFileSync(path.join(process.cwd(), "src/components/maps/layers/CrimeIncidenceLayer.ts"), "utf8");
    const map = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceMap.tsx"), "utf8");
    expect(layer).toContain("onRenderProgress");
    expect(map).toContain("Cargando incidencias");
    expect(map).toContain("onCrimeIncidenceRenderProgress");
  });

  test("retains the explicit no-coverage state", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceMap.tsx"), "utf8");
    expect(source).toContain("Cobertura geográfica no disponible");
  });

  test("uses responsive Crime Incidence sizing without changing the default map minimum", () => {
    const map = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceMap.tsx"), "utf8");
    const professional = fs.readFileSync(path.join(process.cwd(), "src/components/maps/ProfessionalGeoMap.tsx"), "utf8");
    expect(map).toContain("min-h-[360px]");
    expect(map).toContain("sm:min-h-[420px]");
    expect(map).toContain('crimeIncidenceMinimumHeight="100%"');
    expect(professional).toContain("crimeIncidenceMinimumHeight ?? mapContainerStyle.minHeight");
  });

  test("does not filter data or derive spatial and predictive values", () => {
    const files = [
      "src/components/maps/layers/CrimeIncidenceLayer.ts",
      "src/components/crime-incidence/CrimeIncidenceMap.tsx",
    ];
    const source = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/\.filter\(|historicalCrimes|buffer|calculateCentroid|computeCentroid|riskScore|prediction|scoring/);
    expect(source).not.toMatch(/coordinates\.(lat|lng)\s*=|original(Lat|Lng)\s*=/);
  });
});
