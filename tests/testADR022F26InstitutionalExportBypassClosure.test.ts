import fs from "fs";
import path from "path";
import {
  assertInstitutionalExportAuthorization,
  assertInstitutionalPdfAuthorization,
} from "../src/lib/reportEngine";

const root = process.cwd();

function source(file: string): string {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function validInstitutionalReportInput() {
  return {
    projectId: "project-1",
    generatedAt: "2026-09-04T00:00:00.000Z",
    traceabilityGate: {
      eligibleForInstitutionalPublication: true,
    },
  } as any;
}

describe("ADR-022 FASE 2.6 - Institutional export bypass closure", () => {
  test("blocks ReportEngine institutional export without gate", () => {
    expect(() =>
      assertInstitutionalExportAuthorization({ exportMode: "INSTITUTIONAL" }, "REPORT_ENGINE")
    ).toThrow("REPORT_ENGINE_INSTITUTIONAL_EXPORT_BLOCKED:INSTITUTIONAL_REPORT_INPUT_REQUIRED");
  });

  test("allows ReportEngine draft export without institutional gate", () => {
    expect(() =>
      assertInstitutionalExportAuthorization({ exportMode: "DRAFT" }, "REPORT_ENGINE")
    ).not.toThrow();
  });

  test("blocks institutional PDF without validated report input", () => {
    expect(() =>
      assertInstitutionalPdfAuthorization({ exportMode: "INSTITUTIONAL" })
    ).toThrow("PDF_INSTITUTIONAL_EXPORT_BLOCKED:INSTITUTIONAL_REPORT_INPUT_REQUIRED");
  });

  test("allows draft and contextual PDF without institutional authorization", () => {
    expect(() => assertInstitutionalPdfAuthorization({ exportMode: "DRAFT" })).not.toThrow();
    expect(() => assertInstitutionalPdfAuthorization({ exportMode: "CONTEXTUAL" })).not.toThrow();
  });

  test("legacy routes are explicitly draft and cannot silently become institutional", () => {
    const projectPage = source("src/app/project/[id]/page.tsx");
    const photoAlbum = source("src/components/PhotoAlbum.tsx");

    expect(projectPage).toContain('{ exportMode: "DRAFT" }');
    expect(photoAlbum).toContain('{ exportMode: "DRAFT" }');
    expect(photoAlbum).toContain('payload: { format, activeId, exportMode: "DRAFT" }');
  });

  test("valid institutional authorization approves Word-class export", () => {
    expect(() =>
      assertInstitutionalExportAuthorization(
        {
          exportMode: "INSTITUTIONAL",
          institutionalReportInput: validInstitutionalReportInput(),
          certificationGateResult: { blockingReasons: [] },
        },
        "WORD"
      )
    ).not.toThrow();
  });

  test("valid institutional authorization approves PDF export", () => {
    expect(() =>
      assertInstitutionalPdfAuthorization({
        exportMode: "INSTITUTIONAL",
        institutionalReportInput: validInstitutionalReportInput(),
        certificationGateResult: { blockingReasons: [] },
      })
    ).not.toThrow();
  });

  test("ReportEngine and productive incidence route keep institutional mode explicit", () => {
    const reportEngine = source("src/lib/reportEngine.ts");
    const incidenceWorkspace = source("src/components/crime-incidence/CrimeIncidenceProductionWorkspace.tsx");

    expect(reportEngine).toContain("assertInstitutionalExportAuthorization");
    expect(reportEngine).toContain("assertInstitutionalPdfAuthorization(options)");
    expect(incidenceWorkspace).toContain('{ exportMode: "INSTITUTIONAL" }');
  });
});

