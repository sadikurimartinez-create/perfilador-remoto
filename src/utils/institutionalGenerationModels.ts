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

export const REPORT_MODELS_BOUNDARY_CODES = [
  'REPORT_MODELS_BASE_PAYLOAD_FAILED',
  'REPORT_MODELS_REPORT_INPUT_FAILED',
  'REPORT_MODELS_SCINCE_CONTEXT_FAILED',
  'REPORT_MODELS_DOCUMENT_IDENTITY_FAILED',
  'REPORT_MODELS_DENUE_CARTOGRAPHIC_PRODUCT_FAILED',
  'REPORT_MODELS_DENUE_DISPLAY_SELECTION_FAILED',
  'REPORT_MODELS_DENUE_ANALYTICAL_PUBLICATION_FAILED',
  'REPORT_MODELS_EXECUTIVE_MODEL_FAILED',
  'REPORT_MODELS_MULTISOURCE_ATTACHMENT_FAILED',
  'REPORT_MODELS_DOCUMENT_CITATIONS_FAILED',
  'REPORT_MODELS_PROVISIONAL_VISUAL_COMPOSITION_FAILED',
  'REPORT_MODELS_CANONICAL_TERRITORIAL_MAP_FAILED',
  'REPORT_MODELS_FINAL_VISUAL_COMPOSITION_FAILED',
  'REPORT_MODELS_DOCUMENT_MODEL_FAILED',
] as const;
export type ReportModelsBoundaryCode = typeof REPORT_MODELS_BOUNDARY_CODES[number];
export class ReportModelsBoundaryError extends Error {
  readonly boundaryCode: ReportModelsBoundaryCode;
  declare readonly cause: unknown;
  constructor(boundaryCode: ReportModelsBoundaryCode, cause: unknown) {
    super(boundaryCode);
    this.boundaryCode = boundaryCode;
    Object.defineProperty(this, 'cause', { value: cause, enumerable: false });
  }
}

/** Existing P2→P5 model construction shared by generation and authoritative revalidation.
 * This function does not acquire image assets or introduce another report engine. */
export function prepareInstitutionalGenerationIntent(projectId:string,format:'DOCX'|'PDF'|'ALL'='DOCX') {
  if(!projectId || !['DOCX','PDF','ALL'].includes(format))throw new Error('REPORT_GENERATION_INTENT_INVALID');
  return {projectId,contract:'SERVER_DOCUMENT_GENERATION_V1' as const,format};
}
export async function buildInstitutionalGenerationModels(payload: any, projectName: string, reportNumber?: string, user?: any, fixedGeneratedAt?: string,
  serverAdmission?: Parameters<typeof integrateScinceDocumentContextForReport>[1]) {
  let boundaryCode: ReportModelsBoundaryCode = 'REPORT_MODELS_BASE_PAYLOAD_FAILED';
  try {
  if(typeof window!=='undefined' && payload.iaAnalysis?.scinceCanonicalSnapshot?.schemaVersion==='SCINCE_COMPACT_SNAPSHOT_V2')
    throw new Error('SCINCE_SERVER_GENERATION_REQUIRED');
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
  boundaryCode = 'REPORT_MODELS_REPORT_INPUT_FAILED';
  let institutionalReportInput = buildInstitutionalReportInput(basePayload, { generatedAt: fixedGeneratedAt });
  boundaryCode = 'REPORT_MODELS_SCINCE_CONTEXT_FAILED';
  institutionalReportInput = await integrateScinceDocumentContextForReport(institutionalReportInput, serverAdmission ?? getScinceDocumentContext);
  boundaryCode = 'REPORT_MODELS_DOCUMENT_IDENTITY_FAILED';
  if(payload.iaAnalysis?.scinceCanonicalSnapshot?.schemaVersion==='SCINCE_COMPACT_SNAPSHOT_V2' && institutionalReportInput.scinceContext?.publicationStatus!=='PUBLISHABLE')
    throw new Error('SCINCE_COMPACT_REPORT_REJECTED');
  const generatedAt = institutionalReportInput.generatedAt;
  const numeroExpediente = payload.numeroExpediente || reportNumber;
  const projectId = payload.projectId || institutionalReportInput.projectId;
  let governedDenueRenderingInput = null;
  let denueLayers: import("./denueGovernedMapAdapter").DenueGovernedMapLayer[] = [];
  let contextualDisplayedCount = 0;
  boundaryCode = 'REPORT_MODELS_DENUE_CARTOGRAPHIC_PRODUCT_FAILED';
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
  boundaryCode = 'REPORT_MODELS_DENUE_DISPLAY_SELECTION_FAILED';
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
  boundaryCode = 'REPORT_MODELS_DENUE_ANALYTICAL_PUBLICATION_FAILED';
  const denueAnalyticalPublication = await integrateDenueAnalyticalPublicationForReport({
    institutionalReportInput,
    denueLayers,
    contextualDisplayedCount,
    createdAtReference: `report-snapshot:${generatedAt}`,
  });
  institutionalReportInput = denueAnalyticalPublication.institutionalReportInput;
  boundaryCode = 'REPORT_MODELS_EXECUTIVE_MODEL_FAILED';
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
  boundaryCode = 'REPORT_MODELS_MULTISOURCE_ATTACHMENT_FAILED';
  institutionalReportInput = { ...institutionalReportInput,
    multisourceAnalysis: executiveModel.multisourceAnalysis.technicalMetadata.governedAnalysis };
  boundaryCode = 'REPORT_MODELS_DOCUMENT_CITATIONS_FAILED';
  const citedVisualIds = collectDocumentCitedVisualIds(executiveModel, institutionalReportInput);
  boundaryCode = 'REPORT_MODELS_PROVISIONAL_VISUAL_COMPOSITION_FAILED';
  const provisionalVisualComposition = buildExecutiveVisualComposition(executiveModel, institutionalReportInput, { canonicalPrincipalOnly: true, citedVisualIds });
  boundaryCode = 'REPORT_MODELS_CANONICAL_TERRITORIAL_MAP_FAILED';
  const principalTerritorialMapSpec = provisionalVisualComposition.principalTerritorialMap.status === "MAP_RENDER_REQUIRED"
    && institutionalReportInput.geography
    ? buildExecutiveCanonicalTerritorialMapSpec(institutionalReportInput.geography, {
        denue: governedDenueRenderingInput || undefined,
      })
    : null;
  boundaryCode = 'REPORT_MODELS_FINAL_VISUAL_COMPOSITION_FAILED';
  const visualComposition = principalTerritorialMapSpec
    ? buildExecutiveVisualComposition(executiveModel, institutionalReportInput, { principalMapSpec: principalTerritorialMapSpec, canonicalPrincipalOnly: true, citedVisualIds })
    : provisionalVisualComposition;
  boundaryCode = 'REPORT_MODELS_DOCUMENT_MODEL_FAILED';
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
  } catch (cause) {
    throw new ReportModelsBoundaryError(boundaryCode, cause);
  }
}
