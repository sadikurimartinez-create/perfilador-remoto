import type { CrimeIncidenceAnalyticalProjection } from "@/types/crimeIncidenceAnalyticalProjection";
import { buildCrimeIncidenceInstitutionalVisualSpecifications } from "@/utils/crimeIncidenceInstitutionalVisualProducer";
import { materializeCrimeIncidenceInstitutionalCharts } from "@/utils/crimeIncidenceInstitutionalChartMaterializer";
import { buildCrimeIncidenceInstitutionalVisualProducts } from "@/utils/crimeIncidenceInstitutionalVisualAdapter";

export const CRIME_INCIDENCE_PAYLOAD_BRIDGE_VERSION = "1.0";

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function visualIdentity(item: any): string {
  return String(item?.visualId || item?.id || "").trim();
}

/**
 * Reconstruye exclusivamente los visuales descriptivos ADR-022
 * a partir del snapshot persistido del expediente.
 *
 * No reconstruye incidentes crudos.
 * No genera valores.
 * No altera el snapshot persistido.
 */
export async function enrichInstitutionalPayloadWithCrimeIncidenceVisuals(
  payload: any
): Promise<any> {
  const snapshot = payload?.crimeIncidenceExportContract;

  if (!snapshot) return payload;

  const metrics = snapshot?.projectionReference?.metrics;
  const datasetId = String(
    snapshot?.datasetReference?.datasetId || ""
  ).trim();

  if (
    !metrics ||
    !datasetId ||
    !snapshot?.lineage
  ) {
    return payload;
  }

  /*
   * El productor visual ADR-022 utiliza exclusivamente:
   * metrics, datasetReference, sourceQuery, limitations y lineage.
   *
   * No se inventan geographyReference, temporalReference ni registros.
   */
  const projectionForVisuals = {
    metrics,
    datasetReference: snapshot.datasetReference,
    sourceQuery: snapshot.queryReference,
    limitations: asArray(snapshot.limitations),
    lineage: snapshot.lineage,
  } as unknown as CrimeIncidenceAnalyticalProjection;

  const visualSet =
    buildCrimeIncidenceInstitutionalVisualSpecifications(
      projectionForVisuals
    );

  if (!visualSet.charts.length) {
    return payload;
  }

  const assets =
    await materializeCrimeIncidenceInstitutionalCharts(
      visualSet.charts
    );

  const crimeIncidenceVisualProducts =
    buildCrimeIncidenceInstitutionalVisualProducts(
      assets,
      {
        canonicalGeography:
          payload?.canonicalGeography || null,
      }
    );

  if (!crimeIncidenceVisualProducts.length) {
    return payload;
  }

  const generatedIds = new Set(
    crimeIncidenceVisualProducts
      .map(visualIdentity)
      .filter(Boolean)
  );

  const existingVisualProducts = asArray(
    payload?.visualProducts
  ).filter((item) => {
    const id = visualIdentity(item);

    return !id || !generatedIds.has(id);
  });

  return {
    ...payload,
    visualProducts: [
      ...existingVisualProducts,
      ...crimeIncidenceVisualProducts,
    ],
  };
}