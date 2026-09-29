import type { CrimeIncidenceAnalyticalProjection } from "@/types/crimeIncidenceAnalyticalProjection";
import type { CanonicalProjectGeography } from "@/utils/canonicalProjectGeography";
import { composeCrimeIncidenceProductionWorkspace } from "@/utils/crimeIncidenceProductionComposition";
import { buildCrimeIncidenceInstitutionalVisualSpecifications } from "@/utils/crimeIncidenceInstitutionalVisualProducer";
import { materializeCrimeIncidenceInstitutionalCharts } from "@/utils/crimeIncidenceInstitutionalChartMaterializer";
import { buildCrimeIncidenceInstitutionalVisualProducts } from "@/utils/crimeIncidenceInstitutionalVisualAdapter";
import { prepareCrimeIncidenceContractForProject } from "@/utils/institutionalStructuredPersistence";

export const CRIME_INCIDENCE_PAYLOAD_BRIDGE_VERSION = "1.0";

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function visualIdentity(item: any): string {
  return String(item?.visualId || item?.id || "").trim();
}

export interface CrimeIncidenceInstitutionalPayloadBridgeOptions {
  recoverIncompleteSnapshot?: {
    expedienteId: string;
    canonicalGeography: CanonicalProjectGeography | null | undefined;
    radiusMeters: number | null | undefined;
    requestedBy: string;
    fetcher?: typeof fetch;
  };
}

function hasPersistedMetricArrays(snapshot: any): boolean {
  const metrics = snapshot?.projectionReference?.metrics;
  const totalRecords = Number(metrics?.frequency?.totalRecords);

  if (!Number.isFinite(totalRecords)) return false;
  if (totalRecords <= 0) return true;

  return (
    Array.isArray(metrics?.frequency?.byIncidentType) &&
    Array.isArray(metrics?.percentage?.byIncidentType) &&
    Array.isArray(metrics?.distribution?.byOccurredDate) &&
    Boolean(snapshot?.lineage)
  );
}

async function resolveCrimeIncidenceSnapshot(
  payload: any,
  options: CrimeIncidenceInstitutionalPayloadBridgeOptions
): Promise<any> {
  const snapshot = payload?.crimeIncidenceExportContract;

  if (!snapshot || hasPersistedMetricArrays(snapshot)) return snapshot;

  const recovery = options.recoverIncompleteSnapshot;
  const totalRecords = Number(
    snapshot?.projectionReference?.metrics?.frequency?.totalRecords
  );

  if (!recovery || !Number.isFinite(totalRecords) || totalRecords <= 0) {
    return snapshot;
  }

  const binding = await composeCrimeIncidenceProductionWorkspace({
    expedienteId: recovery.expedienteId,
    canonicalGeography: recovery.canonicalGeography,
    radiusMeters: recovery.radiusMeters,
    requestedBy: recovery.requestedBy,
    fetcher: recovery.fetcher,
  });

  if (!binding.viewModel) {
    throw new Error(
      `CRIME_INCIDENCE_VISUAL_RECOVERY_FAILED:${binding.error || "UNKNOWN"}`
    );
  }

  const recovered = prepareCrimeIncidenceContractForProject(
    binding.viewModel.exportReference
  );

  if (!recovered || !hasPersistedMetricArrays(recovered)) {
    throw new Error(
      "CRIME_INCIDENCE_VISUAL_RECOVERY_INCOMPLETE"
    );
  }

  return recovered;
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
  payload: any,
  options: CrimeIncidenceInstitutionalPayloadBridgeOptions = {}
): Promise<any> {
  const snapshot = await resolveCrimeIncidenceSnapshot(
    payload,
    options
  );

  if (!snapshot) return payload;

  const payloadWithResolvedSnapshot =
    snapshot === payload?.crimeIncidenceExportContract
      ? payload
      : {
          ...payload,
          crimeIncidenceExportContract: snapshot,
        };

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
    return payloadWithResolvedSnapshot;
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
    return payloadWithResolvedSnapshot;
  }

  const generatedIds = new Set(
    crimeIncidenceVisualProducts
      .map(visualIdentity)
      .filter(Boolean)
  );

  const existingVisualProducts = asArray(
    payloadWithResolvedSnapshot?.visualProducts
  ).filter((item) => {
    const id = visualIdentity(item);

    return !id || !generatedIds.has(id);
  });

  return {
    ...payloadWithResolvedSnapshot,
    visualProducts: [
      ...existingVisualProducts,
      ...crimeIncidenceVisualProducts,
    ],
  };
}
