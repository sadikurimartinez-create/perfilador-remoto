import { compactReportAnalysisOutputs } from "@/utils/aiAnalysisGovernance";

export type ProjectRootHeavyField =
  | "approvedFindings"
  | "streetViewAnalysis"
  | "analysisOutputs"
  | "iaAnalysis"
  | "aiAnalyticalOutputs"
  | "analyses"
  | "sweeps"
  | "photos"
  | "album"
  | "evidence"
  | "evidences"
  | "tacticalStreetViews"
  | "temporalComparisons";

export interface ProjectRootFieldInventory {
  field: string;
  bytes: number;
  count: number | null;
  rootLocation: string;
  producer: string;
  consumer: string;
  duplicate: boolean;
  sizeRisk: "LOW" | "MEDIUM" | "HIGH";
  canonicalCopyExists: boolean;
  canonicalDestination: string | null;
  canRemoveFromRoot: boolean;
  compatibilityRequirement: string;
}

export interface CompactFindingRef {
  findingId: string;
  sourceEvidenceId: string | null;
  traceabilityId: string | null;
  geographyId: string | null;
  status: string | null;
  humanValidationStatus: string | null;
  validationStatus: string | null;
  lineageStatus: string | null;
  usedInReport: boolean;
}

export interface ProjectRootReconciliationPlan {
  projectId: string;
  dryRun: boolean;
  totalBytesBefore: number;
  totalBytesAfter: number;
  estimatedBytesSaved: number;
  inventory: ProjectRootFieldInventory[];
  approvedFindingRefs: CompactFindingRef[];
  streetViewFindingRefs: CompactFindingRef[];
  canonicalFindingUpserts: Array<{ path: string; id: string; data: any }>;
  rootPatch: Record<string, unknown>;
  removeRootFields: string[];
  warnings: string[];
}

const HEAVY_FIELDS: ProjectRootHeavyField[] = [
  "approvedFindings",
  "streetViewAnalysis",
  "analysisOutputs",
  "iaAnalysis",
  "aiAnalyticalOutputs",
  "analyses",
  "sweeps",
  "photos",
  "album",
  "evidence",
  "evidences",
  "tacticalStreetViews",
  "temporalComparisons",
];

const FIELD_META: Record<string, Omit<ProjectRootFieldInventory, "field" | "bytes" | "count" | "sizeRisk" | "canonicalCopyExists" | "canRemoveFromRoot">> = {
  approvedFindings: {
    rootLocation: "projects/{projectId}.approvedFindings",
    producer: "GeographicWorkspace / StreetView findings approval",
    consumer: "reportReadyGovernance.collectFindings",
    duplicate: true,
    canonicalDestination: "projects/{projectId}/streetview_findings/{findingId}",
    compatibilityRequirement: "Root must keep compact approvedFindingRefs for Report Ready.",
  },
  streetViewAnalysis: {
    rootLocation: "projects/{projectId}.streetViewAnalysis",
    producer: "Street View / GEOINT sweep UI",
    consumer: "reportReadyGovernance.collectFindings",
    duplicate: true,
    canonicalDestination: "projects/{projectId}/streetview_findings/{findingId}",
    compatibilityRequirement: "Root must keep compact streetViewFindingRefs for Report Ready.",
  },
  analysisOutputs: {
    rootLocation: "projects/{projectId}.analysisOutputs",
    producer: "PhotoAlbum institutional analysis",
    consumer: "reportReadyGovernance.collectAnalysis",
    duplicate: false,
    canonicalDestination: "projects/{projectId}.analysisOutputs compact",
    compatibilityRequirement: "Persist compact outputs only; do not duplicate in iaAnalysis.",
  },
  iaAnalysis: {
    rootLocation: "projects/{projectId}.iaAnalysis",
    producer: "Legacy generate-profile analysis state",
    consumer: "ProjectContext.loadProject legacy hydration",
    duplicate: true,
    canonicalDestination: "projects/{projectId}.analysisOutputs compact",
    compatibilityRequirement: "Legacy read is supported, new writes avoid iaAnalysis.",
  },
  aiAnalyticalOutputs: {
    rootLocation: "projects/{projectId}.aiAnalyticalOutputs",
    producer: "Legacy AI governance outputs",
    consumer: "reportReadyGovernance.collectAnalysis",
    duplicate: true,
    canonicalDestination: "projects/{projectId}.analysisOutputs compact",
    compatibilityRequirement: "Can be read as legacy but root canonical output is analysisOutputs.",
  },
  analyses: {
    rootLocation: "projects/{projectId}.analyses",
    producer: "Legacy analyses collection mirror",
    consumer: "reportReadyGovernance.collectAnalysis",
    duplicate: true,
    canonicalDestination: "analyses/{analysisId}",
    compatibilityRequirement: "Legacy read only unless verified externally.",
  },
  sweeps: {
    rootLocation: "projects/{projectId}.sweeps",
    producer: "ProjectContext.registerSweep/updateSweep",
    consumer: "Report Ready sweep lifecycle gate",
    duplicate: false,
    canonicalDestination: null,
    compatibilityRequirement: "Keep root until separate canonical lifecycle storage is introduced.",
  },
  photos: {
    rootLocation: "projects/{projectId}.photos",
    producer: "Legacy photo persistence",
    consumer: "Legacy project readers",
    duplicate: true,
    canonicalDestination: "projects/{projectId}/photos/{photoId}",
    compatibilityRequirement: "Do not remove without verifying subcollection count.",
  },
  album: {
    rootLocation: "projects/{projectId}.album",
    producer: "Legacy album persistence",
    consumer: "Legacy project readers",
    duplicate: true,
    canonicalDestination: "projects/{projectId}/photos/{photoId}",
    compatibilityRequirement: "Do not remove without verifying subcollection count.",
  },
  evidence: {
    rootLocation: "projects/{projectId}.evidence",
    producer: "Evidence governance",
    consumer: "reportReadyGovernance.collectEvidence",
    duplicate: false,
    canonicalDestination: "projects/{projectId}/photos or documents",
    compatibilityRequirement: "Keep unless a verified canonical evidence copy exists.",
  },
  evidences: {
    rootLocation: "projects/{projectId}.evidences",
    producer: "Legacy evidence governance",
    consumer: "reportReadyGovernance.collectEvidence",
    duplicate: false,
    canonicalDestination: "projects/{projectId}/photos or documents",
    compatibilityRequirement: "Keep unless a verified canonical evidence copy exists.",
  },
  tacticalStreetViews: {
    rootLocation: "projects/{projectId}.tacticalStreetViews",
    producer: "Legacy generate-profile metadata",
    consumer: "Legacy report UI",
    duplicate: true,
    canonicalDestination: "projects/{projectId}/streetview_findings/{findingId}",
    compatibilityRequirement: "Do not remove unless represented by findings/evidence refs.",
  },
  temporalComparisons: {
    rootLocation: "projects/{projectId}.temporalComparisons",
    producer: "GEOINT temporal comparison service",
    consumer: "GEOINT comparison UI/report",
    duplicate: true,
    canonicalDestination: "projects/{projectId}/temporal_comparisons/{comparisonId}",
    compatibilityRequirement: "Do not remove without verifying subcollection count.",
  },
};

function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function present(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sizeRisk(bytes: number): "LOW" | "MEDIUM" | "HIGH" {
  if (bytes >= 100 * 1024) return "HIGH";
  if (bytes >= 25 * 1024) return "MEDIUM";
  return "LOW";
}

function findingIdentity(item: any): string | null {
  return present(item?.findingId) || present(item?.id) || present(item?.traceabilityId);
}

export function compactFindingRef(item: any): CompactFindingRef | null {
  const findingId = findingIdentity(item);
  if (!findingId) return null;
  return {
    findingId,
    sourceEvidenceId: present(item?.sourceEvidenceId) || present(item?.evidenceId),
    traceabilityId: present(item?.traceabilityId),
    geographyId: present(item?.geographyId),
    status: present(item?.status) || present(item?.estado),
    humanValidationStatus: present(item?.humanValidationStatus),
    validationStatus: present(item?.validationStatus),
    lineageStatus: present(item?.lineageStatus),
    usedInReport: item?.usedInReport !== false,
  };
}

function refsFrom(items: any[]): CompactFindingRef[] {
  const byId = new Map<string, CompactFindingRef>();
  for (const item of items) {
    const ref = compactFindingRef(item);
    if (ref) byId.set(ref.findingId, ref);
  }
  return [...byId.values()];
}

function allHaveIdentity(items: any[]): boolean {
  return items.length > 0 && items.every((item) => Boolean(findingIdentity(item)));
}

function compactAnalysisOutputsFromRoot(project: any): any[] {
  return compactReportAnalysisOutputs(asArray(project.analysisOutputs));
}

export function inventoryProjectRoot(project: any): ProjectRootFieldInventory[] {
  return HEAVY_FIELDS
    .filter((field) => Object.prototype.hasOwnProperty.call(project || {}, field))
    .map((field) => {
      const value = project?.[field];
      const bytes = byteSize(value);
      const items = asArray(value);
      const meta = FIELD_META[field];
      const canonicalCopyExists =
        field === "approvedFindings" || field === "streetViewAnalysis"
          ? allHaveIdentity(items)
          : Boolean(meta.canonicalDestination && meta.duplicate);
      const canRemoveFromRoot =
        (field === "approvedFindings" || field === "streetViewAnalysis") && canonicalCopyExists;
      return {
        field,
        bytes,
        count: Array.isArray(value) ? value.length : null,
        sizeRisk: sizeRisk(bytes),
        canonicalCopyExists,
        canRemoveFromRoot,
        ...meta,
      };
    })
    .sort((a, b) => b.bytes - a.bytes);
}

export function planProjectRootReconciliation(input: {
  projectId: string;
  project: any;
  dryRun?: boolean;
}): ProjectRootReconciliationPlan {
  const project = input.project || {};
  const approvedFindings = asArray(project.approvedFindings);
  const streetViewAnalysis = asArray(project.streetViewAnalysis);
  const approvedFindingRefs = refsFrom([
    ...asArray(project.approvedFindingRefs),
    ...approvedFindings,
  ]);
  const streetViewFindingRefs = refsFrom([
    ...asArray(project.streetViewFindingRefs),
    ...streetViewAnalysis,
  ]);
  const canonicalFindingUpserts = [...approvedFindings, ...streetViewAnalysis]
    .filter((item) => findingIdentity(item))
    .map((item) => {
      const id = findingIdentity(item)!;
      return {
        path: `projects/${input.projectId}/streetview_findings/${id}`,
        id,
        data: item,
      };
    });
  const rootPatch: Record<string, unknown> = {};
  const removeRootFields: string[] = [];

  if (approvedFindingRefs.length > 0) rootPatch.approvedFindingRefs = approvedFindingRefs;
  if (streetViewFindingRefs.length > 0) rootPatch.streetViewFindingRefs = streetViewFindingRefs;
  if (Array.isArray(project.analysisOutputs)) rootPatch.analysisOutputs = compactAnalysisOutputsFromRoot(project);
  if (allHaveIdentity(approvedFindings)) removeRootFields.push("approvedFindings");
  if (allHaveIdentity(streetViewAnalysis)) removeRootFields.push("streetViewAnalysis");
  if (Array.isArray(project.iaAnalysis?.analysisOutputs) && Array.isArray(project.analysisOutputs)) {
    removeRootFields.push("iaAnalysis");
  }

  const simulated = { ...project, ...rootPatch };
  for (const field of removeRootFields) {
    delete simulated[field];
  }

  return {
    projectId: input.projectId,
    dryRun: input.dryRun !== false,
    totalBytesBefore: byteSize(project),
    totalBytesAfter: byteSize(simulated),
    estimatedBytesSaved: byteSize(project) - byteSize(simulated),
    inventory: inventoryProjectRoot(project),
    approvedFindingRefs,
    streetViewFindingRefs,
    canonicalFindingUpserts,
    rootPatch,
    removeRootFields,
    warnings: [
      ...(allHaveIdentity(approvedFindings) || approvedFindings.length === 0 ? [] : ["approvedFindings contains items without persistent identity; root removal blocked."]),
      ...(allHaveIdentity(streetViewAnalysis) || streetViewAnalysis.length === 0 ? [] : ["streetViewAnalysis contains items without persistent identity; root removal blocked."]),
    ],
  };
}
