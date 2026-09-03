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

  useEffect(() => {
    fetch("/api/incidencia/analytics")
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .catch((error) => setData({ success: false, error: String(error) }))
      .finally(() => setLoading(false));
  }, []);

  const records = data?.records ?? [];

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
            querySource: "CSV_LEGACY_FALLBACK",
            sourceStatus: "CSV_LEGACY_FALLBACK",
            sourceFile: record.sourceFile,
            datasetId: "INCIDENCIA_DELICTIVA",
          },
          coverage: {
            geographic: coverageStatus,
          },
          geoValidation: "VALID_GEOLOCATION",
          lineage: {
            dataset: "INCIDENCIA_DELICTIVA",
            querySource: "CSV_LEGACY_FALLBACK",
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
              <select value={municipality} onChange={(e) => { setMunicipality(e.target.value); setNeighborhood(""); setStreet(""); }} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todo el Estado</option>
                {municipalities.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={neighborhood} onChange={(e) => { setNeighborhood(e.target.value); setStreet(""); }} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todas las colonias</option>
                {neighborhoods.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={street} onChange={(e) => setStreet(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-slate-200">
                <option value="">Todas las calles</option>
                {streets.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
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
              />
            </div>
          </div>

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
    </div>
  );
}
