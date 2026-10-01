import {
  GeoIntAnalyticsEngine,
  type GeoIntAnalysisContext,
  type GeoIntStructuredOutput,
} from "../src/lib/geoint/geoIntAnalyticsEngine";

jest.mock("@/lib/geminiEnv", () => ({
  GCP_PROJECT_ID: "test",
  GCP_LOCATION: "test",
  GEMINI_MODEL: "test",
  GCP_CLIENT_EMAIL: "",
  GCP_PRIVATE_KEY: "",
}));
jest.mock("@google-cloud/vertexai", () => ({ VertexAI: jest.fn() }));

const context: GeoIntAnalysisContext = {
  selectedGangs: ["Grupo de prueba"],
  activeLayers: [],
  domiciles: [{
    member_id: "member-1", alias: "Prueba", gang: "Grupo de prueba",
    location: { lat: 21.8853, lng: -102.2916 }, confidence: 1, source: "fixture",
  }],
  influenceZones: [],
  manualDrawings: [],
  allGangs: [],
};
const output: GeoIntStructuredOutput = {
  pandillas_analizadas: ["Grupo de prueba"],
  zonas_criticas: [], corredores_movilidad: [], clusters_detectados: [],
  niveles_riesgo: {}, hipotesis_operacionales: ["Hipótesis de prueba pendiente de revisión"],
  correlaciones_clave: ["Relación territorial de prueba"],
  fuentes_utilizadas: ["Fuente de prueba"], confianza_global: 4.2,
};

// Exercise the fallback in isolation without invoking AI or changing its private API.
function render(input = context): string {
  return (GeoIntAnalyticsEngine as unknown as {
    buildDeterministicReport(context: GeoIntAnalysisContext, output: GeoIntStructuredOutput): string;
  }).buildDeterministicReport(input, output);
}

function territorialSection(report: string): string {
  return report.split("### 2. Análisis Territorial\n")[1].split("### 3.")[0];
}

describe("SCINCE-C01 deterministic GEOINT report containment", () => {
  test("without SCINCE data does not assert marginalization-recruitment correlation", () => {
    const report = render();
    expect(report).not.toMatch(/marginaci[oó]n|reclutamiento|SCINCE/i);
    expect(territorialSection(report)).toContain("No se aportaron datos sociodemográficos observados y trazables");
  });

  test("preserves all nine sections and supplied deterministic content", () => {
    const report = render();
    expect(report.match(/^### \d\. /gm)).toHaveLength(9);
    expect(report).toContain("**Área de Operación:**");
    expect(report).toContain("**Grupo de prueba**");
    expect(report).toContain("- Relación territorial de prueba");
    expect(report).toContain("- Hipótesis de prueba pendiente de revisión");
    expect(report).toContain("  * Fuente de prueba");
    expect(report).toContain("**4.2/10.0**");
  });

  test("does not replace the removed claim with causal or criminological territorial assertions", () => {
    for (const input of [context, { ...context, domiciles: [] }]) {
      const section = territorialSection(render(input));
      expect(section.trim()).toBe(
        `El inventario territorial recibido contiene ${input.domiciles.length} domicilios, 0 zonas de influencia y 0 trazos manuales. No se aportaron datos sociodemográficos observados y trazables para este reporte.`
      );
      expect(section).not.toMatch(/correlaci[oó]n|causal|vulnerabilidad|riesgo|crimin[oó]gen|incrementa|amplifica|demuestra|extorsi[oó]n|vandalismo/i);
    }
  });
});
