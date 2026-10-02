import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import type {
  CrimeIncidenceInstitutionalChartAsset,
} from "@/utils/crimeIncidenceInstitutionalChartMaterializer";
import {
  buildInstitutionalVisualProduct,
  type InstitutionalVisualProduct,
} from "@/utils/institutionalVisualProductGovernance";

export const CRIME_INCIDENCE_VISUAL_ADAPTER_VERSION = "1.0";

export interface CrimeIncidenceInstitutionalVisualCandidate {
  id: string;
  visualId: string;
  kind: CrimeIncidenceInstitutionalChartAsset["kind"];
  visualType: "CHART";
  title: string;
  caption: string;
  dataUrl: string;
  assetRef: string;

  datasetId: string;
  datasetSourceRefs: string[];
  sourceReference: string;
  sourceType: string;

  variables: string[];
  transformation: string;
  analyticLevel: "DESCRIPTIVE";

  acquisitionMode: "OBSERVED";
  isSimulated: false;

  generatedAt: string | null;

  relationKind: null;

  crimeIncidenceVisualMetadata: {
    provenance?: CrimeIncidenceInstitutionalChartAsset["metadata"];
    adapterVersion: typeof CRIME_INCIDENCE_VISUAL_ADAPTER_VERSION;
    chartKind: CrimeIncidenceInstitutionalChartAsset["kind"];
    method?: string;
    limitations: string[];
  };
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => clean(value))
        .filter(Boolean)
    )
  );
}

export function buildCrimeIncidenceInstitutionalVisualCandidate(
  asset: CrimeIncidenceInstitutionalChartAsset
): CrimeIncidenceInstitutionalVisualCandidate {
  const datasetId = clean(asset.metadata.datasetReference);
  const sourceReference = clean(asset.metadata.sourceReference);

  if (!datasetId) {
    throw new Error(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_DATASET_REFERENCE"
    );
  }

  if (!sourceReference) {
    throw new Error(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_SOURCE_REFERENCE"
    );
  }

  if (!/^data:image\/png;base64,/i.test(asset.dataUrl)) {
    throw new Error(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_PNG_ASSET"
    );
  }

  if (!asset.metadata.variables.length) {
    throw new Error(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_VARIABLES"
    );
  }

  const transformation = clean(asset.metadata.transformation);

  if (!transformation) {
    throw new Error(
      "CRIME_INCIDENCE_INSTITUTIONAL_VISUAL_REQUIRES_TRANSFORMATION"
    );
  }

  return {
    id: asset.visualId,
    visualId: asset.visualId,
    kind: asset.kind,
    visualType: "CHART",

    title: asset.title,
    caption: asset.caption,

    dataUrl: asset.dataUrl,
    assetRef: asset.dataUrl,

    datasetId,
    datasetSourceRefs: unique([
      datasetId,
      sourceReference,
    ]),
    sourceReference,
    sourceType: sourceReference,

    variables: [...asset.metadata.variables],
    transformation,
    analyticLevel: "DESCRIPTIVE",

    // ADR-022: el gráfico se deriva determinísticamente de registros
    // admitidos y observados. El adaptador no genera ni infiere valores.
    acquisitionMode: "OBSERVED",
    isSimulated: false,

    generatedAt: null,

    // Estos dos productos son descriptivos; no expresan causalidad,
    // correlación inferida ni conclusión analítica.
    relationKind: null,

    crimeIncidenceVisualMetadata: {
      provenance: asset.metadata,
      adapterVersion: CRIME_INCIDENCE_VISUAL_ADAPTER_VERSION,
      chartKind: asset.kind,
      ...(clean(asset.metadata.method)
        ? { method: clean(asset.metadata.method) }
        : {}),
      limitations: [...(asset.metadata.limitations ?? [])],
    },
  };
}

export function buildCrimeIncidenceInstitutionalVisualProduct(
  asset: CrimeIncidenceInstitutionalChartAsset,
  options: {
    canonicalGeography?: CanonicalProjectGeography | null;
  } = {}
): InstitutionalVisualProduct {
  const candidate =
    buildCrimeIncidenceInstitutionalVisualCandidate(asset);

  return buildInstitutionalVisualProduct(candidate, {
    canonicalGeography: options.canonicalGeography || null,
  });
}

export function buildCrimeIncidenceInstitutionalVisualProducts(
  assets: CrimeIncidenceInstitutionalChartAsset[],
  options: {
    canonicalGeography?: CanonicalProjectGeography | null;
  } = {}
): InstitutionalVisualProduct[] {
  return assets.map((asset) =>
    buildCrimeIncidenceInstitutionalVisualProduct(asset, options)
  );
}
