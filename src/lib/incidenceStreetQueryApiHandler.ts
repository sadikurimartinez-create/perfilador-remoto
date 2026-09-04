import {
  executeStreetIncidenceQuery,
  type ExecuteStreetIncidenceQueryInput,
} from "./incidenceStreetQueryService";

import type {
  IncidenceStreetMultiLineStringGeometry,
} from "./incidenceStreetCandidateProvider";

type StreetQueryApiDependencies = {
  executeQuery?: typeof executeStreetIncidenceQuery;
};

export type StreetQueryApiBody = {
  geometry?: IncidenceStreetMultiLineStringGeometry;
  widthMeters?: 15 | 30 | 50;
  startDate?: string | null;
  endDate?: string | null;
  incidentTypes?: string[];
  municipality?: string | null;
  street?: string | null;
};

export type StreetQueryUiRecord = {
  incidentType: string | null;
  date: string | null;
  time: string | null;
  municipality: string | null;
  neighborhood: string | null;
  street: string | null;
  lat: number | null;
  lng: number | null;
  sourceFile: string;
};

function isFinitePosition(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function isValidMultiLineStringGeometry(
  value: unknown
): value is IncidenceStreetMultiLineStringGeometry {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { type?: unknown }).type !== "MultiLineString"
  ) {
    return false;
  }

  const coordinates =
    (value as { coordinates?: unknown }).coordinates;

  return (
    Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    coordinates.every(
      (line) =>
        Array.isArray(line) &&
        line.length >= 2 &&
        line.every(isFinitePosition)
    )
  );
}

function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^\d{4}-\d{2}-\d{2}/);

  return isoMatch ? isoMatch[0] : text;
}

function textOrNull(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function finiteNumberOrNull(value: unknown): number | null {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
}

export async function handleStreetQueryApi(
  body: StreetQueryApiBody,
  dependencies: StreetQueryApiDependencies = {}
): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  if (!isValidMultiLineStringGeometry(body.geometry)) {
    return {
      status: 400,
      body: {
        success: false,
        error: "STREET_QUERY_INVALID_GEOMETRY",
      },
    };
  }

  const widthMeters = body.widthMeters ?? 30;

  if (![15, 30, 50].includes(widthMeters)) {
    return {
      status: 400,
      body: {
        success: false,
        error: "STREET_QUERY_INVALID_WIDTH",
      },
    };
  }

  const executeQuery =
    dependencies.executeQuery ??
    executeStreetIncidenceQuery;

  const queryInput: ExecuteStreetIncidenceQueryInput = {
    geometry: body.geometry,
    widthMeters,
    startDate: body.startDate ?? null,
    endDate: body.endDate ?? null,
    incidentTypes:
      body.incidentTypes?.filter(Boolean) ?? [],
  };

  const result = await executeQuery(queryInput);

  const uiRecords: StreetQueryUiRecord[] =
    result.records.data.map((raw: any) => ({
      incidentType: textOrNull(raw.INCIDENTE),
      date: normalizeDate(raw.FECHA),
      time: textOrNull(raw.HORA),
      municipality: textOrNull(body.municipality),
      neighborhood: textOrNull(raw.NOM_ASEN),
      street: textOrNull(body.street),
      lat: finiteNumberOrNull(raw.lat),
      lng: finiteNumberOrNull(raw.lng),
      sourceFile:
        textOrNull(raw.fuente) ??
        "incidencia_estadistica",
    }));

  return {
    status: result.records.success ? 200 : 500,
    body: {
      success: result.records.success,
      querySource: result.records.querySource,
      sourceStatus: result.records.sourceStatus,
      coverageStatus: result.records.coverageStatus,
      widthMeters: result.widthMeters,
      corridorGeometry: result.corridorGeometry,
      records: uiRecords,
      lineage: result.records.lineage,
      error: result.records.error ?? null,
    },
  };
}