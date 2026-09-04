import type {
  CrimeIncidenceComparisonTerritory,
  CrimeIncidenceResolvedGeometry,
} from "./incidenceComparisonTypes";
import {
  PostgisDcahNeighborhoodBoundaryProvider,
  resolveSupportedDcahMunicipalityCode,
  type IncidenceNeighborhoodBoundaryProvider,
} from "./incidenceNeighborhoodBoundaryProvider";
import {
  InegiGaiaMunicipalityBoundaryProvider,
  type IncidenceMunicipalityBoundaryProvider,
} from "./incidenceMunicipalityBoundaryProvider";

export type IncidenceTerritorialResolutionStatus =
  | "RESOLVED"
  | "PARTIAL"
  | "NOT_FOUND"
  | "UNSUPPORTED";

export type IncidenceTerritorialResolutionProvenance = {
  source: "USER_DEFINED" | "INEGI_DCAH_POSTGIS" | "INEGI_GAIA" | "NOT_CONFIGURED";
  method: string;
  resolvedAt?: string;
  limitations: string[];
  requestedReferences?: string[];
};

export type IncidenceTerritorialResolution = {
  status: IncidenceTerritorialResolutionStatus;
  territory: CrimeIncidenceComparisonTerritory;
  resolvedGeometry?: CrimeIncidenceResolvedGeometry;
  provenance: IncidenceTerritorialResolutionProvenance;
  limitations: string[];
};

export type IncidenceTerritorialResolverProviders = {
  municipalityBoundaryProvider?: IncidenceMunicipalityBoundaryProvider;
  neighborhoodBoundaryProvider?: IncidenceNeighborhoodBoundaryProvider;
  streetGeometryProvider?: unknown;
};

export type IncidenceTerritorialResolverOptions = {
  providers?: IncidenceTerritorialResolverProviders;
  now?: () => string;
};

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatLng(point: { lat: unknown; lng: unknown }): point is { lat: number; lng: number } {
  return (
    isFiniteCoordinate(point.lat) &&
    isFiniteCoordinate(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function pointKey(point: { lat: number; lng: number }): string {
  return `${point.lat},${point.lng}`;
}

function samePoint(left: { lat: number; lng: number }, right: { lat: number; lng: number }): boolean {
  return left.lat === right.lat && left.lng === right.lng;
}

function unsupportedResolution(
  territory: CrimeIncidenceComparisonTerritory,
  method: string,
  limitations: string[],
  requestedReferences?: string[]
): IncidenceTerritorialResolution {
  return {
    status: "UNSUPPORTED",
    territory,
    provenance: {
      source: "NOT_CONFIGURED",
      method,
      limitations,
      ...(requestedReferences ? { requestedReferences } : {}),
    },
    limitations,
  };
}

function resolveCustomPolygon(
  territory: Extract<CrimeIncidenceComparisonTerritory, { type: "CUSTOM_POLYGON" }>,
  now: () => string
): IncidenceTerritorialResolution {
  const invalidCoordinate = territory.coordinates.find((point) => !isValidLatLng(point));
  if (invalidCoordinate) {
    const limitations = ["CUSTOM_POLYGON contiene coordenadas fuera de rango o no finitas."];
    return {
      status: "PARTIAL",
      territory,
      provenance: {
        source: "USER_DEFINED",
        method: "CUSTOM_POLYGON",
        limitations,
      },
      limitations,
    };
  }

  const distinctCount = new Set(territory.coordinates.map(pointKey)).size;
  if (distinctCount < 3) {
    const limitations = ["CUSTOM_POLYGON requiere al menos 3 vertices distintos."];
    return {
      status: "PARTIAL",
      territory,
      provenance: {
        source: "USER_DEFINED",
        method: "CUSTOM_POLYGON",
        limitations,
      },
      limitations,
    };
  }

  const closedRing = samePoint(
    territory.coordinates[0],
    territory.coordinates[territory.coordinates.length - 1]
  )
    ? territory.coordinates
    : [...territory.coordinates, territory.coordinates[0]];

  return {
    status: "RESOLVED",
    territory,
    resolvedGeometry: {
      type: "Polygon",
      coordinates: [closedRing.map((point) => [point.lng, point.lat])],
    },
    provenance: {
      source: "USER_DEFINED",
      method: "CUSTOM_POLYGON",
      resolvedAt: now(),
      limitations: [],
    },
    limitations: [],
  };
}

async function resolveMunicipality(
  territory: Extract<CrimeIncidenceComparisonTerritory, { type: "MUNICIPALITY" }>,
  provider: IncidenceMunicipalityBoundaryProvider,
  now: () => string
): Promise<IncidenceTerritorialResolution> {
  const requestedReferences = [territory.municipality];

  try {
    const result = await provider.resolveMunicipalityBoundary({
      municipality: territory.municipality,
    });

    if (result.status === "RESOLVED") {
      return {
        status: "RESOLVED",
        territory,
        resolvedGeometry: result.match.geometry,
        provenance: {
          source: "INEGI_GAIA",
          method: "INEGI_GAIA_MGEM_2025_MUNICIPALITY",
          resolvedAt: now(),
          limitations: [],
          requestedReferences,
        },
        limitations: [],
      };
    }

    return {
      status: result.status,
      territory,
      provenance: {
        source: "INEGI_GAIA",
        method: "INEGI_GAIA_MGEM_2025_MUNICIPALITY",
        limitations: result.limitations,
        requestedReferences,
      },
      limitations: result.limitations,
    };
  } catch (error) {
    const limitations = [
      `INEGI GAIA no pudo resolver el municipio: ${error instanceof Error ? error.message : "error desconocido"}.`,
    ];
    return {
      status: "PARTIAL",
      territory,
      provenance: {
        source: "INEGI_GAIA",
        method: "INEGI_GAIA_MGEM_2025_MUNICIPALITY",
        limitations,
        requestedReferences,
      },
      limitations,
    };
  }
}

async function resolveNeighborhood(
  territory: Extract<CrimeIncidenceComparisonTerritory, { type: "NEIGHBORHOOD" }>,
  provider: IncidenceNeighborhoodBoundaryProvider,
  now: () => string
): Promise<IncidenceTerritorialResolution> {
  const requestedReferences = [
    ...(territory.municipality ? [territory.municipality] : []),
    territory.neighborhood,
  ];
  const municipalityCode = resolveSupportedDcahMunicipalityCode(territory.municipality);

  if (territory.municipality?.trim() && municipalityCode === undefined) {
    const limitations = [
      "El proveedor DCAH PostGIS solo tiene mapeo municipal explicito para Aguascalientes en esta fase.",
    ];
    return {
      status: "UNSUPPORTED",
      territory,
      provenance: {
        source: "INEGI_DCAH_POSTGIS",
        method: "DCAH_ASENTAMIENTOS_2025_AGS_NEIGHBORHOOD",
        limitations,
        requestedReferences,
      },
      limitations,
    };
  }

  const result = await provider.resolveNeighborhoodBoundary({
    neighborhood: territory.neighborhood,
    municipality: territory.municipality,
    municipalityCode,
  });

  if (result.status === "RESOLVED") {
    return {
      status: "RESOLVED",
      territory,
      resolvedGeometry: result.match.geometry,
      provenance: {
        source: "INEGI_DCAH_POSTGIS",
        method: "DCAH_ASENTAMIENTOS_2025_AGS_NEIGHBORHOOD",
        resolvedAt: now(),
        limitations: [],
        requestedReferences,
      },
      limitations: [],
    };
  }

  if (result.status === "AMBIGUOUS") {
    const limitations = [
      "La colonia o asentamiento existe en DCAH con multiples coincidencias; se requiere municipio soportado o criterio adicional.",
    ];
    return {
      status: "PARTIAL",
      territory,
      provenance: {
        source: "INEGI_DCAH_POSTGIS",
        method: "DCAH_ASENTAMIENTOS_2025_AGS_NEIGHBORHOOD",
        limitations,
        requestedReferences,
      },
      limitations,
    };
  }

  const limitations = ["No se encontro colonia o asentamiento coincidente en DCAH PostGIS."];
  return {
    status: "NOT_FOUND",
    territory,
    provenance: {
      source: "INEGI_DCAH_POSTGIS",
      method: "DCAH_ASENTAMIENTOS_2025_AGS_NEIGHBORHOOD",
      limitations,
      requestedReferences,
    },
    limitations,
  };
}

export async function resolveIncidenceTerritory(
  territory: CrimeIncidenceComparisonTerritory,
  options: IncidenceTerritorialResolverOptions = {}
): Promise<IncidenceTerritorialResolution> {
  const now = options.now ?? (() => new Date().toISOString());

  if (territory.type === "CUSTOM_POLYGON") {
    return resolveCustomPolygon(territory, now);
  }

  if (territory.type === "MUNICIPALITY") {
    return resolveMunicipality(
      territory,
      options.providers?.municipalityBoundaryProvider ?? new InegiGaiaMunicipalityBoundaryProvider(),
      now
    );
  }

  if (territory.type === "NEIGHBORHOOD") {
    return resolveNeighborhood(
      territory,
      options.providers?.neighborhoodBoundaryProvider ?? new PostgisDcahNeighborhoodBoundaryProvider(),
      now
    );
  }

  if (territory.type === "STREET") {
    return unsupportedResolution(
      territory,
      "STREET_GEOMETRY_PROVIDER",
      ["No existe resolver vial nominal programatico configurado para calles."]
    );
  }

  return unsupportedResolution(
    territory,
    "STREET_SET_GEOMETRY_PROVIDER",
    ["No existe resolver vial nominal programatico configurado para resolver varias calles."],
    territory.streets
  );
}
