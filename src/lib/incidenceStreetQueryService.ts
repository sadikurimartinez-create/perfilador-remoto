import {
  queryPostgisCrimeIncidence,
  type CrimeQueryInput,
} from "./crimeIncidenceRepository";

import {
  buildStreetAnalyticalCorridor,
  type StreetCorridorWidthMeters,
} from "./incidenceStreetCorridor";

import type {
  IncidenceStreetMultiLineStringGeometry,
} from "./incidenceStreetCandidateProvider";

export type ExecuteStreetIncidenceQueryInput = {
  geometry: IncidenceStreetMultiLineStringGeometry;
  widthMeters?: StreetCorridorWidthMeters;
  startDate?: string | null;
  endDate?: string | null;
  incidentTypes?: string[];
  requestedCoverage?: CrimeQueryInput["requestedCoverage"];
};

export type StreetIncidenceQueryResult = {
  widthMeters: StreetCorridorWidthMeters;
  corridorGeometry: {
    type: "Polygon";
    coordinates: Array<Array<[number, number]>>;
  };
  records: Awaited<ReturnType<typeof queryPostgisCrimeIncidence>>;
};

type Dependencies = {
  buildCorridor?: typeof buildStreetAnalyticalCorridor;
  queryCrime?: typeof queryPostgisCrimeIncidence;
};

function getStreetReferencePoint(
  geometry: IncidenceStreetMultiLineStringGeometry
): {
  lat: number;
  lng: number;
} {
  for (const line of geometry.coordinates) {
    for (const position of line) {
      const lng = Number(position?.[0]);
      const lat = Number(position?.[1]);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        return {
          lat,
          lng,
        };
      }
    }
  }

  throw new Error("STREET_QUERY_REFERENCE_POINT_NOT_FOUND");
}

export async function executeStreetIncidenceQuery(
  input: ExecuteStreetIncidenceQueryInput,
  dependencies: Dependencies = {}
): Promise<StreetIncidenceQueryResult> {
  const buildCorridor =
    dependencies.buildCorridor ?? buildStreetAnalyticalCorridor;

  const queryCrime =
    dependencies.queryCrime ?? queryPostgisCrimeIncidence;

  const referencePoint =
    getStreetReferencePoint(input.geometry);

  const corridor = await buildCorridor({
    geometry: input.geometry,
    widthMeters: input.widthMeters,
  });

  const queryInput: CrimeQueryInput = {
    lat: referencePoint.lat,
    lng: referencePoint.lng,
    spatialFilter: {
      type: "POLYGON",
      coordinates: corridor.corridorGeometry.coordinates[0],
    },
    allowLegacyFallback: false,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    incidentTypes:
      input.incidentTypes?.length
        ? input.incidentTypes
        : undefined,
    requestedCoverage:
      input.requestedCoverage ?? undefined,
  };

  const records = await queryCrime(queryInput);

  return {
    widthMeters: corridor.widthMeters,
    corridorGeometry: corridor.corridorGeometry,
    records,
  };
}