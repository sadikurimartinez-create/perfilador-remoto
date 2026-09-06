import { readFileSync } from "fs";
import { join } from "path";
import {
  calculateInstitutionalComparison,
  calculateUserImi,
  INSUFFICIENT_INSTITUTIONAL_COMPARISON,
} from "../src/utils/imiEngine";

const root = process.cwd();
const user = { id: "u-1", username: "ana", role: "ANALISTA", name: "Ana" };
const otherUser = { id: "u-2", username: "luis", role: "ANALISTA", name: "Luis" };

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("Hardening final UI + IMI/SECAI", () => {
  test("1 usuario sin actividad queda sin score artificial", () => {
    const result = calculateUserImi(user, [], []);
    expect(result.imiFinal).toBe(0);
    expect(result.hasInstitutionalEvaluation).toBe(false);
    expect(result.currentLevel).toBe("SIN EVALUACIÓN");
  });

  test("2 SECAI no asigna bases ficticias", () => {
    const text = source("src/components/SecaiDashboard.tsx");
    expect(text).not.toMatch(/totalProjects === 0 \? (45|48|50|52)|Math\.max\(\s*(10|15|20|25|30)/);
  });

  test("3 ICE no inventa 3 evidencias", () => {
    const result = calculateUserImi(user, [{ createdById: "u-1" }], []);
    expect(result.evidenceCount).toBe(0);
    expect(result.validatedEvidenceCount).toBe(0);
    expect(result.iceScore).toBe(0);
    expect(source("src/components/SecaiDashboard.tsx")).not.toContain("photoCount || 3");
  });

  test("4 promedio institucional no es sintetico", () => {
    const comparison = calculateInstitutionalComparison(user, [], [], [user, otherUser]);
    expect(comparison.available).toBe(false);
    expect(comparison.message).toBe(INSUFFICIENT_INSTITUTIONAL_COMPARISON);
    expect(source("src/components/ImiDashboard.tsx")).not.toContain("71.2");
  });

  test("5 ranking solo usa scores reales", () => {
    const projects = [
      { createdById: "u-1", estado: "VALIDADO", canonicalGeography: { geographyId: "geo-1", type: "POINT", validationStatus: "VALID" }, reportReadyAssessment: { ready: true } },
      { createdById: "u-2", estado: "VALIDADO", canonicalGeography: { geographyId: "geo-2", type: "POINT", validationStatus: "VALID" }, reportReadyAssessment: { ready: true } },
    ];
    const comparison = calculateInstitutionalComparison(user, projects, [], [user, otherUser]);
    expect(comparison.available).toBe(true);
    expect(comparison.sampleSize).toBe(2);
    expect(source("src/components/ImiDashboard.tsx")).not.toMatch(/seed|55 \+ \(seed % 35\)/);
  });

  test("6 historico no es simulado", () => {
    const imi = source("src/components/ImiDashboard.tsx");
    const secai = source("src/components/SecaiDashboard.tsx");
    const engine = source("src/utils/imiEngine.ts");
    expect(`${imi}\n${secai}\n${engine}`).toContain("HISTÓRICO DE DESEMPEÑO NO DISPONIBLE");
    expect(`${imi}\n${secai}`).not.toMatch(/Hace 365|iciScore - 12|Promedio: 69|Promedio SSP/);
  });

  test("7 ICC no premia solo longitud", () => {
    const project = { createdById: "u-1", descripcion: "vulnerabilidad ".repeat(80) };
    expect(calculateUserImi(user, [project], []).iccScore).toBe(0);
  });

  test("8 ISH no premia conectores textuales", () => {
    const project = { createdById: "u-1", descripcion: "porque debido a consecuencia hipótesis factor causal" };
    expect(calculateUserImi(user, [project], []).ishScore).toBe(0);
  });

  test("9 ICA no premia keyword mapa", () => {
    const logs = [{ userId: "u-1", action: "mapa abierto" }];
    expect(calculateUserImi(user, [], logs).icaScore).toBe(0);
  });

  test("10 IOSINT no premia consulta igual que resultado validado", () => {
    const logs = [{ userId: "u-1", action: "consulta osint simple" }];
    const result = calculateUserImi(user, [], logs);
    expect(result.osintQueriesCount).toBe(1);
    expect(result.iosintScore).toBe(0);
  });

  test("11 IAA visible renombrado", () => {
    const text = `${source("src/components/ImiDashboard.tsx")}\n${source("src/components/SecaiDashboard.tsx")}`;
    expect(text).toContain("Gobernanza de Validación Analítica");
    expect(text).not.toMatch(/Autonomía IA|Autonomía Analítica/);
  });

  test("12 nivel visible aclarado como madurez en plataforma", () => {
    const text = `${source("src/components/ImiDashboard.tsx")}\n${source("src/components/SecaiDashboard.tsx")}`;
    expect(`${text}\n${source("src/utils/imiEngine.ts")}`).toContain("NIVEL DE MADUREZ OPERATIVA EN LA PLATAFORMA");
    expect(text).toContain("MADUREZ AVANZADA");
  });

  test("13 projectId no visible en header del expediente", () => {
    expect(source("src/app/project/[id]/page.tsx")).not.toContain("ID técnico:");
  });

  test("14 Comparacion IA no aparece", () => {
    expect(source("src/components/GeographicWorkspace.tsx")).not.toContain("Comparación IA");
    expect(source("src/components/GeographicWorkspace.tsx")).toContain("Comparación Temporal");
  });

  test("15 no alert confirm prompt nativos en flujo critico modificado", () => {
    expect(source("src/app/project/[id]/page.tsx")).not.toMatch(/\b(alert|confirm|prompt)\(/);
  });

  test("16 compatibilidad legacy createdBy username", () => {
    expect(calculateUserImi(user, [{ createdBy: "ana", estado: "VALIDADO" }], []).totalProjects).toBe(1);
  });

  test("17 createdById preferido", () => {
    const result = calculateUserImi(user, [{ createdById: "u-1", createdBy: "otro", estado: "VALIDADO" }], []);
    expect(result.totalProjects).toBe(1);
  });

  test("18 sin exposicion de datos sensibles adicionales", () => {
    const text = `${source("src/components/ImiDashboard.tsx")}\n${source("src/components/SecaiDashboard.tsx")}`;
    expect(text).not.toMatch(/confiabilidad moral|lealtad|peligrosidad|aptitud policial general|rasgos de personalidad|psicol[oó]gic/i);
  });

  test("19 TypeScript cubre contrato de resultado", () => {
    const score: number = calculateUserImi(user, [], []).imiFinal;
    expect(score).toBe(0);
  });

  test("20 build cubre constantes visibles", () => {
    expect(INSUFFICIENT_INSTITUTIONAL_COMPARISON).toBe("DATOS INSUFICIENTES PARA COMPARATIVO INSTITUCIONAL");
  });

  test("21 borrado de dictamen separa password, confirmacion institucional y confirmacion final", () => {
    const text = source("src/app/project/[id]/page.tsx");
    expect(text).toContain('useState<"password" | "institutional" | "final">("password")');
    expect(text).toContain("confirmDeleteAnalysisPassword");
    expect(text).toContain("confirmDeleteAnalysisInstitutional");
    expect(text).toContain("confirmDeleteAnalysisFinal");
    expect(text).toContain("Confirmar Eliminación");
    expect(text).toContain("Eliminar Definitivamente");
  });

  test("22 deleteDoc solo se ejecuta en la confirmacion final", () => {
    const text = source("src/app/project/[id]/page.tsx");
    const finalFn = text.match(/const confirmDeleteAnalysisFinal = async \(\) => \{[\s\S]*?\n  \};/);
    const passwordFn = text.match(/const confirmDeleteAnalysisPassword = async \(\) => \{[\s\S]*?\n  \};/);
    const institutionalFn = text.match(/const confirmDeleteAnalysisInstitutional = \(\) => \{[\s\S]*?\n  \};/);
    expect(finalFn?.[0]).toContain("deleteDoc");
    expect(passwordFn?.[0]).not.toContain("deleteDoc");
    expect(institutionalFn?.[0]).not.toContain("deleteDoc");
  });

  test("23 cancelacion de borrado limpia password y reinicia pasos", () => {
    const cancelFn = source("src/app/project/[id]/page.tsx").match(/const cancelDeleteAnalysis = \(\) => \{[\s\S]*?\n  \};/);
    expect(cancelFn?.[0]).toContain('setDeletePasswordInput("")');
    expect(cancelFn?.[0]).toContain('setDeleteAnalysisStep("password")');
    expect(cancelFn?.[0]).toContain("setPendingDeleteAnalysisId(null)");
  });

  test("24 IGEO puntua con geographyId POINT y validationStatus VALID", () => {
    const project = { createdById: "u-1", canonicalGeography: { geographyId: "geo-1", type: "POINT", validationStatus: "VALID" } };
    expect(calculateUserImi(user, [project], []).igeoScore).toBe(100);
  });

  test("25 IGEO no puntua sin validationStatus", () => {
    const project = { createdById: "u-1", canonicalGeography: { geographyId: "geo-1", type: "POINT" } };
    expect(calculateUserImi(user, [project], []).igeoScore).toBe(0);
  });

  test("26 IGEO no puntua con validationStatus INVALID", () => {
    const project = { createdById: "u-1", canonicalGeography: { geographyId: "geo-1", type: "POINT", validationStatus: "INVALID" } };
    expect(calculateUserImi(user, [project], []).igeoScore).toBe(0);
  });

  test("27 IGEO no premia POLYGON VALID por encima de POINT VALID", () => {
    const point = { createdById: "u-1", canonicalGeography: { geographyId: "geo-1", type: "POINT", validationStatus: "VALID" } };
    const polygon = { createdById: "u-1", canonicalGeography: { geographyId: "geo-2", type: "POLYGON", validationStatus: "VALID" } };
    expect(calculateUserImi(user, [polygon], []).igeoScore).toBe(calculateUserImi(user, [point], []).igeoScore);
  });

  test("28 convergencia DRAFT no puntua ICA", () => {
    const project = { createdById: "u-1", institutionalMultisourceConvergence: { convergencias: [{ status: "DRAFT" }] } };
    expect(calculateUserImi(user, [project], []).icaScore).toBe(0);
  });

  test("29 convergencia PENDING_REVIEW no puntua ICA", () => {
    const project = { createdById: "u-1", institutionalMultisourceConvergence: { convergencias: [{ reviewStatus: "PENDING_REVIEW" }] } };
    expect(calculateUserImi(user, [project], []).icaScore).toBe(0);
  });

  test("30 convergencia APPROVED puntua ICA", () => {
    const project = { createdById: "u-1", institutionalMultisourceConvergence: { convergencias: [{ status: "APPROVED" }] } };
    expect(calculateUserImi(user, [project], []).icaScore).toBeGreaterThan(0);
  });

  test("31 keyword mapa sigue sin puntuar ICA", () => {
    const logs = [{ userId: "u-1", action: "mapa de relaciones abierto", validationStatus: "APPROVED" }];
    expect(calculateUserImi(user, [], logs).icaScore).toBe(0);
  });

  test("32 correlacion aprobada real puntua ICA", () => {
    const project = { createdById: "u-1", approvedCorrelations: [{ id: "corr-1" }] };
    expect(calculateUserImi(user, [project], []).icaScore).toBeGreaterThan(0);
  });
});
