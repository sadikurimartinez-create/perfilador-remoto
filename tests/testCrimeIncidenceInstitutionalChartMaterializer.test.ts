jest.mock("../src/document-engine/ChartRenderer", () => ({
  ChartRenderer: {
    renderSvgToPng: jest.fn(async () =>
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
    ),
  },
}));

import { ChartRenderer } from "../src/document-engine/ChartRenderer";
import {
  buildCrimeIncidenceInstitutionalChartSvg,
  materializeCrimeIncidenceInstitutionalChart,
} from "../src/utils/crimeIncidenceInstitutionalChartMaterializer";
import type {
  CrimeIncidenceInstitutionalChartSpecification,
} from "../src/utils/crimeIncidenceInstitutionalVisualProducer";

class FakeSvgElement {
  readonly tagName: string;
  readonly children: FakeSvgElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> = {};
  textContent = "";

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  parentNode: FakeSvgElement | null = null;

  appendChild(child: FakeSvgElement) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;

    const index = this.parentNode.children.indexOf(this);

    if (index >= 0) {
      this.parentNode.children.splice(index, 1);
    }

    this.parentNode = null;
  }

  querySelectorAll(selector: string): FakeSvgElement[] {
    const normalized = selector.toLowerCase();
    const matches: FakeSvgElement[] = [];

    const visit = (node: FakeSvgElement) => {
      for (const child of node.children) {
        if (child.tagName.toLowerCase() === normalized) {
          matches.push(child);
        }
        visit(child);
      }
    };

    visit(this);
    return matches;
  }

  get innerText() {
    return this.textContent;
  }

  get aggregatedText(): string {
    return [
      this.textContent,
      ...this.children.map((child) => child.aggregatedText),
    ]
      .filter(Boolean)
      .join(" ");
  }
}

const fakeDocumentBody = new FakeSvgElement("body");

const fakeDocument = {
  body: fakeDocumentBody,
  createElement: (tagName: string) =>
    new FakeSvgElement(tagName),
  createElementNS: (_namespace: string, tagName: string) =>
    new FakeSvgElement(tagName),
};

Object.defineProperty(globalThis, "document", {
  value: fakeDocument,
  configurable: true,
});
function baseMetadata() {
  return {
    visualId: "crime-incidence-test:dataset-001",
    visualType: "CHART" as const,
    title: "Visual de prueba",
    datasetReference: "dataset-001",
    variables: ["incidentType", "count"],
    transformation: "Agrupación descriptiva de prueba.",
    analyticLevel: "DESCRIPTIVE" as const,
    sourceReference: "dataset-001",
    lineage: { dataset: "dataset-001" } as any,
    watermark: "CEIPOL" as const,
    method: "TEST",
    limitations: [],
  };
}

function barSpecification(): CrimeIncidenceInstitutionalChartSpecification {
  return {
    specificationVersion: "1.0",
    kind: "INCIDENT_TYPE_DISTRIBUTION",
    visualType: "CHART",
    chartType: "BAR",
    title: "Distribución de incidencia por tipo",
    subtitle: "Registros admitidos: 10",
    xAxisLabel: "Tipo de incidencia",
    yAxisLabel: "Número de registros",
    data: [
      { label: "ROBO", value: 6, percentage: 60 },
      { label: "DAÑO", value: 4, percentage: 40 },
    ],
    metadata: {
      ...baseMetadata(),
      visualId: "crime-incidence-type-distribution:dataset-001",
    },
  };
}

function lineSpecification(): CrimeIncidenceInstitutionalChartSpecification {
  return {
    specificationVersion: "1.0",
    kind: "TEMPORAL_EVOLUTION",
    visualType: "CHART",
    chartType: "LINE",
    title: "Evolución temporal observada de la incidencia",
    subtitle: "Serie descriptiva basada exclusivamente en fechas observadas",
    xAxisLabel: "Fecha de ocurrencia",
    yAxisLabel: "Número de registros",
    data: [
      { label: "2026-09-27", value: 2 },
      { label: "2026-09-28", value: 3 },
      { label: "2026-09-29", value: 5 },
    ],
    metadata: {
      ...baseMetadata(),
      visualId: "crime-incidence-temporal-evolution:dataset-001",
      variables: ["occurredDate", "count"],
    },
  };
}

describe("crimeIncidenceInstitutionalChartMaterializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("construye SVG institucional de barras desde datos observados", () => {
    const specification = barSpecification();
    specification.data[1].label = "DAÑO EN LAS COSAS";
    const svg = buildCrimeIncidenceInstitutionalChartSvg(specification);

    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 1200 700");
    expect((svg as any).aggregatedText).toContain("Distribución de incidencia por tipo");
    expect((svg as any).aggregatedText).toContain("ROBO");
    const longLabel = svg.querySelectorAll("text").find(
      (item: any) => item.textContent === "DAÑO EN LAS COSAS"
    );
    expect(Number(longLabel?.getAttribute("x"))).toBeGreaterThanOrEqual(200);
    expect((svg as any).aggregatedText).toContain("6 (60.0%)");
  });

  test("construye SVG temporal con fechas y valores observados", () => {
    const svg = buildCrimeIncidenceInstitutionalChartSvg(
      lineSpecification()
    );

    expect((svg as any).aggregatedText).toContain(
      "Evolución temporal observada de la incidencia"
    );
    expect((svg as any).aggregatedText).toContain("2026-09-27");
    expect((svg as any).aggregatedText).toContain("5");
    expect(svg.querySelectorAll("polyline")).toHaveLength(1);
    expect(svg.querySelectorAll("circle")).toHaveLength(3);
  });

  test("usa ticks enteros no duplicados para series pequenas", () => {
    const specification = lineSpecification();
    specification.data = [
      { label: "2026-09-27", value: 1 },
      { label: "2026-09-28", value: 2 },
      { label: "2026-09-29", value: 2 },
    ];
    const svg = buildCrimeIncidenceInstitutionalChartSvg(specification);
    const axisLabels = svg.querySelectorAll("text")
      .filter((item: any) => item.getAttribute("x") === "224")
      .map((item: any) => item.textContent);

    expect(axisLabels).toEqual(["2", "1", "0"]);
  });

  test("materializa PNG mediante ChartRenderer existente a escala 2", async () => {
    const specification = barSpecification();

    const asset = await materializeCrimeIncidenceInstitutionalChart(
      specification
    );

    expect(ChartRenderer.renderSvgToPng).toHaveBeenCalledTimes(1);
    expect(ChartRenderer.renderSvgToPng).toHaveBeenCalledWith(
      expect.anything(),
      2
    );

    expect(asset.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(asset.mimeType).toBe("image/png");
    expect(asset.width).toBe(1200);
    expect(asset.height).toBe(700);
    expect(asset.visualId).toBe(
      "crime-incidence-type-distribution:dataset-001"
    );
  });

  test("preserva metadata ADR-022 sin alterar lineage ni dataset", async () => {
    const specification = lineSpecification();

    const asset = await materializeCrimeIncidenceInstitutionalChart(
      specification
    );

    expect(asset.metadata).toBe(specification.metadata);
    expect(asset.metadata.datasetReference).toBe("dataset-001");
    expect(asset.metadata.analyticLevel).toBe("DESCRIPTIVE");
    expect(asset.metadata.watermark).toBe("CEIPOL");
  });

  test("retira el host temporal despues de rasterizar", async () => {
    const specification = barSpecification();

    const bodyChildrenBefore =
      (document.body as any).children.length;

    await materializeCrimeIncidenceInstitutionalChart(specification);

    const bodyChildrenAfter =
      (document.body as any).children.length;

    expect(bodyChildrenAfter).toBe(bodyChildrenBefore);
    expect(ChartRenderer.renderSvgToPng).toHaveBeenCalledWith(
      expect.anything(),
      2
    );
  });
  test("rechaza especificaciones sin datos", () => {
    const specification = barSpecification();
    specification.data = [];

    expect(() =>
      buildCrimeIncidenceInstitutionalChartSvg(specification)
    ).toThrow("CRIME_INCIDENCE_CHART_REQUIRES_DATA");
  });
});
