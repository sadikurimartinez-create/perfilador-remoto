"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { useProject, type AlbumPhoto, type Project } from "@/context/ProjectContext";
import { CEIPOLBadge } from "@/components/ui/CEIPOLBadge";
import { CEIPOLButton } from "@/components/ui/CEIPOLButton";
import { CEIPOLCard } from "@/components/ui/CEIPOLCard";
import { CEIPOLEmptyState } from "@/components/ui/CEIPOLEmptyState";
import { CEIPOLErrorState } from "@/components/ui/CEIPOLErrorState";
import {
  type DenueAnalyticalCandidateGenerationInput,
  type DenueAnalyticalCandidateGenerationResult,
  type DenueAnalyticalErgLinkInput,
} from "@/services/denueAnalyticalCandidateService";
import type { StreetViewFinding } from "@/services/streetViewFindingService";
import { GeointGovernanceStatus } from "@/types/geointGovernance";
import type { GeoEvidence } from "@/types/geointEvidence";
import type { DenueAnalyticalRelation } from "@/utils/denueAnalyticalRelation";
import {
  type DenueAnalyticalReviewDecision,
  type DenueAnalyticalReviewLedger,
} from "@/utils/denueAnalyticalReviewLedger";
import type { ExecutiveFinding } from "@/utils/executiveGeointReportModel";
import {
  authenticatedPpcIdentity,
  persistDenueAnalyticalReviewDecision,
  runExplicitDenueCandidateGeneration,
} from "@/components/denueAnalyticalReviewController";

const METHODOLOGY_VERSION = "ADR-026:R3.2B.6H.2B:v1";
const MAX_CANDIDATE_DISTANCE_METERS = 100;

type ReviewFilter = "PENDING" | "ACCEPTED" | "REJECTED" | "REQUIRES_REVISION" | "ALL";

export interface DenueAnalyticalSourceCoverage {
  denue: number;
  geoEvidence: number;
  streetView: number;
  findings: number;
  multisourceGroups: number;
  ergLinks: number;
}

export interface DenueAnalyticalGovernedSnapshot {
  input: DenueAnalyticalCandidateGenerationInput | null;
  coverage: DenueAnalyticalSourceCoverage;
  warnings: string[];
}

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function albumEvidence(project: Project, photo: AlbumPhoto): GeoEvidence | null {
  const sourceEvidenceId = photo.sourceEvidenceId || photo.evidenceId;
  const traceabilityId = photo.traceabilityId;
  const geographyId = photo.geographyId || project.canonicalGeography?.geographyId;
  const approved = photo.humanValidationStatus === "APPROVED" ||
    (photo.validado === true && photo.validationSource === "ADR_020_24_HUMAN_ACTION");
  if (
    !approved ||
    !present(sourceEvidenceId) ||
    !present(traceabilityId) ||
    !present(geographyId) ||
    geographyId !== project.canonicalGeography?.geographyId ||
    !finiteCoordinate(photo.lat, -90, 90) ||
    !finiteCoordinate(photo.lng, -180, 180) ||
    !Array.isArray(photo.lineage) ||
    photo.lineage.length === 0
  ) {
    return null;
  }
  return {
    id: photo.evidenceId || photo.id,
    expedienteId: project.id,
    traceabilityId,
    sourceEvidenceId,
    geographyId,
    source: "FIELD_PHOTO",
    coordinates: { lat: photo.lat, lng: photo.lng },
    captureDate: toIsoDate(photo.gpsTimestamp) || toIsoDate(photo.createdAt),
    imageReference: photo.storagePath || photo.previewUrl,
    metadata: { sourceProvider: "CEIPOL_FIELD" },
    status: GeointGovernanceStatus.APPROVED_EVIDENCE,
    lineage: photo.lineage,
    lineageStatus: photo.lineageStatus,
  };
}

function governedStreetViewFinding(value: unknown, project: Project): StreetViewFinding | null {
  const finding = value as Partial<StreetViewFinding>;
  if (
    !present(finding?.id) ||
    finding.expedienteId !== project.id ||
    !present(finding.traceabilityId) ||
    !present(finding.sourceEvidenceId) ||
    finding.geographyId !== project.canonicalGeography?.geographyId ||
    finding.estado !== GeointGovernanceStatus.APPROVED_EVIDENCE ||
    !finiteCoordinate(finding.coordenadas?.lat, -90, 90) ||
    !finiteCoordinate(finding.coordenadas?.lng, -180, 180) ||
    !Array.isArray(finding.lineage) ||
    finding.lineage.length === 0
  ) {
    return null;
  }
  return finding as StreetViewFinding;
}

function governedExecutiveFinding(value: unknown): ExecutiveFinding | null {
  const finding = value as Partial<ExecutiveFinding>;
  if (!present(finding?.findingId) || !Array.isArray(finding.evidenceReferences)) return null;
  return finding as ExecutiveFinding;
}

function ergLinks(album: readonly AlbumPhoto[]): DenueAnalyticalErgLinkInput[] {
  return album.flatMap((photo) => {
    const relationship = photo.evidenceRelationship;
    const sourceEvidenceId = photo.sourceEvidenceId || photo.evidenceId;
    if (!relationship || !present(relationship.id) || !present(sourceEvidenceId)) return [];
    return [{
      sourceEvidenceId,
      link: { relationship, reference: `erg://${relationship.id}` },
    }];
  });
}

export function buildDenueAnalyticalGovernedSnapshot(input: {
  project: Project | null;
  album: readonly AlbumPhoto[];
  streetViewFindings?: readonly unknown[];
}): DenueAnalyticalGovernedSnapshot {
  const project = input.project;
  const emptyCoverage: DenueAnalyticalSourceCoverage = {
    denue: 0,
    geoEvidence: 0,
    streetView: 0,
    findings: 0,
    multisourceGroups: 0,
    ergLinks: 0,
  };
  if (!project?.id || project.canonicalGeography?.validationStatus !== "VALID") {
    return { input: null, coverage: emptyCoverage, warnings: ["GEOGRAFIA_CANONICA_NO_DISPONIBLE"] };
  }

  const denuePois = Array.isArray(project.denuePois) ? project.denuePois : [];
  const geoEvidence = input.album.flatMap((photo) => {
    const evidence = albumEvidence(project, photo);
    return evidence ? [evidence] : [];
  });
  const streetViewFindings = (input.streetViewFindings || []).flatMap((finding) => {
    const governed = governedStreetViewFinding(finding, project);
    return governed ? [governed] : [];
  });
  const findings = (project.findings || []).flatMap((finding) => {
    const governed = governedExecutiveFinding(finding);
    return governed ? [governed] : [];
  });
  const verifiedErgLinks = ergLinks(input.album);
  const coverage = {
    denue: denuePois.length,
    geoEvidence: geoEvidence.length,
    streetView: streetViewFindings.length,
    findings: findings.length,
    multisourceGroups: 0,
    ergLinks: verifiedErgLinks.length,
  };
  return {
    input: {
      projectId: project.id,
      canonicalGeography: project.canonicalGeography,
      denuePois,
      geoEvidence,
      streetViewFindings,
      findings,
      verifiedErgLinks,
      multisourceGroups: [],
      maxCandidateDistanceMeters: MAX_CANDIDATE_DISTANCE_METERS,
      methodologyVersion: METHODOLOGY_VERSION,
    },
    coverage,
    warnings: [],
  };
}

const RELATION_LABELS: Record<string, string> = {
  SPATIAL_PROXIMITY: "Proximidad espacial",
  EXPLICIT_SOURCE_LINK: "Vinculo formal de fuente",
  EVIDENCE_COINCIDENCE: "Coincidencia con evidencia",
  FINDING_RELATION: "Relacion con hallazgo",
  MULTISOURCE_CORROBORATION: "Corroboracion multifuente",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  REQUIRES_REVISION: "Requiere revision",
};

function badgeStatus(status: string): "validated" | "pending" | "warning" | "error" {
  if (status === "ACCEPTED") return "validated";
  if (status === "REJECTED") return "error";
  if (status === "REQUIRES_REVISION") return "warning";
  return "pending";
}

function compactReference(value: string): string {
  return value.length <= 34 ? value : `${value.slice(0, 15)}...${value.slice(-12)}`;
}

export interface DenueAnalyticalReviewPanelViewProps {
  relations: readonly DenueAnalyticalRelation[];
  ledgers: readonly DenueAnalyticalReviewLedger[];
  denueNames: ReadonlyMap<string, string>;
  coverage: DenueAnalyticalSourceCoverage;
  geographyType?: string | null;
  generationResult: DenueAnalyticalCandidateGenerationResult | null;
  generationError: string | null;
  reviewErrors: Readonly<Record<string, string>>;
  rationaleByRelation: Readonly<Record<string, string>>;
  filter: ReviewFilter;
  canReview: boolean;
  generating: boolean;
  reviewingRelationId: string | null;
  onFilterChange: (filter: ReviewFilter) => void;
  onGenerate: () => void;
  onRationaleChange: (relationId: string, value: string) => void;
  onDecision: (relation: DenueAnalyticalRelation, decision: DenueAnalyticalReviewDecision) => void;
}

export function DenueAnalyticalReviewPanelView(props: DenueAnalyticalReviewPanelViewProps) {
  const visibleRelations = [...props.relations]
    .filter((relation) => props.filter === "ALL" || relation.humanValidation.status === props.filter)
    .sort((left, right) =>
      left.humanValidation.status.localeCompare(right.humanValidation.status) ||
      left.relationTypes.join("|").localeCompare(right.relationTypes.join("|")) ||
      left.relationId.localeCompare(right.relationId)
    );

  return (
    <section aria-labelledby="denue-analytical-review-title" className="w-full border-t border-slate-800 pt-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase text-cyan-400">Revision humana PPC</p>
          <h2 id="denue-analytical-review-title" className="text-base font-bold text-slate-100">Relaciones analiticas DENUE</h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-400">
            El sistema detecta relaciones descriptivas. La PPC revisa su significado y registra la decision institucional.
          </p>
        </div>
        <CEIPOLButton loading={props.generating} disabled={!props.canReview} onClick={props.onGenerate}>
          Generar candidatos analiticos
        </CEIPOLButton>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["DENUE", props.coverage.denue],
          ["Evidencia", props.coverage.geoEvidence],
          ["Street View", props.coverage.streetView],
          ["Hallazgos", props.coverage.findings],
          ["Multifuente", props.coverage.multisourceGroups],
          ["ERG", props.coverage.ergLinks],
        ].map(([label, value]) => (
          <div key={String(label)} className="border-l-2 border-slate-700 px-3 py-1">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="font-mono font-bold text-slate-200">{value}</p>
          </div>
        ))}
      </div>

      {props.generationResult && (
        <div className="grid grid-cols-2 gap-3 border-y border-slate-800 py-3 text-xs md:grid-cols-5">
          <span>Universo DENUE: <strong>{props.generationResult.sourceDenueCount}</strong></span>
          <span>Detectados: <strong>{props.generationResult.candidateCount}</strong></span>
          <span>Nuevos: <strong>{props.generationResult.newCandidateCount}</strong></span>
          <span>Existentes: <strong>{props.generationResult.existingCandidateCount}</strong></span>
          <span>No admitidos: <strong>{props.generationResult.invalidCandidateCount}</strong></span>
        </div>
      )}

      {props.generationError && (
        <CEIPOLErrorState title="No fue posible generar candidatos" description={props.generationError} onRetry={props.onGenerate} />
      )}

      {props.relations.length === 0 && !props.generationError ? (
        <CEIPOLEmptyState
          title="No existen relaciones DENUE pendientes de revision"
          description="La generacion requiere una accion humana explicita y fuentes gobernadas disponibles en el expediente."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Filtros de revision DENUE">
            {(["PENDING", "ACCEPTED", "REJECTED", "REQUIRES_REVISION", "ALL"] as ReviewFilter[]).map((filter) => (
              <CEIPOLButton
                key={filter}
                size="sm"
                variant={props.filter === filter ? "primary" : "secondary"}
                onClick={() => props.onFilterChange(filter)}
              >
                {filter === "ALL" ? "Todas" : STATUS_LABELS[filter]}
              </CEIPOLButton>
            ))}
          </div>

          {visibleRelations.length === 0 && (
            <CEIPOLEmptyState title="Sin relaciones en este filtro" description="Seleccione otro estado para consultar el historial disponible." />
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {visibleRelations.map((relation) => {
              const status = relation.humanValidation.status;
              const terminal = status === "ACCEPTED" || status === "REJECTED";
              const ledger = props.ledgers.find((item) => item.relationId === relation.relationId);
              const relatedSources = relation.linkedSourceRefs.filter((ref) => ref !== relation.sourceEvidenceId);
              return (
                <CEIPOLCard key={relation.relationId} variant="default" className="p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-100">
                        {props.denueNames.get(relation.sourceEvidenceId) || "Establecimiento DENUE observado"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {relation.relationTypes.map((type) => RELATION_LABELS[type] || type).join(" / ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <CEIPOLBadge status="processing">Sistema: {relation.machineAssessment.status}</CEIPOLBadge>
                      <CEIPOLBadge status={badgeStatus(status)}>PPC: {STATUS_LABELS[status]}</CEIPOLBadge>
                      <CEIPOLBadge status="pending">Publicacion: {relation.publicationEligibility}</CEIPOLBadge>
                    </div>
                  </div>

                  <div className="grid gap-3 text-xs md:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Fundamento descriptivo</p>
                      <p className="mt-1 text-slate-300">Relacion medida por el sistema y pendiente de interpretacion humana.</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Fuente relacionada</p>
                      <p className="mt-1 font-mono text-slate-300">
                        {relatedSources.length > 0 ? relatedSources.map(compactReference).join(", ") : "Sin fuente adicional admitida"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Metrica disponible</p>
                      <p className="mt-1 text-slate-300">
                        {relation.spatialMetrics?.distanceMeters != null
                          ? `${relation.spatialMetrics.distanceMeters.toFixed(1)} ${relation.spatialMetrics.unit.toLowerCase()}`
                          : "Sin distancia puntual aplicable"}
                      </p>
                      <p className="mt-1 break-words text-[10px] text-slate-500">{relation.spatialMetrics?.method || "Metodo multifuente"}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Geometria: {props.geographyType || "canonica"} · {relation.geographyId}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Trazabilidad</p>
                      <p className="mt-1 text-slate-300">{relation.lineage.length} nodos de lineage</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">{compactReference(relation.relationId)}</p>
                    </div>
                  </div>

                  {relation.relationTypes.includes("SPATIAL_PROXIMITY") && (
                    <p className="border-l-2 border-amber-500 px-3 text-xs text-amber-200">
                      La proximidad espacial es descriptiva y no acredita causalidad, riesgo, participacion criminal ni relevancia por si misma.
                    </p>
                  )}

                  {ledger && ledger.events.length > 0 && (
                    <div className="border-t border-slate-800 pt-3">
                      <p className="text-[10px] uppercase text-slate-500">Historial PPC</p>
                      <div className="mt-2 space-y-2">
                        {ledger.events.map((event) => (
                          <div key={event.eventId} className="text-xs text-slate-300">
                            <strong>{STATUS_LABELS[event.nextStatus]}</strong> · {event.rationale}
                            <span className="block text-[10px] text-slate-500">{event.reviewedBy} · {event.reviewedAt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!terminal && props.canReview && (
                    <div className="border-t border-slate-800 pt-3 space-y-3">
                      <label className="block text-xs font-semibold text-slate-300" htmlFor={`denue-rationale-${relation.relationId}`}>
                        Fundamento de la decision PPC
                      </label>
                      <textarea
                        id={`denue-rationale-${relation.relationId}`}
                        value={props.rationaleByRelation[relation.relationId] || ""}
                        onChange={(event) => props.onRationaleChange(relation.relationId, event.target.value)}
                        rows={3}
                        className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                      />
                      {props.reviewErrors[relation.relationId] && (
                        <p role="alert" className="text-xs text-red-300">{props.reviewErrors[relation.relationId]}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <CEIPOLButton
                          size="sm"
                          variant="confirm"
                          loading={props.reviewingRelationId === relation.relationId}
                          disabled={!present(props.rationaleByRelation[relation.relationId])}
                          onClick={() => props.onDecision(relation, "ACCEPTED")}
                        >
                          Aceptar relacion
                        </CEIPOLButton>
                        <CEIPOLButton
                          size="sm"
                          variant="danger"
                          loading={props.reviewingRelationId === relation.relationId}
                          disabled={!present(props.rationaleByRelation[relation.relationId])}
                          onClick={() => props.onDecision(relation, "REJECTED")}
                        >
                          Rechazar relacion
                        </CEIPOLButton>
                        <CEIPOLButton
                          size="sm"
                          variant="warning"
                          loading={props.reviewingRelationId === relation.relationId}
                          disabled={!present(props.rationaleByRelation[relation.relationId])}
                          onClick={() => props.onDecision(relation, "REQUIRES_REVISION")}
                        >
                          Solicitar revision
                        </CEIPOLButton>
                      </div>
                    </div>
                  )}
                </CEIPOLCard>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

export function DenueAnalyticalReviewPanel({ streetViewFindings = [] }: { streetViewFindings?: readonly unknown[] }) {
  const { project, album, isReadOnly, reloadDenueAnalyticalWorkflow } = useProject();
  const { user } = useAuth();
  const [filter, setFilter] = React.useState<ReviewFilter>("PENDING");
  const [generationResult, setGenerationResult] = React.useState<DenueAnalyticalCandidateGenerationResult | null>(null);
  const [generationError, setGenerationError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [reviewingRelationId, setReviewingRelationId] = React.useState<string | null>(null);
  const [rationaleByRelation, setRationaleByRelation] = React.useState<Record<string, string>>({});
  const [reviewErrors, setReviewErrors] = React.useState<Record<string, string>>({});

  const snapshot = React.useMemo(
    () => buildDenueAnalyticalGovernedSnapshot({ project, album, streetViewFindings }),
    [project, album, streetViewFindings]
  );
  const reviewerIdentity = authenticatedPpcIdentity(user);
  const canReview = Boolean(user && reviewerIdentity && !isReadOnly);
  const relations = project?.denueAnalyticalRelations || [];
  const ledgers = project?.denueAnalyticalReviewLedger || [];
  const denueNames = React.useMemo(
    () => new Map((project?.denuePois || []).map((poi) => [poi.sourceEvidenceId, poi.name])),
    [project?.denuePois]
  );

  const handleGenerate = React.useCallback(async () => {
    if (!snapshot.input || !canReview) {
      setGenerationError(snapshot.warnings[0] || "No existe un snapshot gobernado disponible.");
      return;
    }
    setGenerating(true);
    setGenerationError(null);
    try {
      const result = await runExplicitDenueCandidateGeneration({
        snapshot: snapshot.input,
        reload: reloadDenueAnalyticalWorkflow,
      });
      setGenerationResult(result);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Fallo no especificado al generar candidatos.");
    } finally {
      setGenerating(false);
    }
  }, [snapshot, canReview, reloadDenueAnalyticalWorkflow]);

  const handleDecision = React.useCallback(async (
    relation: DenueAnalyticalRelation,
    decision: DenueAnalyticalReviewDecision
  ) => {
    const rationale = rationaleByRelation[relation.relationId] || "";
    if (!present(rationale)) {
      setReviewErrors((current) => ({ ...current, [relation.relationId]: "El fundamento PPC es obligatorio." }));
      return;
    }
    setReviewingRelationId(relation.relationId);
    setReviewErrors((current) => ({ ...current, [relation.relationId]: "" }));
    try {
      await persistDenueAnalyticalReviewDecision({
        projectId: relation.expedienteId,
        relation,
        decision,
        rationale,
        reviewedBy: reviewerIdentity,
        reload: reloadDenueAnalyticalWorkflow,
      });
      setRationaleByRelation((current) => ({ ...current, [relation.relationId]: "" }));
    } catch (error) {
      setReviewErrors((current) => ({
        ...current,
        [relation.relationId]: error instanceof Error ? error.message : "No fue posible persistir la decision PPC.",
      }));
    } finally {
      setReviewingRelationId(null);
    }
  }, [rationaleByRelation, reviewerIdentity, reloadDenueAnalyticalWorkflow]);

  return (
    <DenueAnalyticalReviewPanelView
      relations={relations}
      ledgers={ledgers}
      denueNames={denueNames}
      coverage={snapshot.coverage}
      geographyType={project?.canonicalGeography?.type || null}
      generationResult={generationResult}
      generationError={generationError}
      reviewErrors={reviewErrors}
      rationaleByRelation={rationaleByRelation}
      filter={filter}
      canReview={canReview}
      generating={generating}
      reviewingRelationId={reviewingRelationId}
      onFilterChange={setFilter}
      onGenerate={() => void handleGenerate()}
      onRationaleChange={(relationId, value) => setRationaleByRelation((current) => ({ ...current, [relationId]: value }))}
      onDecision={(relation, decision) => void handleDecision(relation, decision)}
    />
  );
}

export default DenueAnalyticalReviewPanel;
