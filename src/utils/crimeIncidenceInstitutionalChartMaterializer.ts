import { ChartRenderer } from "@/document-engine/ChartRenderer";
import type {
  CrimeIncidenceInstitutionalChartSpecification,
} from "@/utils/crimeIncidenceInstitutionalVisualProducer";

export const CRIME_INCIDENCE_CHART_ASSET_VERSION = "1.0";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 1200;
const HEIGHT = 700;
const MARGIN_LEFT = 170;
const MARGIN_RIGHT = 70;
const MARGIN_TOP = 130;
const MARGIN_BOTTOM = 100;

export interface CrimeIncidenceInstitutionalChartAsset {
  assetVersion: typeof CRIME_INCIDENCE_CHART_ASSET_VERSION;
  visualId: string;
  kind: CrimeIncidenceInstitutionalChartSpecification["kind"];
  visualType: "CHART";
  mimeType: "image/png";
  width: number;
  height: number;
  dataUrl: string;
  title: string;
  caption: string;
  metadata: CrimeIncidenceInstitutionalChartSpecification["metadata"];
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {}
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }

  return element;
}

function appendText(
  parent: SVGElement,
  text: string,
  x: number,
  y: number,
  options: {
    size?: number;
    weight?: number;
    anchor?: "start" | "middle" | "end";
    fill?: string;
  } = {}
) {
  const node = svgElement("text", {
    x,
    y,
    "font-family": "Arial, sans-serif",
    "font-size": options.size ?? 22,
    "font-weight": options.weight ?? 400,
    "text-anchor": options.anchor ?? "start",
    fill: options.fill ?? "#1f2937",
  });

  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function truncateLabel(value: string, max = 28): string {
  const normalized = value.trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function createBaseSvg(
  specification: CrimeIncidenceInstitutionalChartSpecification
): SVGSVGElement {
  const svg = svgElement("svg", {
    xmlns: SVG_NS,
    width: WIDTH,
    height: HEIGHT,
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
  });

  svg.style.width = `${WIDTH}px`;
  svg.style.height = `${HEIGHT}px`;

  svg.appendChild(
    svgElement("rect", {
      x: 0,
      y: 0,
      width: WIDTH,
      height: HEIGHT,
      fill: "#ffffff",
    })
  );

  appendText(svg, specification.title, 60, 55, {
    size: 30,
    weight: 700,
    fill: "#0f2742",
  });

  appendText(svg, specification.subtitle, 60, 90, {
    size: 18,
    fill: "#52606d",
  });

  return svg;
}

function renderBarChart(
  specification: CrimeIncidenceInstitutionalChartSpecification
): SVGSVGElement {
  const svg = createBaseSvg(specification);

  const data = specification.data.slice(0, 12);
  const chartWidth = WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const chartHeight = HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const rowHeight = chartHeight / Math.max(data.length, 1);
  const barHeight = Math.min(42, rowHeight * 0.62);

  svg.appendChild(
    svgElement("line", {
      x1: MARGIN_LEFT,
      x2: MARGIN_LEFT,
      y1: MARGIN_TOP,
      y2: HEIGHT - MARGIN_BOTTOM,
      stroke: "#94a3b8",
      "stroke-width": 1,
    })
  );

  data.forEach((item, index) => {
    const centerY = MARGIN_TOP + rowHeight * index + rowHeight / 2;
    const barWidth = (item.value / maxValue) * chartWidth;

    appendText(
      svg,
      truncateLabel(item.label),
      MARGIN_LEFT - 16,
      centerY + 7,
      {
        size: 18,
        anchor: "end",
        fill: "#263746",
      }
    );

    svg.appendChild(
      svgElement("rect", {
        x: MARGIN_LEFT,
        y: centerY - barHeight / 2,
        width: Math.max(barWidth, 2),
        height: barHeight,
        rx: 4,
        fill: "#315d88",
      })
    );

    const valueLabel =
      typeof item.percentage === "number"
        ? `${item.value} (${item.percentage.toFixed(1)}%)`
        : String(item.value);

    appendText(
      svg,
      valueLabel,
      Math.min(MARGIN_LEFT + barWidth + 12, WIDTH - 60),
      centerY + 7,
      {
        size: 17,
        weight: 700,
        fill: "#172b3a",
      }
    );
  });

  appendText(
    svg,
    specification.xAxisLabel,
    MARGIN_LEFT + chartWidth / 2,
    HEIGHT - 35,
    {
      size: 17,
      weight: 600,
      anchor: "middle",
      fill: "#52606d",
    }
  );

  return svg;
}

function renderLineChart(
  specification: CrimeIncidenceInstitutionalChartSpecification
): SVGSVGElement {
  const svg = createBaseSvg(specification);

  const data = specification.data.slice(-24);
  const chartWidth = WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const chartHeight = HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  const xFor = (index: number) =>
    data.length <= 1
      ? MARGIN_LEFT + chartWidth / 2
      : MARGIN_LEFT + (index / (data.length - 1)) * chartWidth;

  const yFor = (value: number) =>
    MARGIN_TOP + chartHeight - (value / maxValue) * chartHeight;

  for (let i = 0; i <= 4; i += 1) {
    const y = MARGIN_TOP + (chartHeight / 4) * i;

    svg.appendChild(
      svgElement("line", {
        x1: MARGIN_LEFT,
        x2: WIDTH - MARGIN_RIGHT,
        y1: y,
        y2: y,
        stroke: "#d7dee7",
        "stroke-width": 1,
      })
    );

    const value = Math.round(maxValue - (maxValue / 4) * i);

    appendText(svg, String(value), MARGIN_LEFT - 16, y + 6, {
      size: 16,
      anchor: "end",
      fill: "#64748b",
    });
  }

  const points = data
    .map((item, index) => `${xFor(index)},${yFor(item.value)}`)
    .join(" ");

  svg.appendChild(
    svgElement("polyline", {
      points,
      fill: "none",
      stroke: "#315d88",
      "stroke-width": 4,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );

  data.forEach((item, index) => {
    const x = xFor(index);
    const y = yFor(item.value);

    svg.appendChild(
      svgElement("circle", {
        cx: x,
        cy: y,
        r: 6,
        fill: "#315d88",
        stroke: "#ffffff",
        "stroke-width": 2,
      })
    );

    appendText(svg, String(item.value), x, y - 14, {
      size: 15,
      weight: 700,
      anchor: "middle",
      fill: "#172b3a",
    });

    const labelStep = data.length > 12 ? 3 : data.length > 8 ? 2 : 1;

    if (index % labelStep === 0 || index === data.length - 1) {
      appendText(svg, truncateLabel(item.label, 12), x, HEIGHT - 70, {
        size: 14,
        anchor: "middle",
        fill: "#52606d",
      });
    }
  });

  appendText(svg, specification.xAxisLabel, WIDTH / 2, HEIGHT - 30, {
    size: 17,
    weight: 600,
    anchor: "middle",
    fill: "#52606d",
  });

  appendText(
    svg,
    specification.yAxisLabel,
    35,
    MARGIN_TOP + chartHeight / 2,
    {
      size: 17,
      weight: 600,
      anchor: "middle",
      fill: "#52606d",
    }
  ).setAttribute(
    "transform",
    `rotate(-90 35 ${MARGIN_TOP + chartHeight / 2})`
  );

  return svg;
}

export function buildCrimeIncidenceInstitutionalChartSvg(
  specification: CrimeIncidenceInstitutionalChartSpecification
): SVGSVGElement {
  if (typeof document === "undefined") {
    throw new Error("CRIME_INCIDENCE_CHART_REQUIRES_BROWSER_DOCUMENT");
  }

  if (!specification.data.length) {
    throw new Error("CRIME_INCIDENCE_CHART_REQUIRES_DATA");
  }

  return specification.chartType === "BAR"
    ? renderBarChart(specification)
    : renderLineChart(specification);
}

export async function materializeCrimeIncidenceInstitutionalChart(
  specification: CrimeIncidenceInstitutionalChartSpecification
): Promise<CrimeIncidenceInstitutionalChartAsset> {
  const svg = buildCrimeIncidenceInstitutionalChartSvg(specification);

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${WIDTH}px`;
  host.style.height = `${HEIGHT}px`;
  host.style.visibility = "hidden";
  host.style.pointerEvents = "none";
  host.style.overflow = "hidden";

  svg.style.width = `${WIDTH}px`;
  svg.style.height = `${HEIGHT}px`;

  host.appendChild(svg);
  document.body.appendChild(host);

  let dataUrl: string;

  try {
    dataUrl = await ChartRenderer.renderSvgToPng(svg, 2);
  } finally {
    host.remove();
  }

  if (!/^data:image\/png;base64,/i.test(dataUrl)) {
    throw new Error("CRIME_INCIDENCE_CHART_RENDERER_DID_NOT_RETURN_PNG");
  }

  return {
    assetVersion: CRIME_INCIDENCE_CHART_ASSET_VERSION,
    visualId: specification.metadata.visualId,
    kind: specification.kind,
    visualType: "CHART",
    mimeType: "image/png",
    width: WIDTH,
    height: HEIGHT,
    dataUrl,
    title: specification.title,
    caption:
      specification.kind === "INCIDENT_TYPE_DISTRIBUTION"
        ? "Distribución descriptiva de los registros admitidos por tipo de incidencia."
        : "Evolución temporal descriptiva de los registros admitidos por fecha de ocurrencia.",
    metadata: specification.metadata,
  };
}

export async function materializeCrimeIncidenceInstitutionalCharts(
  specifications: CrimeIncidenceInstitutionalChartSpecification[]
): Promise<CrimeIncidenceInstitutionalChartAsset[]> {
  const assets: CrimeIncidenceInstitutionalChartAsset[] = [];

  for (const specification of specifications) {
    assets.push(
      await materializeCrimeIncidenceInstitutionalChart(specification)
    );
  }

  return assets;
}