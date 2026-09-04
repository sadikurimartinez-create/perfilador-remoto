"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProfessionalGeoMap } from "@/components/maps/ProfessionalGeoMap";
import { CrimeIncidenceAnalytics } from "@/components/crime-incidence/CrimeIncidenceAnalytics";
import { projectStandaloneCrimeIncidenceAnalytics } from "@/utils/crimeIncidenceAnalyticalProjection";
import type { CanonicalCrimeIncident } from "@/types/crimeIncidenceWorkspace";

type IncidentRecord = {
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

type StreetCandidateGeometry = {
  type: "MultiLineString";
  coordinates: Array<Array<[number, number]>>;
};

type StreetCandidateNeighborhood = {
  cvegeo: string;
  cveMun: string;
  nomAsen: string;
  tipo: string | null;
  metersInside: number;
};

type StreetCandidate = {
  candidateId: string;
  cveMun: string;
  cveLoc: string;
  cvevial: string;
  nomvial: string;
  tipos: string[];
  sentidos: string[];
  localidades: string[];
  geometry: StreetCandidateGeometry;
  neighborhoods: StreetCandidateNeighborhood[];
};

type StreetCandidatesApiResponse = {
  success: boolean;
  resolution?:
    | { status: "RESOLVED"; candidate: StreetCandidate }
    | { status: "AMBIGUOUS"; candidates: StreetCandidate[] }
    | { status: "NOT_FOUND"; candidates: [] }
    | { status: "UNSUPPORTED"; candidates: []; limitations: string[] };
  error?: string;
};
type IncidenceResponse = {
  success: boolean;
  dataset?: string;
  files?: number;
  totalRecords?: number;
  records?: IncidentRecord[];
  governance?: {
    datasetReference: string;
    fingerprint: string;
    canonical: {
      received: number;
      accepted: number;
      rejected: number;
      duplicates: number;
    };
    provenance: {
      datasetName: string | null;
      datasetVersion: string | null;
      sourceOrganization: string | null;
      temporalStart: string | null;
      temporalEnd: string | null;
      missing: string[];
    };
    admission: {
      status: string;
      accepted: boolean;
      reasons: string[];
      warnings: string[];
    };
  };
  error?: string;
};

export default function CrimeIncidencePage() {
  const [data, setData] = useState<IncidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [municipality, setMunicipality] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [street, setStreet] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCrimePoints, setShowCrimePoints] = useState(false);
  const [streetCorridorWidth, setStreetCorridorWidth] = useState<15 | 30 | 50>(30);
  const [streetCandidateLoading, setStreetCandidateLoading] = useState(false);
  const [streetCandidates, setStreetCandidates] = useState<StreetCandidate[]>([]);
  const [selectedStreetCandidate, setSelectedStreetCandidate] = useState<StreetCandidate | null>(null);
  const [selectedStreetCandidates, setSelectedStreetCandidates] = useState<StreetCandidate[]>([]);
  const activeStreetSet = selectedStreetCandidates;

  const streetSetGeometry =
    activeStreetSet.length > 0
      ? {
          type: "MultiLineString" as const,
          coordinates: activeStreetSet.flatMap(
            (item) => item.geometry.coordinates
          ),
        }
      : null;
  const [streetResolutionError, setStreetResolutionError] = useState<string | null>(null);
  const [showStreetCandidateModal, setShowStreetCandidateModal] = useState(false);
  const [streetQueryRecords, setStreetQueryRecords] = useState<IncidentRecord[]>([]);
  const [streetQueryLoading, setStreetQueryLoading] = useState(false);
  const [streetQueryError, setStreetQueryError] = useState<string | null>(null);
  const [streetQuerySource, setStreetQuerySource] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/incidencia/analytics")
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .catch((error) => setData({ success: false, error: String(error) }))
      .finally(() => setLoading(false));
  }, []);

  const baseRecords: IncidentRecord[] = data?.records ?? [];

  const records: IncidentRecord[] =
    activeStreetSet.length > 0
      ? streetQueryRecords
      : baseRecords;

  useEffect(() => {
    if (activeStreetSet.length === 0) {
      setStreetQueryRecords([]);
      setStreetQueryError(null);
      setStreetQuerySource(null);
      setStreetQueryLoading(false);
      return;
    }

    const controller = new AbortController();

    const runStreetQuery = async () => {
      setStreetQueryLoading(true);
      setStreetQueryError(null);

      try {
        const response = await fetch("/api/incidencia/street-query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            geometry: streetSetGeometry,
            widthMeters: streetCorridorWidth,
            startDate: startDate || null,
            endDate: endDate || null,
            incidentTypes: incidentType ? [incidentType] : [],
            municipality: municipality || "Aguascalientes",
            street: activeStreetSet
              .map((item) => item.nomvial)
              .join(", "),
          }),
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(
            payload?.error ||
              `STREET_QUERY_HTTP_${response.status}`
          );
        }

        setStreetQueryRecords(
          Array.isArray(payload.records)
            ? payload.records
            : []
        );

        setStreetQuerySource(
          typeof payload.querySource === "string"
            ? payload.querySource
            : null
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setStreetQueryRecords([]);
        setStreetQuerySource(null);
        setStreetQueryError(
          error instanceof Error
            ? error.message
            : String(error)
        );
      } finally {
        if (!controller.signal.aborted) {
          setStreetQueryLoading(false);
        }
      }
    };

    void runStreetQuery();

    return () => {
      controller.abort();
    };
  }, [
    selectedStreetCandidate,
    streetCorridorWidth,
    startDate,
    endDate,
    incidentType,
    municipality,
  ]);
  const municipalities = useMemo(() =>
    Array.from(new Set(records.map((record) => record.municipality).filter(Boolean)))
      .sort() as string[],
    [records]
  );

  const neighborhoods = useMemo(() =>
    Array.from(new Set(records
      .filter((record) => !municipality || record.municipality === municipality)
      .map((record) => record.neighborhood)
      .filter(Boolean)))
      .sort() as string[],
    [records, municipality]
  );

  const streets = useMemo(() =>
    Array.from(new Set(records
      .filter((record) => !municipality || record.municipality === municipality)
      .filter((record) => !neighborhood || record.neighborhood === neighborhood)
      .map((record) => record.street)
      .filter(Boolean)))
      .sort() as string[],
    [records, municipality, neighborhood]
  );

  const incidentTypes = useMemo(() =>
    Array.from(new Set(records.map((record) => record.incidentType).filter(Boolean)))
      .sort() as string[],
    [records]
  );

  const filtered = useMemo(() => records.filter((record) => {
    if (municipality && record.municipality !== municipality) return false;
    if (neighborhood && record.neighborhood !== neighborhood) return false;
    if (street && record.street !== street) return false;
    if (incidentType && record.incidentType !== incidentType) return false;
    if (startDate && record.date && record.date < startDate) return false;
    if (endDate && record.date && record.date > endDate) return false;
    return true;
  }), [records, municipality, neighborhood, street, incidentType, startDate, endDate]);

  const mapIncidents = useMemo<CanonicalCrimeIncident[]>(() =>
    filtered
      .filter((record) =>
        record.lat !== null &&
        record.lng !== null &&
        Number.isFinite(record.lat) &&
        Number.isFinite(record.lng)
      )
      .map((record, index) => {
        const lat = record.lat as number;
        const lng = record.lng as number;
        const inCoverage =
          lat >= 21.0 &&
          lat <= 22.8 &&
          lng >= -103.2 &&
          lng <= -101.5;
        const coverageStatus = inCoverage ? "IN_COVERAGE" : "OUT_OF_COVERAGE";

        return {
          id: `${record.sourceFile}-${index}-${lat}-${lng}`,
          incidentType: record.incidentType,
          occurredDate: record.date,
          occurredTime: record.time,
          timeRange: null,
          coordinates: {
            lat,
            lng,
            originalLat: lat,
            originalLng: lng,
          },
          location: {
            ...(record.municipality ? { municipality: record.municipality } : {}),
            ...(record.neighborhood ? { neighborhood: record.neighborhood } : {}),
            ...(record.street ? { street: record.street } : {}),
          },
          source: {
            querySource: selectedStreetCandidate ? "POSTGIS" : "CSV_LEGACY_FALLBACK",
            sourceStatus: selectedStreetCandidate ? "POSTGIS_AVAILABLE" : "CSV_LEGACY_FALLBACK",
            sourceFile: record.sourceFile,
            datasetId: "INCIDENCIA_DELICTIVA",
          },
          coverage: {
            geographic: coverageStatus,
          },
          geoValidation: "VALID_GEOLOCATION",
          lineage: {
            dataset: selectedStreetCandidate ? "incidencia_estadistica" : "INCIDENCIA_DELICTIVA",
            querySource: selectedStreetCandidate ? "POSTGIS" : "CSV_LEGACY_FALLBACK",
            filters: {
              municipality: municipality || null,
              neighborhood: neighborhood || null,
              street: street || null,
              incidentType: incidentType || null,
            },
            timeRange: {
              start: startDate || null,
              end: endDate || null,
              status:
                startDate || endDate
                  ? "KNOWN"
                  : "TEMPORAL_COVERAGE_UNKNOWN",
            },
            geographicFilter: {
              center: { lat, lng },
              radiusMeters: 0,
              coverageStatus,
            },
            recordSubset: {
              totalScanned: records.length,
              matched: filtered.length,
              excluded: records.length - filtered.length,
              duplicates: 0,
              returnedRecords: filtered.length,
            },
          },
        };
      }),
    [
      filtered,
      records.length,
      municipality,
      neighborhood,
      street,
      incidentType,
      startDate,
      endDate,
    ]
  );

  const analyticsProjection = useMemo(
    () =>
      projectStandaloneCrimeIncidenceAnalytics({
        incidents: mapIncidents,
        datasetId:
          data?.governance?.datasetReference ??
          data?.dataset ??
          "INCIDENCIA_DELICTIVA",
        coverageStatus:
          data?.governance?.admission.accepted
            ? "IN_COVERAGE"
            : "UNKNOWN_COVERAGE",
        temporalStart:
          startDate ||
          data?.governance?.provenance.temporalStart ||
          null,
        temporalEnd:
          endDate ||
          data?.governance?.provenance.temporalEnd ||
          null,
        totalScanned: records.length,
      }),
    [
      mapIncidents,
      data?.governance?.datasetReference,
      data?.governance?.admission.accepted,
      data?.governance?.provenance.temporalStart,
      data?.governance?.provenance.temporalEnd,
      data?.dataset,
      startDate,
      endDate,
      records.length,
    ]
  );

  const clearStreetResolution = () => {
    setSelectedStreetCandidate(null);
    setStreetCandidates([]);
    setStreetResolutionError(null);
    setShowStreetCandidateModal(false);
  };

  const handleStreetChange = async (value: string) => {
    setStreet(value);
    clearStreetResolution();

    if (!value) {
      return;
    }

    setStreetCandidateLoading(true);

    try {
      const response = await fetch("/api/incidencia/street-candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          street: value,
          municipality: municipality || "Aguascalientes",
        }),
      });

      const payload = (await response.json()) as StreetCandidatesApiResponse;

      if (!response.ok || !payload.success || !payload.resolution) {
        throw new Error(payload.error || "STREET_RESOLUTION_FAILED");
      }

      if (payload.resolution.status === "RESOLVED") {
        setSelectedStreetCandidate(payload.resolution.candidate);
        return;
      }

      if (payload.resolution.status === "AMBIGUOUS") {
        setStreetCandidates(payload.resolution.candidates);
        setShowStreetCandidateModal(true);
        return;
      }

      if (payload.resolution.status === "NOT_FOUND") {
        setStreetResolutionError(
          "No se encontró una vialidad oficial coincidente en INEGI GAIA."
        );
        return;
      }

      setStreetResolutionError(
        payload.resolution.limitations.join(" ")
      );
    } catch (error) {
      setStreetResolutionError(
        error instanceof Error
          ? error.message
          : "No fue posible resolver la vialidad."
      );
    } finally {
      setStreetCandidateLoading(false);
    }
  };

  const toggleStreetCandidateSelection = (candidate: StreetCandidate) => {
    setSelectedStreetCandidates((current) =>
      current.some(
        (item) => item.candidateId === candidate.candidateId
      )
        ? current.filter(
            (item) => item.candidateId !== candidate.candidateId
          )
        : [...current, candidate]
    );
  };


  const handleStreetSetConfirm = () => {

    if (selectedStreetCandidates.length === 0) {
      return;
    }


    setSelectedStreetCandidate(
      selectedStreetCandidates[0]
    );


    setShowStreetCandidateModal(false);
    setStreetCandidates([]);
    setStreetResolutionError(null);

  };


  const handleStreetCandidateSelect = (candidate: StreetCandidate) => {
    setSelectedStreetCandidate(candidate);
    setSelectedStreetCandidates([candidate]);
    setShowStreetCandidateModal(false);
    setStreetCandidates([]);
    setStreetResolutionError(null);
  };
  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <div>
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
          ← Volver al Lobby
        </Link>
        <h1 className="mt-2 text-2xl font-black text-slate-100">Incidencia Delictiva</h1>
        <p className="mt-1 text-sm text-slate-400">
          Módulo institucional independiente de análisis de incidencia delictiva.
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-slate-300">
          Cargando dataset institucional de Incidencia Delictiva...
        </div>
      )}

      {!loading && data && !data.success && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-6 text-red-300">
          No fue posible cargar el dataset: {data.error}
        </div>
      )}

      {!loading && data?.success && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase text-slate-500">Registros</div>
              <div className="text-2xl font-black text-slate-100">{data.totalRecords ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase text-slate-500">Archivos fuente</div>
              <div className="text-2xl font-black text-slate-100">{data.files ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase text-slate-500">Resultado filtrado</div>
              <div className="text-2xl font-black text-slate-100">{filtered.length}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs uppercase text-slate-500">Gobernanza ADR-022</div>
              <div className={`text-lg font-black ${data.governance?.admission.accepted ? "text-emerald-400" : "text-amber-400"}`}>
                {data.governance?.admission.status ?? "NO DISPONIBLE"}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.governance?.provenance.missing.length
                  ? `Faltan ${data.governance.provenance.missing.length} metadatos de procedencia`
                  : "Provenance institucional completa"}
              </div>
            </div>
          </div>

          {data.governance && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-200">Gobernanza y trazabilidad ADR-022</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Canonicalización, fingerprint, provenance y admission gate del dataset activo.
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${data.governance.admission.accepted ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>
                  {data.governance.admission.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span className="text-slate-500">Recibidos</span><div className="font-bold text-slate-200">{data.governance.canonical.received}</div></div>
                <div><span className="text-slate-500">Aceptados</span><div className="font-bold text-slate-200">{data.governance.canonical.accepted}</div></div>
                <div><span className="text-slate-500">Rechazados</span><div className="font-bold text-slate-200">{data.governance.canonical.rejected}</div></div>
                <div><span className="text-slate-500">Duplicados</span><div className="font-bold text-slate-200">{data.governance.canonical.duplicates}</div></div>
              </div>

              <div className="mt-4 break-all text-[11px] text-slate-500">
                Fingerprint SHA-256: {data.governance.fingerprint}
              </div>

              {data.governance.provenance.missing.length > 0 && (
                <div className="mt-4 rounded-md border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-300">
                  Provenance incompleta: {data.governance.provenance.missing.join(", ")}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-4">Selección analítica</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={municipality} onChange={(e) => { setMunicipality(e.target.value); setNeighborhood(""); setStreet(""); clearStreetResolution(); }} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todo el Estado</option>
                {municipalities.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={neighborhood} onChange={(e) => { setNeighborhood(e.target.value); setStreet(""); clearStreetResolution(); }} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todas las colonias</option>
                {neighborhoods.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select
                  value={street}
                  onChange={(e) => void handleStreetChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200"
                >
                  <option value="">Todas las calles</option>
                  {streets.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>

          {selectedStreetCandidate && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Corredor analítico
              </label>

              <select
                value={streetCorridorWidth}
                onChange={(event) =>
                  setStreetCorridorWidth(
                    Number(event.target.value) as 15 | 30 | 50
                  )
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              >
                <option value={15}>Estricto · 15 m por lado</option>
                <option value={30}>Estándar · 30 m por lado</option>
                <option value={50}>Ampliado · 50 m por lado</option>
              </select>

              <p className="mt-1 text-xs text-slate-500">
                El corredor se calcula sobre toda la geometría oficial de la vialidad seleccionada.
              </p>
            </div>
          )}

                {streetCandidateLoading && (
                  <div className="text-[11px] text-cyan-400">
                    Resolviendo vialidad oficial...
                  </div>
                )}

                {selectedStreetCandidate && (
                  <div className="rounded-md border border-emerald-900/60 bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-300">
                    Vialidades seleccionadas:
                    {activeStreetSet.length > 0 && (
  <div className="mt-2 text-xs text-cyan-300">
    {activeStreetSet.map((item) => (
      <div key={item.candidateId}>
        {item.nomvial}
        {item.neighborhoods?.length > 0
          ? ` — ${item.neighborhoods.map(
              (n) => n.nomAsen
            ).join(", ")}`
          : ""}
      </div>
    ))}
  </div>
)}
{selectedStreetCandidate.neighborhoods.length > 0
                      ? ` — ${selectedStreetCandidate.neighborhoods
                          .map((item) => item.nomAsen)
                          .join(", ")}`
                      : ""}
                  </div>
                )}

                {streetResolutionError && (
                  <div className="rounded-md border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
                    {streetResolutionError}
                  </div>
                )}
              <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todos los delitos</option>
                {incidentTypes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-200">Mapa de Incidencia Delictiva</h2>
                <p className="text-xs text-slate-500">
                  Visualización georreferenciada de los registros que cumplen la selección analítica vigente.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="text-xs text-slate-400">
                  Eventos disponibles: <strong className="text-slate-200">{mapIncidents.length}</strong>
                </div>

                <div className="text-xs text-slate-400">
                  Pines visibles: <strong className="text-slate-200">{showCrimePoints ? mapIncidents.length : 0}</strong>
                </div>

                <details className="relative">
                  <summary className="cursor-pointer select-none rounded-md border border-cyan-900/60 bg-slate-900 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-slate-800">
                    Capas de Incidencia
                  </summary>

                  <div className="absolute right-0 z-50 mt-2 min-w-[260px] rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-xl">
                    <div className="mb-3 text-[11px] font-black uppercase tracking-wider text-cyan-400">
                      Visualización
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-200 hover:bg-slate-900">
                      <input
                        type="checkbox"
                        checked={showCrimePoints}
                        onChange={(event) => setShowCrimePoints(event.target.checked)}
                        className="h-4 w-4 accent-cyan-500"
                      />
                      <span>Puntos de incidencia</span>
                    </label>

                    <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-500">
                      Las capas aparecen desactivadas al abrir el mapa.
                    </div>
                  </div>
                </details>
              </div>
            </div>

            <div className="min-h-[520px]">
              <ProfessionalGeoMap
                crimeIncidents={showCrimePoints ? mapIncidents : []}
            selectedStreetGeometry={streetSetGeometry ?? selectedStreetCandidate?.geometry ?? null}
              />
            </div>
          </div>

          {selectedStreetCandidate && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
              <div className="font-semibold text-amber-300">
                Consulta espacial de vialidad activa
              </div>

              <div className="mt-1 text-xs text-slate-400">
                {activeStreetSet.length > 0
  ? `${activeStreetSet.length} vialidades seleccionadas · corredor de ${streetCorridorWidth} m por lado`
  : ""}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {streetQueryLoading
                  ? "Consultando PostGIS..."
                  : streetQueryError
                    ? `Error: ${streetQueryError}`
                    : `${records.length} registros · fuente ${streetQuerySource ?? "POSTGIS"}`}
              </div>
            </div>
          )}
          {data.governance?.admission.accepted && (
            <div
              className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden"
              data-testid="standalone-crime-incidence-analytics"
            >
              <CrimeIncidenceAnalytics projection={analyticsProjection} />
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 text-sm font-bold text-slate-200">
              Registros seleccionados
            </div>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-2">Delito</th>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Municipio</th>
                    <th className="p-2">Colonia</th>
                    <th className="p-2">Calle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {filtered.slice(0, 200).map((record, index) => (
                    <tr key={`${record.sourceFile}-${index}`} className="text-slate-300">
                      <td className="p-2">{record.incidentType ?? "Sin dato"}</td>
                      <td className="p-2">{record.date ?? "Sin dato"}</td>
                      <td className="p-2">{record.municipality ?? "Sin dato"}</td>
                      <td className="p-2">{record.neighborhood ?? "Sin dato"}</td>
                      <td className="p-2">{record.street ?? "Sin dato"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {showStreetCandidateModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">

            <div className="sticky top-0 border-b border-slate-800 bg-slate-950 px-5 py-4">
              <h2 className="text-lg font-black text-slate-100">
                Seleccione la vialidad correcta
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Se encontraron varias vialidades con el nombre "{street}".
                Seleccione la colonia o fraccionamiento correspondiente.
              </p>
            </div>

            <div className="space-y-3 p-5">
              {streetCandidates.map((candidate) => (
                <div
  key={candidate.candidateId}
  className="rounded-lg border border-slate-700 bg-slate-900 p-3"
>

  <label className="flex items-start gap-3 cursor-pointer">

    <input
      type="checkbox"
      checked={
        selectedStreetCandidates.some(
          (item) =>
            item.candidateId === candidate.candidateId
        )
      }
      onChange={() =>
        toggleStreetCandidateSelection(candidate)
      }
      className="mt-1"
    />

    <div>

      <div className="font-bold text-slate-100">
        {candidate.nomvial}
      </div>

      <div className="text-xs text-slate-400">
        Localidad: {candidate.cveLoc}
      </div>

      {candidate.neighborhoods?.length > 0 && (
        <div className="mt-2 text-xs text-slate-300">

          <div>
            Colonia:
            <span className="ml-1 font-bold text-cyan-300">
              {candidate.neighborhoods
                .map((item) => item.nomAsen)
                .join(", ")}
            </span>
          </div>

          <div>
            Tipo:
            <span className="ml-1 font-bold text-cyan-300">
              {candidate.neighborhoods
                .map((item) => item.tipo ?? "SIN TIPO")
                .join(", ")}
            </span>
          </div>

        </div>
      )}

      <div className="text-xs text-slate-400">
        CVEVIAL: {candidate.cvevial}
      </div>

    </div>

  </label>

</div>
              ))}
            </div>

            <div className="sticky bottom-0 flex justify-end border-t border-slate-800 bg-slate-950 px-5 py-4">
              <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-5 py-4">

                <div className="text-sm text-slate-300">
                  Seleccionados:
                  <span className="ml-1 font-black text-cyan-400">
                    {selectedStreetCandidates.length}
                  </span>
                </div>


                <div className="flex gap-3">

                  <button
                    type="button"
                    onClick={() => {
                      setStreet("");
                      clearStreetResolution();
                    }}
                    className="rounded-md border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-900"
                  >
                    Cancelar
                  </button>


                  <button
                    type="button"
                    disabled={selectedStreetCandidates.length === 0}
                    onClick={handleStreetSetConfirm}
                    className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Analizar vialidades seleccionadas
                  </button>

                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
