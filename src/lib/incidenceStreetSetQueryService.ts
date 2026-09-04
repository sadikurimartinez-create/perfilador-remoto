import {
  executeStreetIncidenceQuery,
  type ExecuteStreetIncidenceQueryInput,
  type StreetIncidenceQueryResult,
} from "./incidenceStreetQueryService";

import type {
  IncidenceStreetCandidate,
} from "./incidenceStreetCandidateProvider";

import type {
  StreetCorridorWidthMeters,
} from "./incidenceStreetCorridor";

export type StreetSetPhysicalCandidate = Pick<
  IncidenceStreetCandidate,
  | "candidateId"
  | "cveMun"
  | "cveLoc"
  | "cvevial"
  | "nomvial"
  | "geometry"
>;

export type ExecuteStreetSetIncidenceQueryInput = {
  candidates: StreetSetPhysicalCandidate[];
  widthMeters?: StreetCorridorWidthMeters;
  startDate?: string | null;
  endDate?: string | null;
  incidentTypes?: string[];
};

export type StreetSetCorridorMember = {
  candidateId: string;
  nomvial: string;
  cveMun: string;
  cveLoc: string;
  cvevial: string;
  widthMeters: StreetCorridorWidthMeters;
  corridorGeometry: StreetIncidenceQueryResult["corridorGeometry"];
};

export type StreetSetIncidenceQueryResult = {
  widthMeters: StreetCorridorWidthMeters;
  candidates: StreetSetPhysicalCandidate[];
  corridors: StreetSetCorridorMember[];
  records: any[];
  querySource: "POSTGIS";
  sourceStatus: "POSTGIS_AVAILABLE";
};

type Dependencies = {
  executeStreetQuery?: typeof executeStreetIncidenceQuery;
};

function buildFallbackRecordKey(record: any): string {
  return [
    record?.INCIDENTE ?? "",
    record?.FECHA ?? "",
    record?.HORA ?? "",
    record?.NOM_ASEN ?? "",
    record?.lat ?? "",
    record?.lng ?? "",
    record?.fuente ?? "",
  ].join("|");
}

function recordIdentity(record: any): string {
  const sourceFingerprint =
    typeof record?.sourceFingerprint === "string"
      ? record.sourceFingerprint.trim()
      : "";

  if (sourceFingerprint) {
    return `fp:${sourceFingerprint}`;
  }

  return `fallback:${buildFallbackRecordKey(record)}`;
}

function validatePhysicalCandidate(
  candidate: StreetSetPhysicalCandidate
): void {
  if (
    !candidate.candidateId ||
    !candidate.cveMun ||
    !candidate.cveLoc ||
    !candidate.cvevial ||
    !candidate.nomvial ||
    candidate.geometry?.type !== "MultiLineString"
  ) {
    throw new Error(
      "STREET_SET_INVALID_PHYSICAL_CANDIDATE"
    );
  }
}

export async function executeStreetSetIncidenceQuery(
  input: ExecuteStreetSetIncidenceQueryInput,
  dependencies: Dependencies = {}
): Promise<StreetSetIncidenceQueryResult> {
  if (
    !Array.isArray(input.candidates) ||
    input.candidates.length < 2
  ) {
    throw new Error(
      "STREET_SET_REQUIRES_AT_LEAST_TWO_CANDIDATES"
    );
  }

  const uniqueCandidateIds =
    new Set(
      input.candidates.map(
        (candidate) => candidate.candidateId
      )
    );

  if (uniqueCandidateIds.size !== input.candidates.length) {
    throw new Error(
      "STREET_SET_DUPLICATE_CANDIDATE"
    );
  }

  input.candidates.forEach(validatePhysicalCandidate);

  const executeStreetQuery =
    dependencies.executeStreetQuery ??
    executeStreetIncidenceQuery;

  const corridorResults: Array<{
    candidate: StreetSetPhysicalCandidate;
    result: StreetIncidenceQueryResult;
  }> = [];

  for (const candidate of input.candidates) {
    const queryInput: ExecuteStreetIncidenceQueryInput = {
      geometry: candidate.geometry,
      widthMeters: input.widthMeters,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      incidentTypes:
        input.incidentTypes?.length
          ? input.incidentTypes
          : undefined,
    };

    const result =
      await executeStreetQuery(queryInput);

    if (!result.records.success) {
      throw new Error(
        `STREET_SET_MEMBER_QUERY_FAILED:${candidate.candidateId}:${result.records.error ?? "UNKNOWN"}`
      );
    }

    if (result.records.querySource !== "POSTGIS") {
      throw new Error(
        `STREET_SET_MEMBER_NOT_POSTGIS:${candidate.candidateId}`
      );
    }

    corridorResults.push({
      candidate,
      result,
    });
  }

  const deduplicated = new Map<string, any>();

  for (const item of corridorResults) {
    for (const record of item.result.records.data) {
      const key = recordIdentity(record);

      if (!deduplicated.has(key)) {
        deduplicated.set(key, record);
      }
    }
  }

  const firstResult = corridorResults[0].result;

  return {
    widthMeters: firstResult.widthMeters,
    candidates: input.candidates,
    corridors: corridorResults.map(
      ({ candidate, result }) => ({
        candidateId: candidate.candidateId,
        nomvial: candidate.nomvial,
        cveMun: candidate.cveMun,
        cveLoc: candidate.cveLoc,
        cvevial: candidate.cvevial,
        widthMeters: result.widthMeters,
        corridorGeometry: result.corridorGeometry,
      })
    ),
    records: Array.from(deduplicated.values()),
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
  };
}