import fs from "node:fs";
import path from "node:path";
import {
  assessEditorialEvidence,
  buildEvidenceBoundConclusions,
  buildEvidenceBoundExecutiveSummary,
  classifyEditorialRecommendation,
  EDITORIAL_EMPTY_EVIDENCE_TEXT,
  EDITORIAL_INSUFFICIENT_EVIDENCE_TEXT,
} from "../src/utils/intelligenceLayoutEngine";

const forbiddenSpecifics = [
  /patrullaje dinamico/i,
  /corredor/i,
  /22:00/i,
  /02:00/i,
  /centro de gravedad/i,
  /giros comerciales/i,
  /predios baldios/i,
  /alumbrado publico danado/i,
];

const allConclusionText = (conclusions: ReturnType<typeof buildEvidenceBoundConclusions>) =>
  [
    ...conclusions.hallazgosCriticos,
    ...conclusions.riesgosInmediatos,
    ...conclusions.escenariosFuturos,
    ...conclusions.recomendacionesTacticas,
    ...conclusions.recomendacionesEstrategicas,
  ].join("\n");

const expectNoSpecificOperation = (text: string) => {
  for (const pattern of forbiddenSpecifics) {
    expect(text).not.toMatch(pattern);
  }
};

describe("P3-D conclusions and recommendations are evidence-bound", () => {
  test("T1 sin evidencia no produce conclusion factual", () => {
    const assessment = assessEditorialEvidence({});
    const conclusions = buildEvidenceBoundConclusions(assessment);

    expect(assessment.state).toBe("NO_EVIDENCE");
    expect(allConclusionText(conclusions)).toContain(EDITORIAL_INSUFFICIENT_EVIDENCE_TEXT);
    expectNoSpecificOperation(allConclusionText(conclusions));
  });

  test("T2 sin evidencia no produce recomendacion operativa especifica", () => {
    const assessment = assessEditorialEvidence({});
    const conclusions = buildEvidenceBoundConclusions(assessment);

    expect(conclusions.recomendacionesTacticas.join("\n")).toContain("[Generic-Non-Factual]");
    expect(classifyEditorialRecommendation("Incrementar patrullaje en corredor X de 22:00 a 02:00", assessment)).toBe("NOT_PERMITTED");
    expectNoSpecificOperation(conclusions.recomendacionesTacticas.join("\n"));
  });

  test("T3 EMPTY queda limitado al alcance y no a inexistencia absoluta", () => {
    const assessment = assessEditorialEvidence({ sweeps: [{ engine: "DENUE", denueStatus: "EMPTY", provider: "INEGI" }] });
    const conclusions = buildEvidenceBoundConclusions(assessment);
    const text = allConclusionText(conclusions);

    expect(assessment.state).toBe("EVIDENCE_EMPTY");
    expect(text).toContain(EDITORIAL_EMPTY_EVIDENCE_TEXT);
    expect(text).not.toMatch(/no existe riesgo|no hay actividad|no se detectan problemas/i);
  });

  test("T4 PROVIDER_ERROR no produce conclusion factual", () => {
    const assessment = assessEditorialEvidence({ sweeps: [{ engine: "DENUE", denueStatus: "PROVIDER_ERROR" }] });
    const conclusions = buildEvidenceBoundConclusions(assessment);

    expect(assessment.state).toBe("EVIDENCE_UNAVAILABLE");
    expect(allConclusionText(conclusions)).toContain(EDITORIAL_INSUFFICIENT_EVIDENCE_TEXT);
    expectNoSpecificOperation(allConclusionText(conclusions));
  });

  test("T5 NOT_CONFIGURED no produce recomendacion especifica", () => {
    const assessment = assessEditorialEvidence({ sweeps: [{ engine: "Pandillas", sweepStatus: "NOT_CONFIGURED" }] });
    const conclusions = buildEvidenceBoundConclusions(assessment);

    expect(assessment.state).toBe("EVIDENCE_UNAVAILABLE");
    expect(classifyEditorialRecommendation(conclusions.recomendacionesTacticas[0], assessment)).toBe("GENERIC_NON_FACTUAL");
    expectNoSpecificOperation(allConclusionText(conclusions));
  });

  test("T6 SCINCE simulated no sustenta conclusion", () => {
    const assessment = assessEditorialEvidence({
      sweeps: [{ engine: "SCINCE", providerId: "SCINCE_LOCAL_SIMULATOR", acquisitionMode: "SIMULATED", queryStatus: "SUCCESS" }],
    });

    expect(assessment.state).toBe("EVIDENCE_INELIGIBLE");
    expect(buildEvidenceBoundExecutiveSummary(assessment)).toContain(EDITORIAL_INSUFFICIENT_EVIDENCE_TEXT);
  });

  test("T7 CIFA mock no sustenta conclusion", () => {
    const assessment = assessEditorialEvidence({
      sweeps: [{ engine: "CIFA", source: "CIFA_LEGACY_DIAGNOSTIC", acquisitionMode: "MOCK", queryStatus: "SUCCESS" }],
    });

    expect(assessment.state).toBe("EVIDENCE_INELIGIBLE");
    expect(allConclusionText(buildEvidenceBoundConclusions(assessment))).toContain(EDITORIAL_INSUFFICIENT_EVIDENCE_TEXT);
  });

  test("T8 Pandillas SUCCESS usa solo atributos presentes", () => {
    const assessment = assessEditorialEvidence({
      sweeps: [{
        engine: "Pandillas",
        sweepStatus: "SUCCESS",
        provider: "PANDILLAS_API",
        traceabilityId: "trace-p3d",
        result: { hallazgo: "Coincidencia documental A", zona: "Sector A" },
      }],
    });
    const text = allConclusionText(buildEvidenceBoundConclusions(assessment));

    expect(assessment.state).toBe("EVIDENCE_SUFFICIENT");
    expect(text).toContain("Coincidencia documental A");
    expect(text).toContain("Sector A");
    expect(text).not.toMatch(/liderazgo|alianza|violencia|horario/i);
  });

  test("T9 Incidencia SUCCESS permite recomendacion derivada del patron real", () => {
    const assessment = assessEditorialEvidence({
      incidents: [{ id: "inc-1", sourceStatus: "POSTGIS_AVAILABLE", incidentType: "Robo", occurredDate: "2026-09-01" }],
    });
    const conclusions = buildEvidenceBoundConclusions(assessment);
    const text = allConclusionText(conclusions);

    expect(assessment.state).toBe("EVIDENCE_SUFFICIENT");
    expect(text).toContain("Robo");
    expect(conclusions.recomendacionesTacticas[0]).toContain("patron documentado");
    expect(classifyEditorialRecommendation(conclusions.recomendacionesTacticas[0], assessment)).toBe("EVIDENCE_DERIVED");
  });

  test("T10 no inventa horarios, corredores ni zonas", () => {
    const assessment = assessEditorialEvidence({
      incidents: [{ id: "inc-1", sourceStatus: "POSTGIS_AVAILABLE", incidentType: "Robo" }],
    });
    const text = allConclusionText(buildEvidenceBoundConclusions(assessment));

    expect(text).not.toContain("22:00");
    expect(text).not.toContain("02:00");
    expect(text).not.toMatch(/corredor X|zona roja|centro de gravedad/i);
  });

  test("T11 executive summary respeta fronteras de evidencia", () => {
    const unavailable = assessEditorialEvidence({ sweeps: [{ engine: "DENUE", denueStatus: "TIMEOUT" }] });
    const sufficient = assessEditorialEvidence({
      incidents: [{ id: "inc-1", sourceStatus: "POSTGIS_AVAILABLE", incidentType: "Robo" }],
    });

    expect(buildEvidenceBoundExecutiveSummary(unavailable)).toContain(EDITORIAL_INSUFFICIENT_EVIDENCE_TEXT);
    expect(buildEvidenceBoundExecutiveSummary(sufficient)).toContain("Robo");
    expect(buildEvidenceBoundExecutiveSummary(unavailable)).not.toMatch(/riesgo alto|patrullaje|corredor/i);
  });

  test("T12 provenance y evidence linkage se conservan", () => {
    const assessment = assessEditorialEvidence({
      incidents: [{ id: "inc-1", evidenceId: "ev-inc-1", sourceStatus: "POSTGIS_AVAILABLE", incidentType: "Robo", occurredDate: "2026-09-01" }],
      sweeps: [{ engine: "DENUE", denueStatus: "SUCCESS", provider: "INEGI", traceabilityId: "trace-denue-1", result: { hallazgo: "Comercio registrado" } }],
    });

    expect(assessment.provenance.join("\n")).toContain("ev-inc-1");
    expect(assessment.provenance.join("\n")).toContain("POSTGIS_AVAILABLE");
    expect(assessment.provenance.join("\n")).toContain("trace-denue-1");
  });

  test("T13 recomendacion generica no introduce hecho oculto", () => {
    const assessment = assessEditorialEvidence({});
    const recommendation = "Mantener documentacion, validacion humana y trazabilidad antes de ejecutar medidas especificas.";

    expect(classifyEditorialRecommendation(recommendation, assessment)).toBe("GENERIC_NON_FACTUAL");
    expectNoSpecificOperation(recommendation);
  });

  test("T14 fallback/default no crea hallazgo positivo", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/utils/intelligenceLayoutEngine.ts"), "utf8");
    const conclusionsBlock = source.slice(
      source.indexOf("// Bloque IX: Conclusiones evidence-bound"),
      source.indexOf("const executiveSummary = buildEvidenceBoundExecutiveSummary")
    );

    expect(conclusionsBlock).not.toContain("Concentración criminal de");
    expect(conclusionsBlock).not.toContain("Sincronizar las bitácoras de patrullaje dinámico nocturno");
    expect(conclusionsBlock).not.toContain("Gestionar la reparación del alumbrado público dañado");
    expect(conclusionsBlock).not.toContain("Promover la inspección de giros comerciales");
    expect(conclusionsBlock).toContain("buildEvidenceBoundConclusions(editorialEvidence)");
  });
});
