import fs from "node:fs";
import path from "node:path";
import {
  createHumanTriggeredRunningSweepLifecycle,
  isActiveGeointSweepLifecycleStatus,
  rehydrateGeointSweepLifecycleRecord,
} from "../src/utils/geointSweepLifecycle";

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function countMatches(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length || 0;
}

function productiveMountSources() {
  return [
    "src/components/GeographicWorkspace.tsx",
    "src/components/ProjectMap.tsx",
    "src/modules/streetView/streetViewPanoramaPicker.tsx",
    "src/components/maps/ProfessionalGeoMap.tsx",
  ].map(readSource).join("\n");
}

describe("ADR-020.27 - No auto-sweep / operational trigger governance", () => {
  test("TEST 1 open expediente with existing photos does not create sweep", () => {
    const source = readSource("src/components/GeographicWorkspace.tsx");

    expect(source).not.toContain("executeAutomaticGeointSweep");
    expect(source).not.toContain("runAutoSweep");
    expect(source).not.toContain("sweepScheduledRef");
  });

  test("TEST 2 GeographicWorkspace mount does not create sweep", () => {
    const source = readSource("src/components/GeographicWorkspace.tsx");
    const effects = source.match(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/g) || [];

    expect(effects.join("\n")).not.toContain("registerSweep(");
    expect(effects.join("\n")).not.toContain("createHumanTriggeredRunningSweepLifecycle");
    expect(effects.join("\n")).not.toContain("GEOINT_SWEEP_STARTED");
  });

  test("TEST 3 photo hydration does not create or run sweep", () => {
    const source = readSource("src/components/GeographicWorkspace.tsx");
    const georeferencedBlock = source.match(/const georeferencedPhotos[\s\S]*?\}, \[album\]\);/)?.[0] || "";

    expect(georeferencedBlock).not.toContain("registerSweep(");
    expect(georeferencedBlock).not.toContain("executeAutomaticGeointSweep");
    expect(georeferencedBlock).not.toContain("GEOINT_SWEEP_STARTED");
  });

  test("TEST 4 expedienteId change/navigation does not automatic sweep", () => {
    const source = readSource("src/components/GeographicWorkspace.tsx");
    const expedienteEffects = (source.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[expedienteId\]\);/g) || []).join("\n");

    expect(expedienteEffects).toContain("fetchFindings");
    expect(expedienteEffects).not.toContain("executeAutomaticGeointSweep");
    expect(expedienteEffects).not.toContain("GEOINT_SWEEP_STARTED");
  });

  test("TEST 5 reload/rehydration recovers existing lifecycle and creates no new lifecycle", () => {
    const existing = createHumanTriggeredRunningSweepLifecycle({
      sweepId: "sweep-reload",
      expedienteId: "exp-reload",
      traceabilityId: "trace-existing",
    });
    const rehydrated = rehydrateGeointSweepLifecycleRecord(JSON.parse(JSON.stringify(existing)));

    expect(rehydrated.sweepId).toBe("sweep-reload");
    expect(rehydrated.status).toBe("RUNNING");
    expect(rehydrated.version).toBe(existing.version);
    expect(rehydrated.transitionHistory).toHaveLength(existing.transitionHistory.length);
  });

  test("TEST 6 Street View mount/navigation does not trigger general sweep", () => {
    const source = readSource("src/modules/streetView/streetViewPanoramaPicker.tsx");

    expect(source).not.toContain("executeAutomaticGeointSweep");
    expect(source).not.toContain("registerSweep(");
    expect(source).not.toContain("GEOINT_SWEEP_STARTED");
  });

  test("TEST 7 explicit human trigger creates REQUESTED/RUNNING", () => {
    const lifecycle = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-human", expedienteId: "exp-human" });

    expect(lifecycle.status).toBe("RUNNING");
    expect(lifecycle.transitionHistory.map((entry) => entry.toStatus)).toEqual(["REQUESTED", "RUNNING"]);
  });

  test("TEST 8 explicit trigger once creates one sweep record", () => {
    const source = readSource("src/context/ProjectContext.tsx");

    expect(countMatches(source, /createHumanTriggeredRunningSweepLifecycle\(/g)).toBe(1);
    expect(source).toContain("const activeDuplicate = currentSweeps.find");
  });

  test("TEST 9 double trigger while active does not silently create duplicate active sweep", () => {
    const contextSource = readSource("src/context/ProjectContext.tsx");
    const engineSource = readSource("src/modules/geoint/GeointControlledSweepEngine.tsx");

    expect(isActiveGeointSweepLifecycleStatus("RUNNING")).toBe(true);
    expect(isActiveGeointSweepLifecycleStatus("CERTIFIED")).toBe(false);
    expect(contextSource).toContain("activeDuplicate");
    expect(engineSource).toContain("sweepExecutionLockedRef");
    expect(engineSource).toContain("if (sweepExecutionLockedRef.current) return;");
  });

  test("TEST 10 no mount path emits GEOINT_SWEEP_STARTED", () => {
    const sources = productiveMountSources();

    expect(sources).not.toContain("GEOINT_SWEEP_STARTED");
  });

  test("TEST 11 preparation/eligibility calculation does not execute sweep", () => {
    const source = readSource("src/components/GeographicWorkspace.tsx");

    expect(source).toContain("calculateSweepPreparation");
    expect(source).toContain('mode: "PREPARATION"');
    expect(source).not.toContain("REQUEST_SWEEP");
    expect(source).not.toContain("RUN_SWEEP");
    expect(source).not.toContain("executeAutomaticGeointSweep");
  });

  test("TEST 12 legacy expediente remains readable without automatic mutation", () => {
    const source = readSource("src/app/project/[id]/page.tsx");

    expect(source).not.toContain("executeAutomaticGeointSweep");
    expect(source).not.toContain("GEOINT_SWEEP_STARTED");
    expect(source).not.toContain("registerSweep(");
  });
});
