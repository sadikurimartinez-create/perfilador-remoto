export type CrimeIncidenceComparisonTerritoryType =
  | "MUNICIPALITY"
  | "NEIGHBORHOOD"
  | "STREET"
  | "STREET_SET"
  | "CUSTOM_POLYGON";

export type CrimeIncidenceResolvedGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: Array<[number, number]> }
  | { type: "Polygon"; coordinates: Array<Array<[number, number]>> };

type ResolvableIncidenceTerritory = {
  resolvedGeometry?: CrimeIncidenceResolvedGeometry;
};

export type CrimeIncidenceComparisonTerritory =
  | (ResolvableIncidenceTerritory & {
      type: "MUNICIPALITY";
      municipality: string;
    })
  | (ResolvableIncidenceTerritory & {
      type: "NEIGHBORHOOD";
      municipality?: string;
      neighborhood: string;
    })
  | (ResolvableIncidenceTerritory & {
      type: "STREET";
      municipality?: string;
      neighborhood?: string;
      street: string;
    })
  | (ResolvableIncidenceTerritory & {
      type: "STREET_SET";
      municipality?: string;
      neighborhood?: string;
      streets: string[];
    })
  | (ResolvableIncidenceTerritory & {
      type: "CUSTOM_POLYGON";
      coordinates: Array<{ lat: number; lng: number }>;
    });

export type CrimeIncidenceCrimeFilter = {
  incidentTypes?: string[];
  categories?: string[];
};

export type CrimeIncidenceTimeRange = {
  startDate: string;
  endDate: string;
};

export type CrimeIncidenceComparisonScenario = {
  label?: string;
  territory: CrimeIncidenceComparisonTerritory;
  crimeFilter: CrimeIncidenceCrimeFilter;
  timeRange: CrimeIncidenceTimeRange;
};

export type CrimeIncidenceComparisonRequest = {
  scenarioA: CrimeIncidenceComparisonScenario;
  scenarioB: CrimeIncidenceComparisonScenario;
};

export type CrimeIncidenceTrend =
  | "INCREASE"
  | "DECREASE"
  | "STABLE"
  | "NOT_COMPARABLE";

export type CrimeIncidenceScenarioMetrics = {
  totalIncidents: number;
  incidentBreakdown: Record<string, number>;
  startDate: string;
  endDate: string;
};

export type CrimeIncidenceComparisonMetrics = {
  absoluteDifference: number;
  percentageDifference: number | null;
  trend: CrimeIncidenceTrend;
};

export type CrimeIncidenceComparisonFindingType =
  | "VOLUME_CHANGE"
  | "TERRITORIAL_CONCENTRATION"
  | "TEMPORAL_CONCENTRATION"
  | "DATA_QUALITY";

export type CrimeIncidenceComparisonFindingSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type CrimeIncidenceComparisonFinding = {
  id: string;
  type: CrimeIncidenceComparisonFindingType;
  severity: CrimeIncidenceComparisonFindingSeverity;
  title: string;
  description: string;
  evidence: Array<{
    scenario: "A" | "B" | "COMPARISON";
    metric: string;
    value: string | number | null;
  }>;
};

export type CrimeIncidenceComparisonResult = {
  request: CrimeIncidenceComparisonRequest;
  scenarioA: CrimeIncidenceScenarioMetrics;
  scenarioB: CrimeIncidenceScenarioMetrics;
  comparison: CrimeIncidenceComparisonMetrics;
  findings: CrimeIncidenceComparisonFinding[];
};

function hasValues(values: string[] | undefined): boolean {
  return Array.isArray(values) && values.some((value) => value.trim().length > 0);
}

export function hasExplicitCrimeFilter(filter: CrimeIncidenceCrimeFilter): boolean {
  return hasValues(filter.incidentTypes) || hasValues(filter.categories);
}

export function assertExplicitCrimeFilter(filter: CrimeIncidenceCrimeFilter): void {
  if (!hasExplicitCrimeFilter(filter)) {
    throw new Error("CRIME_FILTER_REQUIRED");
  }
}

export function calculateCrimeIncidenceComparisonMetrics(params: {
  scenarioA: Pick<CrimeIncidenceScenarioMetrics, "totalIncidents">;
  scenarioB: Pick<CrimeIncidenceScenarioMetrics, "totalIncidents">;
}): CrimeIncidenceComparisonMetrics {
  const totalA = params.scenarioA.totalIncidents;
  const totalB = params.scenarioB.totalIncidents;
  const absoluteDifference = totalA - totalB;

  if (totalB === 0) {
    return {
      absoluteDifference,
      percentageDifference: totalA === 0 ? 0 : null,
      trend: totalA === 0 ? "STABLE" : "NOT_COMPARABLE",
    };
  }

  const percentageDifference = (absoluteDifference / totalB) * 100;
  const trend =
    absoluteDifference === 0
      ? "STABLE"
      : absoluteDifference > 0
        ? "INCREASE"
        : "DECREASE";

  return {
    absoluteDifference,
    percentageDifference,
    trend,
  };
}
