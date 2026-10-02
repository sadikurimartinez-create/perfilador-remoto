import { buildInstitutionalReportInput } from "./institutionalReportPublicationContract";
import { buildExecutiveGeointReportModel } from "./executiveGeointReportModel";
import { buildExecutiveVisualComposition } from "./executiveVisualComposition";
import { buildExecutiveGeointReportDocumentModel } from "./executiveGeointReportDocumentModel";
import { collectDocumentCitedVisualIds } from "./institutionalDocumentSemanticIntegrity";
import { buildExecutiveCanonicalTerritorialMapSpec } from "./executiveCanonicalTerritorialMap";
import { buildDenueGovernedCartographicProduct } from "./denueGovernedCartographicProduct";
import { selectDenueCartographicDisplay } from "./denueCartographicDisplaySelection";
import { integrateDenueAnalyticalPublicationForReport } from "@/services/denueAnalyticalReportGenerationService";
import { getScinceDocumentContext } from "@/lib/scinceDocumentActions";
import { integrateScinceDocumentContextForReport } from "./scinceDocumentContext";

/** Existing P2→P5 model construction shared by generation and authoritative revalidation.
 * This function does not acquire image assets or introduce another report engine. */
export async function buildInstitutionalGenerationModels(payload: any, projectName: string, reportNumber?: string, user?: any, fixedGeneratedAt?: string) {
  const basePayload = {
    ...payload,
    denueAnalyticalCartographicProductResult: undefined,
    denueAnalyticalCartographicProduct: undefined,
    denueAnalyticalMapRenderModel: undefined,
    denueAnalyticalRelations: undefined,
    denueAnalyticalReviewLedger: undefined,
    denueAnalytical: payload.denueAnalytical ? {
      ...payload.denueAnalytical,
      cartographicProductResult: undefined,
      cartographicProduct: undefined,
      relations: undefined,
    } : undefined,
  };
  let institutionalReportInput = buildInstitutionalReportInput(basePayload, { generatedAt: fixedGeneratedAt });
  institutionalReportInput = await integrateScinceDocumentContextForReport(institutionalReportInput, getScinceDocumentContext);
  const generatedAt = institutionalReportInput.generatedAt;
  const numeroExpediente = payload.numeroExpediente || reportNumber;
  const projectId = payload.projectId || institutionalReportInput.projectId;
  let governedDenueRenderingInput = null;
  let denueLayers: import("./denueGovernedMapAdapter").DenueGovernedMapLayer[] = [];
  let contextualDisplayedCount = 0;
  if (institutionalReportInput.geography && institutionalReportInput.denuePois?.length) {
    const denueProductResult = buildDenueGovernedCartographicProduct({
      projectId: institutionalReportInput.projectId,
      geographyId: institutionalReportInput.geography.geographyId,
      canonicalGeographyReference: {
        geographyId: institutionalReportInput.geography.geographyId,
        geographyType: institutionalReportInput.geography.type,
        geometryType: institutionalReportInput.geography.geometry.type,
        sourceReference: `canonical-geography:${institutionalReportInput.geography.source}:${institutionalReportInput.geography.geographyId}`,
      },
      observations: institutionalReportInput.denuePois,
      createdAtReference: `report-snapshot:${generatedAt}`,
    });
    if (denueProductResult.product) {
      denueLayers = denueProductResult.product.layers as import("./denueGovernedMapAdapter").DenueGovernedMapLayer[];
      const displaySelection = selectDenueCartographicDisplay(denueProductResult.product);
      if (displaySelection.status === "PLANNED") {
        contextualDisplayedCount = displaySelection.plan.audit.selectedCount;
        governedDenueRenderingInput = {
          product: denueProductResult.product,
          displayPlan: displaySelection.plan,
        };
      }
    }
  }
  const denueAnalyticalPublication = await integrateDenueAnalyticalPublicationForReport({
    institutionalReportInput,
    denueLayers,
    contextualDisplayedCount,
    createdAtReference: `report-snapshot:${generatedAt}`,
  });
  institutionalReportInput = denueAnalyticalPublication.institutionalReportInput;
  const executiveModel = buildExecutiveGeointReportModel(institutionalReportInput, {
    documentIdentity: {
      numeroExpediente,
      ceipolId: payload.ceipolId,
      projectId,
      name: projectName,
    },
    nombreExpediente: projectName,
    fecha: generatedAt,
    personaPerfiladora: user?.name || user?.email || payload.personaPerfiladora,
    clasificacion: payload.classification || payload.clasificacion,
  });
  institutionalReportInput = { ...institutionalReportInput,
    multisourceAnalysis: executiveModel.multisourceAnalysis.technicalMetadata.governedAnalysis };
  const citedVisualIds = collectDocumentCitedVisualIds(executiveModel, institutionalReportInput);
  const provisionalVisualComposition = buildExecutiveVisualComposition(executiveModel, institutionalReportInput, { canonicalPrincipalOnly: true, citedVisualIds });
  const principalTerritorialMapSpec = provisionalVisualComposition.principalTerritorialMap.status === "MAP_RENDER_REQUIRED"
    && institutionalReportInput.geography
    ? buildExecutiveCanonicalTerritorialMapSpec(institutionalReportInput.geography, {
        denue: governedDenueRenderingInput || undefined,
      })
    : null;
  const visualComposition = principalTerritorialMapSpec
    ? buildExecutiveVisualComposition(executiveModel, institutionalReportInput, { principalMapSpec: principalTerritorialMapSpec, canonicalPrincipalOnly: true, citedVisualIds })
    : provisionalVisualComposition;
  const documentModel = buildExecutiveGeointReportDocumentModel(
    executiveModel,
    visualComposition,
    institutionalReportInput,
    {
      numeroExpediente,
      ceipolId: payload.ceipolId,
      enforceSemanticIntegrity: true,
    }
  );
  return { institutionalReportInput, generatedAt, numeroExpediente, projectId, executiveModel, visualComposition, principalTerritorialMapSpec, documentModel, denueAnalyticalPublication };
}
