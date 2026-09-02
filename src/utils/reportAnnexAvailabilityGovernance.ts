import type { PublicationDisclosure, PublicationItemType } from "@/utils/institutionalReportPublicationContract";

type AnnexPayload = {
  maps?: Array<{ title?: string }>;
  graphs?: Array<{ title?: string }>;
  sweepsData?: Array<{ engine?: string }>;
  hypothesisGraph?: { dataUrl?: string } | null;
};

type AnnexRequest = {
  selection: unknown;
  itemId: string;
  itemType: PublicationItemType;
  code: string;
  message: string;
  available: () => boolean;
};

function isRequested(selection: unknown): boolean {
  if (selection && typeof selection === "object") {
    return (selection as { selected?: unknown }).selected === true;
  }
  return selection === true;
}

function includesAny(value: string | undefined, terms: string[]): boolean {
  const normalized = (value || "").toLocaleLowerCase("es-MX");
  return terms.some((term) => normalized.includes(term));
}

export function assessRequestedAnnexAvailability(
  payload: AnnexPayload,
  selectedAnnexes: Record<string, unknown> | null | undefined
): PublicationDisclosure[] {
  if (!selectedAnnexes) return [];

  const maps = payload.maps || [];
  const graphs = payload.graphs || [];
  const sweeps = payload.sweepsData || [];
  const visual = (selection: unknown, itemId: string, label: string, available: () => boolean): AnnexRequest => ({
    selection,
    itemId,
    itemType: "VISUAL_PRODUCT",
    code: "REQUESTED_VISUAL_PRODUCT_UNAVAILABLE",
    message: `${label} fue solicitado, pero no existe un producto real y trazable disponible para publicación.`,
    available,
  });
  const analysis = (selection: unknown, itemId: string, label: string, available: () => boolean): AnnexRequest => ({
    selection,
    itemId,
    itemType: "ANALYSIS",
    code: "REQUESTED_ANALYTICAL_PRODUCT_UNAVAILABLE",
    message: `${label} fue solicitado, pero no existe un resultado real y trazable disponible para publicación.`,
    available,
  });

  const requests: AnnexRequest[] = [
    visual(selectedAnnexes.mapDensity, "annex-map-density", "Mapa de densidad", () => maps.some((item) => includesAny(item.title, ["densidad", "calor"]))),
    visual(selectedAnnexes.mapMobility, "annex-map-mobility", "Mapa de movilidad", () => maps.some((item) => includesAny(item.title, ["corredores", "movilidad", "flujos"]))),
    visual(selectedAnnexes.mapAttractors, "annex-map-attractors", "Mapa de atractores", () => maps.some((item) => includesAny(item.title, ["atracción", "atractores", "denue"]))),
    visual(selectedAnnexes.mapPredictive, "annex-map-predictive", "Mapa predictivo", () => maps.some((item) => includesAny(item.title, ["proyección", "predicción", "predictiva"]))),
    visual(selectedAnnexes.chartTemporal, "annex-chart-temporal", "Gráfica temporal", () => graphs.some((item) => includesAny(item.title, ["temporal", "turno", "horario"]))),
    visual(selectedAnnexes.chartTopology, "annex-chart-topology", "Gráfica topológica", () => graphs.some((item) => includesAny(item.title, ["topología", "frecuencia", "incidentes"]))),
    visual(selectedAnnexes.chartEnvironmental, "annex-chart-environmental", "Gráfica ambiental", () => graphs.some((item) => includesAny(item.title, ["facilitadores", "ambiental", "oportunidad"]))),
    visual(selectedAnnexes.chartPrediction, "annex-chart-prediction", "Gráfica predictiva", () => graphs.some((item) => includesAny(item.title, ["predicción", "futuro", "aumento"]))),
    analysis(selectedAnnexes.sweepDenue, "annex-sweep-denue", "Barrido DENUE", () => sweeps.some((item) => includesAny(item.engine, ["denue", "inegi"]))),
    analysis(selectedAnnexes.sweepIncidencia, "annex-sweep-incidence", "Barrido de incidencia", () => sweeps.some((item) => includesAny(item.engine, ["incidencia", "delitos"]))),
    analysis(selectedAnnexes.sweepRepuve, "annex-sweep-repuve", "Barrido REPUVE", () => sweeps.some((item) => includesAny(item.engine, ["repuve", "vehicular"]))),
    analysis(selectedAnnexes.sweepRnpdno, "annex-sweep-rnpdno", "Barrido RNPDNO", () => sweeps.some((item) => includesAny(item.engine, ["rnpdno", "desaparecidos"]))),
    analysis(selectedAnnexes.sweepMultimodal, "annex-sweep-multimodal", "Barrido multimodal", () => sweeps.some((item) => includesAny(item.engine, ["multimodal"]))),
    analysis(selectedAnnexes.sweepCifa, "annex-sweep-cifa", "Barrido CIFA", () => sweeps.some((item) => includesAny(item.engine, ["cifa"]))),
    visual(selectedAnnexes.graphConnections, "annex-hig-connections", "Grafo HIG", () => Boolean(payload.hypothesisGraph?.dataUrl)),
  ];

  return requests
    .filter((request) => isRequested(request.selection) && !request.available())
    .map(({ itemId, itemType, code, message }) => ({ itemId, itemType, code, message }));
}
