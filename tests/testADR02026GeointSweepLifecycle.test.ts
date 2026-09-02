import fs from "node:fs";
import path from "node:path";
import {
  canTransitionGeointSweep,
  certifyGeointSweepWithHumanApproval,
  createGeointSweepLifecycleRecord,
  createHumanTriggeredRunningSweepLifecycle,
  markGeointSweepReadyForHumanReview,
  rehydrateGeointSweepLifecycleRecord,
  transitionGeointSweepLifecycle,
} from "../src/utils/geointSweepLifecycle";

describe("ADR-020.26 - GEOINT Sweep lifecycle integration", () => {
  test("TEST 1 valid progression reaches CERTIFIED only through valid transitions", () => {
    let sweep = createGeointSweepLifecycleRecord({
      sweepId: "sweep-1",
      expedienteId: "exp-1",
      now: "2026-08-29T10:00:00.000Z",
      traceabilityId: "trace-real-1",
    });
    sweep = transitionGeointSweepLifecycle(sweep, "RUNNING", { expectedVersion: 1, now: "2026-08-29T10:01:00.000Z" });
    sweep = transitionGeointSweepLifecycle(sweep, "COLLECTING", { expectedVersion: 2, now: "2026-08-29T10:02:00.000Z" });
    sweep = transitionGeointSweepLifecycle(sweep, "ANALYZING", { expectedVersion: 3, now: "2026-08-29T10:03:00.000Z" });
    sweep = markGeointSweepReadyForHumanReview(sweep, { aiQualityScore: 98, expectedVersion: 4, now: "2026-08-29T10:04:00.000Z" });
    sweep = certifyGeointSweepWithHumanApproval(sweep, {
      expectedVersion: 5,
      validatedAt: "2026-08-29T10:05:00.000Z",
      validatedBy: { id: "u-1", username: "validador.real" },
    });

    expect(sweep.status).toBe("CERTIFIED");
    expect(sweep.transitionHistory.map((entry) => entry.toStatus)).toEqual([
      "REQUESTED",
      "RUNNING",
      "COLLECTING",
      "ANALYZING",
      "VALIDATING",
      "CERTIFIED",
    ]);
    expect(sweep.humanValidationStatus).toBe("APPROVED");
  });

  test("TEST 2 invalid transition is rejected", () => {
    const sweep = createGeointSweepLifecycleRecord({ sweepId: "sweep-2", expedienteId: "exp-2" });

    expect(() => transitionGeointSweepLifecycle(sweep, "CERTIFIED", { expectedVersion: 1 })).toThrow(
      "INVALID_TRANSITION:REQUESTED->CERTIFIED"
    );
  });

  test("TEST 3 FAILED retry follows explicit policy and preserves previous failure", () => {
    let sweep = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-3", expedienteId: "exp-3" });
    sweep = transitionGeointSweepLifecycle(sweep, "FAILED", {
      expectedVersion: 2,
      reason: "PROVIDER_TIMEOUT",
      retryPolicy: { allowRetry: true, maxAttempts: 2 },
      now: "2026-08-29T10:10:00.000Z",
    });
    const retried = transitionGeointSweepLifecycle(sweep, "REQUESTED", {
      expectedVersion: 3,
      retryPolicy: { allowRetry: true, maxAttempts: 2 },
      now: "2026-08-29T10:11:00.000Z",
    });

    expect(retried.status).toBe("REQUESTED");
    expect(retried.attempt).toBe(1);
    expect(retried.previousStatus).toBe("FAILED");
    expect(retried.failureReason).toBe("PROVIDER_TIMEOUT");

    const failedWithoutPolicy = transitionGeointSweepLifecycle(
      createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-3b", expedienteId: "exp-3" }),
      "FAILED",
      { expectedVersion: 2, reason: "NO_POLICY" }
    );
    expect(() => transitionGeointSweepLifecycle(failedWithoutPolicy, "REQUESTED", { expectedVersion: 3 })).toThrow("FAILED_RETRY_NOT_ALLOWED");
  });

  test("TEST 4 CANCELLED is terminal/non-progressing", () => {
    const running = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-4", expedienteId: "exp-4" });
    const cancelled = transitionGeointSweepLifecycle(running, "CANCELLED", { expectedVersion: 2 });

    expect(canTransitionGeointSweep(cancelled.status, "RUNNING").allowed).toBe(false);
    expect(() => transitionGeointSweepLifecycle(cancelled, "RUNNING", { expectedVersion: 3 })).toThrow("TERMINAL_STATE:CANCELLED");
  });

  test("TEST 5 EXPIRED is terminal/non-progressing", () => {
    const running = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-5", expedienteId: "exp-5" });
    const expired = transitionGeointSweepLifecycle(running, "EXPIRED", { expectedVersion: 2 });

    expect(canTransitionGeointSweep(expired.status, "RUNNING").allowed).toBe(false);
    expect(() => transitionGeointSweepLifecycle(expired, "RUNNING", { expectedVersion: 3 })).toThrow("TERMINAL_STATE:EXPIRED");
  });

  test("TEST 6 persisted state reload recovers same status", () => {
    const running = createHumanTriggeredRunningSweepLifecycle({
      sweepId: "sweep-6",
      expedienteId: "exp-6",
      traceabilityId: "trace-real-6",
    });
    const persisted = JSON.parse(JSON.stringify(running));
    const rehydrated = rehydrateGeointSweepLifecycleRecord(persisted);

    expect(rehydrated.status).toBe("RUNNING");
    expect(rehydrated.version).toBe(2);
    expect(rehydrated.traceabilityId).toBe("trace-real-6");
  });

  test("TEST 7 version/concurrency policy does not silently overwrite newer state", () => {
    const running = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-7", expedienteId: "exp-7" });

    expect(() => transitionGeointSweepLifecycle(running, "COLLECTING", { expectedVersion: 1 })).toThrow(
      "GEOINT_SWEEP_VERSION_CONFLICT:2:EXPECTED_1"
    );
  });

  test("TEST 8 human-triggered sweep creates REQUESTED/RUNNING state", () => {
    const running = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-8", expedienteId: "exp-8" });

    expect(running.status).toBe("RUNNING");
    expect(running.transitionHistory.map((entry) => entry.toStatus)).toEqual(["REQUESTED", "RUNNING"]);
  });

  test("TEST 9 component mount does not create sweep lifecycle record by itself", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/modules/geoint/GeointControlledSweepEngine.tsx"),
      "utf8"
    );

    expect(source).not.toContain("createGeointSweepLifecycleRecord(");
    expect(source).not.toContain("createHumanTriggeredRunningSweepLifecycle(");
  });

  test("TEST 10 CERTIFIED requires configured validation conditions", () => {
    let sweep = createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-10", expedienteId: "exp-10" });
    sweep = transitionGeointSweepLifecycle(sweep, "COLLECTING", { expectedVersion: 2 });
    sweep = transitionGeointSweepLifecycle(sweep, "ANALYZING", { expectedVersion: 3 });
    sweep = markGeointSweepReadyForHumanReview(sweep, { aiQualityScore: 99, expectedVersion: 4 });

    expect(sweep.analysisStatus).toBe("READY_FOR_HUMAN_REVIEW");
    expect(sweep.humanValidationStatus).toBe("PENDING_REVIEW");
    expect(() => transitionGeointSweepLifecycle(sweep, "CERTIFIED", { expectedVersion: 5 })).toThrow(
      "CERTIFIED_REQUIRES_HUMAN_VALIDATION"
    );
  });

  test("TEST 11 productive architecture does not wire a mock sweep repository", () => {
    const productiveFiles = [
      "src/context/ProjectContext.tsx",
      "src/utils/geointSweepLifecycle.ts",
      "src/services/geoint/geointSweepService.ts",
      "src/services/geoint/geointSweepLifecycleEventService.ts",
    ];

    for (const relativePath of productiveFiles) {
      const source = fs.readFileSync(
        path.join(process.cwd(), relativePath),
        "utf8"
      );

      expect(source).not.toContain("MockGeointSweepStateRepository");
    }
  });
  test("TEST 12 traceabilityId absent upstream is not fabricated", () => {
    const fromDocumentOnly = createGeointSweepLifecycleRecord({
      sweepId: "sweep-doc",
      expedienteId: "exp-doc",
      correlationId: "document-id-is-not-traceability",
    });
    const fromDriveTechnicalOnly = createGeointSweepLifecycleRecord({
      sweepId: "sweep-drive",
      expedienteId: "exp-drive",
      correlationId: "file-id-and-checksum-technical",
    });
    const real = createGeointSweepLifecycleRecord({
      sweepId: "sweep-real",
      expedienteId: "exp-real",
      traceabilityId: "trace-upstream-real",
    });

    expect(fromDocumentOnly.traceabilityId).toBeNull();
    expect(fromDriveTechnicalOnly.traceabilityId).toBeNull();
    expect(real.traceabilityId).toBe("trace-upstream-real");
  });

  test("TEST 13 validator identity is preserved only when real", () => {
    const validating = markGeointSweepReadyForHumanReview(
      transitionGeointSweepLifecycle(
        transitionGeointSweepLifecycle(createHumanTriggeredRunningSweepLifecycle({ sweepId: "sweep-13", expedienteId: "exp-13" }), "COLLECTING", { expectedVersion: 2 }),
        "ANALYZING",
        { expectedVersion: 3 }
      ),
      { aiQualityScore: 91, expectedVersion: 4 }
    );
    const withIdentity = certifyGeointSweepWithHumanApproval(validating, {
      expectedVersion: 5,
      validatedAt: "2026-08-29T11:00:00.000Z",
      validatedBy: { id: "u-real", username: "persona.real" },
    });
    const withoutIdentity = certifyGeointSweepWithHumanApproval(validating, {
      expectedVersion: 5,
      validatedAt: "2026-08-29T11:01:00.000Z",
      validatedBy: null,
    });

    expect(withIdentity.validatedBy).toEqual({ id: "u-real", username: "persona.real" });
    expect(withoutIdentity.validatedBy).toBeNull();
    expect(JSON.stringify(withoutIdentity)).not.toContain("admin");
    expect(JSON.stringify(withoutIdentity)).not.toContain("analyst");
    expect(JSON.stringify(withoutIdentity)).not.toContain("system");
    expect(JSON.stringify(withoutIdentity)).not.toContain("unknown-user");
  });
});
