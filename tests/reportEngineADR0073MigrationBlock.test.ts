import assert from "assert";
import { ReportEngineKernelClass } from "../src/lib/reportEngine";

describe("ADR-007.3 IIC Migration Firewall", () => {

  test("Debe bloquear acceso legacy cuando intelligenceContext es inexistente", async () => {

    const kernel = new ReportEngineKernelClass();

    const executionId = "adr0073-test";

    await kernel.dispatch("INIT_KERNEL", {
      executionId
    });

    await kernel.dispatch("LOCK_INPUT", {
      content: "# Test Report",
      project: {
        id: "TEST",
        name: "ADR0073",
        reportNumber: "EXP-ADR0073-TEST"
      },
      reportNumber: "EXP-ADR0073-TEST",
      intelligenceContext: null
    });

    await kernel.dispatch("APPLY_POWERUPS", {});

    const context = kernel.getContext();

    context.editorialPayload = {};
    context.briefing = {};

    (kernel as any).state = "LAYOUT_DERIVED";

    let blocked = false;

    try {

      await kernel.dispatch("VALIDATE_KERNEL", {
        executionId
      });

    } catch (err: any) {

      console.error(
        "ERROR REAL ADR-007.3:",
        err.message
      );

      blocked = true;

      assert.ok(
        err.message.includes("MIGRATION_BLOCKAGE"),
        "Debe bloquear acceso legacy sin IIC"
      );

    }

    assert.ok(
      blocked,
      "ADR-007.3 debe impedir continuar sin IntelligenceContext"
    );

  });

});