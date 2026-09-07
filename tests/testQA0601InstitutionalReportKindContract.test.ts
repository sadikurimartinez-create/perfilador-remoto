jest.mock("../src/lib/exportToWord", () => ({
  exportToWord: jest.fn(() => Promise.resolve()),
}));

jest.mock("../src/utils/documentEngine", () => ({
  DocumentEngine: jest.fn().mockImplementation(() => ({
    buildDocumentPackage: jest.fn(() => ({
      metadata: {},
      projectId: "project-qa0601",
      projectName: "Proyecto QA-06.01",
      user: { id: "user-qa0601", username: "qa" },
      editorialPayload: {},
      briefing: {},
      certification: {},
      audit: {},
    })),
  })),
}));

jest.mock("../src/utils/documentRenderAdapter", () => ({
  adaptDocumentPackageForWord: jest.fn(() => ({
    projectId: "project-qa0601",
    ceipolId: "CEIPOL/QA/0601",
  })),
}));

import { exportToWord } from "../src/lib/exportToWord";
import {
  assertInstitutionalReportKind,
  InstitutionalReportKind,
  ReportEngineKernelClass,
} from "../src/lib/reportEngine";

function validInstitutionalReportInput() {
  return {
    projectId: "project-qa0601",
    generatedAt: "2026-09-07T00:00:00.000Z",
    traceabilityGate: {
      eligibleForInstitutionalPublication: true,
    },
  };
}

async function readyKernel(reportKind?: InstitutionalReportKind | string) {
  const kernel = new ReportEngineKernelClass();
  const executionId = `qa0601-${reportKind || "missing"}`;

  await kernel.dispatch("INIT_KERNEL", { executionId });

  const context = kernel.getContext();
  context.project = {
    id: "project-qa0601",
    name: "Proyecto QA-06.01",
    numeroExpediente: "07092026-0001-QA",
  };
  context.editorialPayload = {
    numeroExpediente: "07092026-0001-QA",
    institutionalReportInput: validInstitutionalReportInput(),
    certificationGateResult: { blockingReasons: [] },
  };
  context.briefing = { pages: [] };
  context.album = [];
  context.mapSnapshots = [];
  context.sweeps = [];
  context.reportKind = reportKind;

  (kernel as any).state = "VALIDATED";

  return { kernel, executionId };
}

describe("QA-06.01 Institutional reportKind contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("INSTITUTIONAL sin reportKind queda bloqueado", async () => {
    const { kernel, executionId } = await readyKernel();

    await expect(
      kernel.dispatch("EXECUTE_EXPORT", {
        format: "WORD",
        activeId: executionId,
        exportMode: "INSTITUTIONAL",
      })
    ).rejects.toThrow("INSTITUTIONAL_REPORT_KIND_REQUIRED");

    expect(exportToWord).not.toHaveBeenCalled();
  });

  test("INSTITUTIONAL con reportKind invalido queda bloqueado", () => {
    expect(() => assertInstitutionalReportKind("LEGACY")).toThrow("INSTITUTIONAL_REPORT_KIND_REQUIRED");
  });

  test("INSTITUTIONAL + EXECUTIVE_GEOINT es contrato valido y llega a exportToWord", async () => {
    const { kernel, executionId } = await readyKernel("EXECUTIVE_GEOINT");

    await kernel.dispatch("EXECUTE_EXPORT", {
      format: "WORD",
      activeId: executionId,
      exportMode: "INSTITUTIONAL",
    });

    expect(exportToWord).toHaveBeenCalledWith(
      expect.any(Object),
      "Proyecto QA-06.01",
      "07092026-0001-QA",
      expect.any(Object),
      { exportMode: "INSTITUTIONAL", reportKind: "EXECUTIVE_GEOINT" }
    );
  });

  test("INSTITUTIONAL + EXECUTIVE_GEOINT_TECHNICAL_ANNEX es contrato valido y llega a exportToWord", async () => {
    const { kernel, executionId } = await readyKernel("EXECUTIVE_GEOINT_TECHNICAL_ANNEX");

    await kernel.dispatch("EXECUTE_EXPORT", {
      format: "WORD",
      activeId: executionId,
      exportMode: "INSTITUTIONAL",
    });

    expect(exportToWord).toHaveBeenCalledWith(
      expect.any(Object),
      "Proyecto QA-06.01",
      "07092026-0001-QA",
      expect.any(Object),
      { exportMode: "INSTITUTIONAL", reportKind: "EXECUTIVE_GEOINT_TECHNICAL_ANNEX" }
    );
  });

  test("DRAFT sin reportKind sigue permitido", async () => {
    const { kernel, executionId } = await readyKernel();

    await kernel.dispatch("EXECUTE_EXPORT", {
      format: "WORD",
      activeId: executionId,
      exportMode: "DRAFT",
    });

    expect(exportToWord).toHaveBeenCalledWith(
      expect.any(Object),
      "Proyecto QA-06.01",
      "07092026-0001-QA",
      expect.any(Object),
      { exportMode: "DRAFT" }
    );
  });
});
