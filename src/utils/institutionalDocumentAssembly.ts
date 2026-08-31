import type { PublicationDisclosure, PublicationExclusion, InstitutionalReportInput } from "@/utils/institutionalReportPublicationContract";
import {
  buildNarrativeAssertionsFromInstitutionalInput,
  renderGovernedExecutiveSummary,
  renderNarrativeAssertions,
  type GovernedNarrativeRender,
} from "@/utils/analyticalNarrativeGovernance";
import type { InstitutionalVisualProduct } from "@/utils/institutionalVisualProductGovernance";

export type InstitutionalDocumentStatus =
  | "DOCUMENT_MODEL_READY"
  | "RENDERED"
  | "RENDERED_WITH_WARNINGS"
  | "RENDER_FAILED";

export type InstitutionalDocumentBlockType = "PARAGRAPH" | "TABLE" | "FIGURE" | "CAPTION" | "DISCLOSURE";

export interface InstitutionalDocumentBlock {
  blockId: string;
  type: InstitutionalDocumentBlockType;
  text?: string;
  assertionId?: string | null;
  visualId?: string | null;
  evidenceIds: string[];
  findingIds: string[];
  analysisIds: string[];
  geographyId?: string | null;
}

export interface InstitutionalDocumentSection {
  sectionId: string;
  title: string;
  order: number;
  blocks: InstitutionalDocumentBlock[];
}

export interface InstitutionalDocumentFigure {
  figureId: string;
  number: number;
  visualId: string;
  visualType: InstitutionalVisualProduct["visualType"];
  title: string;
  caption: string;
  assetRef?: string | null;
  geographyId?: string | null;
  geometryType?: string | null;
  evidenceIds: string[];
  findingIds: string[];
  analysisIds: string[];
  assertionIds: string[];
  disclosureCodes: string[];
  renderingIssue?: string | null;
}

export interface InstitutionalDocumentModel {
  modelId: string;
  status: InstitutionalDocumentStatus;
  generated: true;
  certified: false;
  published: false;
  sourceSnapshotId: string;
  metadata: {
    projectId: string;
    projectName?: string | null;
    reportNumber?: string | null;
    institutionName: string;
    generatedAt: string;
    author?: null;
    validator?: null;
  };
  sections: InstitutionalDocumentSection[];
  figures: InstitutionalDocumentFigure[];
  disclosures: PublicationDisclosure[];
  exclusions: PublicationExclusion[];
  renderingIssues: string[];
  claimIds: string[];
  lineageRefs: InstitutionalReportInput["lineageSummary"];
}

function paragraph(
  blockId: string,
  rendered: GovernedNarrativeRender,
  refs: { evidenceIds?: string[]; findingIds?: string[]; analysisIds?: string[]; geographyId?: string | null } = {}
): InstitutionalDocumentBlock {
  return {
    blockId,
    type: "PARAGRAPH",
    text: rendered.text,
    assertionId: rendered.assertionId,
    evidenceIds: refs.evidenceIds || [],
    findingIds: refs.findingIds || [],
    analysisIds: refs.analysisIds || [],
    geographyId: refs.geographyId ?? null,
  };
}

function disclosureBlock(disclosure: PublicationDisclosure, index: number): InstitutionalDocumentBlock {
  return {
    blockId: `DISCLOSURE-${index + 1}-${disclosure.itemId}`,
    type: "DISCLOSURE",
    text: disclosure.message,
    evidenceIds: [],
    findingIds: [],
    analysisIds: [],
    geographyId: null,
  };
}

function makeSection(sectionId: string, title: string, order: number, blocks: InstitutionalDocumentBlock[]): InstitutionalDocumentSection {
  return { sectionId, title, order, blocks };
}

function figuresFromVisualProducts(visualProducts: InstitutionalVisualProduct[]): { figures: InstitutionalDocumentFigure[]; renderingIssues: string[] } {
  const renderingIssues: string[] = [];
  const figures = visualProducts
    .filter((visual) => visual.publicationEligibility !== "INELIGIBLE" && visual.decorative !== true)
    .map((visual, index) => {
      const missingAsset = !visual.assetRef && visual.visualType !== "MAP";
      const renderingIssue = missingAsset ? `VISUAL_ASSET_UNRESOLVED:${visual.visualId}` : null;
      if (renderingIssue) renderingIssues.push(renderingIssue);
      return {
        figureId: `FIG-${String(index + 1).padStart(3, "0")}`,
        number: index + 1,
        visualId: visual.visualId,
        visualType: visual.visualType,
        title: visual.title,
        caption: visual.caption,
        assetRef: visual.assetRef,
        geographyId: visual.geographyId,
        geometryType: visual.geometryType,
        evidenceIds: visual.evidenceIds,
        findingIds: visual.findingIds,
        analysisIds: visual.analysisIds,
        assertionIds: visual.assertionIds,
        disclosureCodes: visual.disclosureCodes,
        renderingIssue,
      };
    });
  return { figures, renderingIssues };
}

export function buildInstitutionalDocumentModel(input: InstitutionalReportInput, metadata: {
  projectName?: string | null;
  reportNumber?: string | null;
  institutionName?: string | null;
} = {}): InstitutionalDocumentModel {
  const assertions = buildNarrativeAssertionsFromInstitutionalInput(input);
  const renderedAssertions = renderNarrativeAssertions(assertions, "INSTITUTIONAL");
  const executive = renderGovernedExecutiveSummary(assertions, "INSTITUTIONAL");
  const { figures, renderingIssues } = figuresFromVisualProducts(input.visualProducts as InstitutionalVisualProduct[]);

  const byType = (types: string[]) => renderedAssertions.filter((item) => types.includes(item.sourceItemType));
  const sourceAssertion = (rendered: GovernedNarrativeRender) => assertions.find((item) => item.assertionId === rendered.assertionId);
  const blocksFor = (types: string[]) => byType(types).map((rendered, index) => {
    const source = sourceAssertion(rendered);
    return paragraph(`${types.join("-")}-${index + 1}`, rendered, {
      evidenceIds: source?.evidenceIds,
      findingIds: source?.findingIds,
      analysisIds: source?.analysisIds,
      geographyId: source?.geographyId,
    });
  });

  const figureBlocks = figures.map((figure) => ({
    blockId: figure.figureId,
    type: "FIGURE" as const,
    text: figure.caption,
    visualId: figure.visualId,
    evidenceIds: figure.evidenceIds,
    findingIds: figure.findingIds,
    analysisIds: figure.analysisIds,
    geographyId: figure.geographyId,
  }));

  const sections = [
    makeSection("executive-summary", "Resumen ejecutivo", 0, executive.renderedAssertions.map((rendered, index) => paragraph(`EXEC-${index + 1}`, rendered))),
    makeSection("hypothesis", "Hipótesis", 1, blocksFor(["HYPOTHESIS"])),
    makeSection("evidence", "Evidencia", 2, blocksFor(["EVIDENCE", "STREET_VIEW", "TEMPORAL_COMPARISON"])),
    makeSection("findings", "Hallazgos", 3, blocksFor(["FINDING"])),
    makeSection("analysis", "Análisis", 4, blocksFor(["INFERENCE", "ANALYSIS", "SPECIALIZED_INTELLIGENCE", "OSINT"])),
    makeSection("conclusions", "Conclusiones", 5, blocksFor(["CONCLUSION", "RECOMMENDATION"])),
    makeSection("visual-products", "Productos visuales", 6, figureBlocks),
    makeSection("disclosures", "Notas metodológicas", 7, input.disclosures.map(disclosureBlock)),
  ];

  const modelId = `DOCMODEL-${input.projectId}-${input.generatedAt}`;
  return {
    modelId,
    status: renderingIssues.length > 0 ? "RENDERED_WITH_WARNINGS" : "DOCUMENT_MODEL_READY",
    generated: true,
    certified: false,
    published: false,
    sourceSnapshotId: input.generatedAt,
    metadata: {
      projectId: input.projectId,
      projectName: metadata.projectName ?? null,
      reportNumber: metadata.reportNumber ?? null,
      institutionName: metadata.institutionName || "SSPE / CEIPOL",
      generatedAt: input.generatedAt,
      author: null,
      validator: null,
    },
    sections,
    figures,
    disclosures: input.disclosures,
    exclusions: input.exclusions,
    renderingIssues,
    claimIds: executive.claimIds,
    lineageRefs: input.lineageSummary,
  };
}

function sectionText(model: InstitutionalDocumentModel, sectionId: string): string {
  const section = model.sections.find((item) => item.sectionId === sectionId);
  return section?.blocks.map((block) => block.text).filter(Boolean).join("\n") || "";
}

function adaptFigure(figure: InstitutionalDocumentFigure) {
  return {
    id: figure.visualId,
    visualId: figure.visualId,
    title: figure.title,
    caption: figure.caption,
    dataUrl: figure.assetRef || "",
    imageUrl: figure.assetRef || "",
    previewUrl: figure.assetRef || "",
    spatialFinding: figure.caption,
    interpretation: figure.caption,
    recommendation: "",
    source: figure.disclosureCodes.join(", ") || "InstitutionalReportInput",
    evidenceIds: figure.evidenceIds,
    findingIds: figure.findingIds,
    analysisIds: figure.analysisIds,
    assertionIds: figure.assertionIds,
    geographyId: figure.geographyId,
    geometryType: figure.geometryType,
  };
}

export function applyInstitutionalDocumentModelToPayload(payload: any, model: InstitutionalDocumentModel) {
  const figuresWithoutIssues = model.figures.filter((figure) => !figure.renderingIssue);
  return {
    ...payload,
    institutionalDocumentModel: model,
    documentGenerationStatus: model.status,
    certified: false,
    published: false,
    executiveSummary: sectionText(model, "executive-summary"),
    executiveSummaryReport: {
      ...(payload?.executiveSummaryReport || {}),
      situation: sectionText(model, "executive-summary"),
      traces: model.claimIds.map((claimId) => ({
        summaryBlockId: claimId,
        sourceChapter: "InstitutionalDocumentModel",
        sourceEvidenceIds: [claimId],
        confidence: 0,
      })),
      isValid: model.claimIds.length > 0,
    },
    finalHypothesis: sectionText(model, "hypothesis"),
    evidenceText: sectionText(model, "evidence"),
    mapsText: figuresWithoutIssues.filter((figure) => figure.visualType === "MAP").map((figure) => figure.caption).join("\n"),
    statsText: figuresWithoutIssues.filter((figure) => figure.visualType === "CHART").map((figure) => figure.caption).join("\n"),
    streetViewText: sectionText(model, "evidence"),
    osintSynthesized: sectionText(model, "analysis"),
    pandillasAnalysis: sectionText(model, "analysis"),
    conclusionesText: sectionText(model, "conclusions"),
    photoEvidence: figuresWithoutIssues.filter((figure) => figure.visualType === "PHOTO").map(adaptFigure),
    streetViewAnalysis: figuresWithoutIssues.filter((figure) => figure.visualType === "STREET_VIEW").map((figure) => ({
      ...adaptFigure(figure),
      tipo: "STREET_VIEW",
      source: "STREET_VIEW",
      observed: figure.caption,
    })),
    temporalComparisons: figuresWithoutIssues.filter((figure) => figure.visualType === "TEMPORAL_COMPARISON").map(adaptFigure),
    maps: figuresWithoutIssues.filter((figure) => figure.visualType === "MAP").map(adaptFigure),
    charts: figuresWithoutIssues.filter((figure) => figure.visualType === "CHART").map(adaptFigure),
    graphs: figuresWithoutIssues.filter((figure) => figure.visualType === "CHART").map((figure) => ({
      ...adaptFigure(figure),
      finding: figure.caption,
      relation: "Visual estadístico gobernado por InstitutionalReportInput.",
    })),
    publicationDisclosures: model.disclosures,
    publicationExclusions: model.exclusions,
    renderingIssues: model.renderingIssues,
  };
}
