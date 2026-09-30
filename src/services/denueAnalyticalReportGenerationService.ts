import {
  buildDenueAnalyticalPublicationProduct,
  type DenueAnalyticalPublicationServiceResult,
} from "@/services/denueAnalyticalPublicationService";
import type { DenueGovernedMapLayer } from "@/utils/denueGovernedMapAdapter";
import {
  DENUE_ANALYTICAL_DOCUMENT_KIND,
  integrateDenueAnalyticalDocument,
  type DenueAnalyticalDocumentIntegrationResult,
} from "@/utils/denueAnalyticalDocumentIntegration";
import type { InstitutionalReportInput } from "@/utils/institutionalReportPublicationContract";

export interface DenueAnalyticalReportGenerationRequest {
  institutionalReportInput: InstitutionalReportInput;
  denueLayers: DenueGovernedMapLayer[];
  contextualDisplayedCount: number;
  createdAtReference: string;
}

export interface DenueAnalyticalReportGenerationDependencies {
  buildPublicationProduct: typeof buildDenueAnalyticalPublicationProduct;
}

export interface DenueAnalyticalReportGenerationResult {
  status: "READY" | "EMPTY" | "FAIL_CLOSED";
  institutionalReportInput: InstitutionalReportInput;
  publicationResult: DenueAnalyticalPublicationServiceResult | null;
  documentIntegration: Exclude<DenueAnalyticalDocumentIntegrationResult, { status: "REJECTED" }>;
  warnings: string[];
}

const DEFAULT_DEPENDENCIES: DenueAnalyticalReportGenerationDependencies = {
  buildPublicationProduct: buildDenueAnalyticalPublicationProduct,
};

function withoutAnalyticalVisuals(visualProducts: readonly any[]): any[] {
  return visualProducts.filter((visual) =>
    visual?.documentIntegrationKind !== DENUE_ANALYTICAL_DOCUMENT_KIND &&
    visual?.technicalMetadata?.documentIntegrationKind !== DENUE_ANALYTICAL_DOCUMENT_KIND
  );
}

function withDocumentIntegration(
  input: InstitutionalReportInput,
  integration: Exclude<DenueAnalyticalDocumentIntegrationResult, { status: "REJECTED" }>
): InstitutionalReportInput {
  const visualProducts = withoutAnalyticalVisuals(input.visualProducts || []);
  if (integration.status === "READY") visualProducts.push(integration.unit.visualProduct);
  return {
    ...input,
    denueAnalyticalDocument: integration,
    visualProducts,
  };
}

function failClosed(
  input: InstitutionalReportInput,
  warnings: string[],
  publicationResult: DenueAnalyticalPublicationServiceResult | null = null
): DenueAnalyticalReportGenerationResult {
  const empty = integrateDenueAnalyticalDocument(null);
  if (empty.status !== "EMPTY") throw new Error("DENUE_ANALYTICAL_EMPTY_INTEGRATION_REQUIRED");
  return {
    status: "FAIL_CLOSED",
    institutionalReportInput: withDocumentIntegration(input, empty),
    publicationResult,
    documentIntegration: empty,
    warnings: Array.from(new Set(warnings)).sort(),
  };
}

export async function integrateDenueAnalyticalPublicationForReport(
  request: DenueAnalyticalReportGenerationRequest,
  dependencies: DenueAnalyticalReportGenerationDependencies = DEFAULT_DEPENDENCIES
): Promise<DenueAnalyticalReportGenerationResult> {
  const input = request.institutionalReportInput;
  const geography = input.geography;
  if (!geography) return failClosed(input, ["DENUE_ANALYTICAL_CANONICAL_GEOGRAPHY_REQUIRED"]);

  try {
    const publicationResult = await dependencies.buildPublicationProduct(input.projectId, {
      geographyId: geography.geographyId,
      canonicalGeography: geography,
      canonicalGeographyReference: {
        geographyId: geography.geographyId,
        geographyType: geography.type,
        geometryType: geography.geometry.type,
        sourceReference: `canonical-geography:${geography.source}:${geography.geographyId}`,
      },
      contextualUniverseCount: input.denuePois?.length || 0,
      contextualDisplayedCount: request.contextualDisplayedCount,
      denueLayers: request.denueLayers,
      createdAtReference: request.createdAtReference,
    });
    if (publicationResult.productStatus === "REJECTED") {
      return failClosed(input, publicationResult.warnings, publicationResult);
    }

    const integration = integrateDenueAnalyticalDocument(publicationResult.product);
    if (integration.status === "REJECTED") {
      return failClosed(input, [
        ...publicationResult.warnings,
        ...integration.reasons.map((reason) => `DOCUMENT_INTEGRATION_REJECTED:${reason}`),
      ], publicationResult);
    }
    return {
      status: integration.status,
      institutionalReportInput: withDocumentIntegration(input, integration),
      publicationResult,
      documentIntegration: integration,
      warnings: [...publicationResult.warnings],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failClosed(input, [`DENUE_ANALYTICAL_PUBLICATION_UNAVAILABLE:${message}`]);
  }
}
