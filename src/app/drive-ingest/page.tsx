"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface IngestionLog {
  file_id: string;
  file_name: string;
  status: "processed" | "pending" | "failed";
  timestamp: string;
  source: string;
  logical_category: string;
  error_message?: string;
}

interface ExtractedIntelligence {
  fileId: string;
  fileName: string;
  logicalCategory: string;
  extractedText: string;
  summary: string;
  riskLevel: string;
  entities: {
    names: string[];
    aliases: string[];
    organizations: string[];
    locations: Array<{
      name: string;
      lat: number | null;
      lng: number | null;
      description: string;
    }>;
    phoneNumbers: string[];
    plates: string[];
    additionalAttributes?: Record<string, any>;
  };
  correlationSuggestions: Array<{
    targetType: string;
    targetName: string;
    reason: string;
  }>;
}

export default function DriveIngestPage() {
  const [logs, setLogs] = useState<IngestionLog[]>([]);
  const [intelligenceList, setIntelligenceList] = useState<ExtractedIntelligence[]>([]);
  const [selectedIntel, setSelectedIntelligence] = useState<ExtractedIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeTab, setActiveCategoryTab] = useState<"all" | "Pandillas" | "OSINT" | "Evidencia" | "Desaparecidos">("all");

  const loadData = async () => {
    try {
      setRefreshing(true);
      // Load logs
      const logsRes = await fetch("/api/drive-ingest?type=logs");
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }

      // Load intelligence
      const intelRes = await fetch("/api/drive-ingest?type=intelligence");
      if (intelRes.ok) {
        const intelData = await intelRes.json();
        setIntelligenceList(intelData.intelligence || []);
      }
    } catch (err) {
      console.error("Error loading ingestion logs:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerIngestion = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const res = await fetch("/api/drive-ingest", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(
          `Ingesta de Drive completada.\n\n` +
          `• Escaneados: ${data.report.scannedCount}\n` +
          `• Nuevos ingeridos: ${data.report.ingestedCount}\n` +
          `• Fallidos: ${data.report.failedCount}`
        );
      } else {
        alert(`Error al ejecutar la ingesta: ${data.error || "Error desconocido"}`);
      }
      loadData();
    } catch (err: any) {
      alert(`Error en el servidor: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter intelligence list based on selected category tab
  const filteredIntelligence = intelligenceList.filter((item) => {
    if (activeTab === "all") return true;
    return item.logicalCategory.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="space-y-6 max-w-[98%] mx-auto">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Drive Ingestion Engine v1.1</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-400">
            Motor de Ingesta Google Drive
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Sincronización automatizada y segura restringida exclusivamente a la carpeta{" "}
            <code className="text-sky-300 font-semibold bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/30">
              Perfilador_Ingesta
            </code>{" "}
            para alimentación táctica de inteligencia criminal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={refreshing || loading}
            className="p-2.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700/80 rounded-xl border border-slate-700 transition-all shadow-md"
            title="Refrescar historial"
          >
            🔄
          </button>
          <button
            onClick={triggerIngestion}
            disabled={loading || refreshing}
            className={`px-5 py-3 rounded-xl font-bold text-sm tracking-wide shadow-lg flex items-center gap-2 transition-all border ${
              loading
                ? "bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white border-sky-500/30 hover:scale-[1.02] active:scale-[0.98]"
            }`}
          >
            {loading ? (
              <>
                <span className="animate-spin text-sm">⏳</span>
                Instando e IA Procesando...
              </>
            ) : (
              <>
                <span>🚀</span>
                Escanear Google Drive
              </>
            )}
          </button>
        </div>
      </header>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Archivos Procesados</p>
          <div className="flex justify-between items-baseline">
            <h3 className="text-3xl font-extrabold text-sky-400">
              {logs.filter((l) => l.status === "processed").length}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-800/30">Activos</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-semibold">Pendientes / Ingesta</p>
          <div className="flex justify-between items-baseline">
            <h3 className="text-3xl font-extrabold text-amber-400">
              {logs.filter((l) => l.status === "pending").length}
            </h3>
            <span className="text-xs text-amber-400 font-semibold bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-800/30">Cola</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fallidos</p>
          <div className="flex justify-between items-baseline">
            <h3 className="text-3xl font-extrabold text-rose-500">
              {logs.filter((l) => l.status === "failed").length}
            </h3>
            <span className="text-xs text-rose-400 font-semibold bg-rose-950/40 px-2.5 py-0.5 rounded-full border border-rose-800/30">Bajo control</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nivel de Seguridad</p>
          <div className="flex justify-between items-baseline">
            <h3 className="text-xl font-extrabold text-emerald-400">Geoperimetrado</h3>
            <span className="text-xs text-sky-400 font-semibold bg-sky-950/40 px-2.5 py-0.5 rounded-full border border-sky-800/30">Mínimo Scope</span>
          </div>
        </div>
      </div>

      {/* TABS & MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: LISTS */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-200">Resultados de Inteligencia Ingeridos</h2>
            {/* Tab switchers */}
            <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs font-semibold">
              {(["all", "Pandillas", "OSINT", "Evidencia", "Desaparecidos"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveCategoryTab(tab)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    activeTab === tab
                      ? "bg-sky-500 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {filteredIntelligence.length === 0 ? (
            <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <span className="text-3xl">📁</span>
              <p className="text-sm text-slate-400 font-medium">No se encontraron archivos procesados en esta categoría.</p>
              <p className="text-xs text-slate-500">Agrega archivos PDF, Word, imágenes o audios en Google Drive e inicia el escaneo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredIntelligence.map((intel) => {
                const isSelected = selectedIntel?.fileId === intel.fileId;
                const riskColors = {
                  Bajo: "border-emerald-500/30 bg-emerald-950/10 text-emerald-400",
                  Medio: "border-amber-500/30 bg-amber-950/10 text-amber-400",
                  Alto: "border-orange-500/30 bg-orange-950/10 text-orange-400",
                  Crítico: "border-rose-500/30 bg-rose-950/10 text-rose-400",
                }[intel.riskLevel || "Medio"] || "border-slate-800 bg-slate-900/50 text-slate-400";

                return (
                  <div
                    key={intel.fileId}
                    onClick={() => setSelectedIntelligence(intel)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                      isSelected
                        ? "bg-sky-950/20 border-sky-500/50 shadow-md shadow-sky-500/5"
                        : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-bold bg-slate-800/80 px-2 py-0.5 rounded uppercase tracking-wider">
                          {intel.logicalCategory}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${riskColors}`}>
                          Riesgo {intel.riskLevel}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 truncate">{intel.fileName}</h4>
                      <p className="text-xs text-slate-400 line-clamp-1">{intel.summary}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 flex-shrink-0 self-end md:self-center">
                      <span className="text-[11px] bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
                        👥 {intel.entities?.names?.length || 0} ent.
                      </span>
                      <span>➡️</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SYSTEM LOGS TABLE */}
          <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-md font-bold text-slate-200">Historial y Auditoría de Sincronización</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 pb-3 uppercase tracking-wider font-semibold">
                    <th className="py-2.5">Archivo</th>
                    <th className="py-2.5">Carpeta Drive</th>
                    <th className="py-2.5">Estado</th>
                    <th className="py-2.5">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.map((log) => {
                    const statusColors = {
                      processed: "text-emerald-400 bg-emerald-950/40 border-emerald-800/30",
                      pending: "text-amber-400 bg-amber-950/40 border-amber-800/30",
                      failed: "text-rose-500 bg-rose-950/40 border-rose-800/30",
                    }[log.status] || "text-slate-400 bg-slate-800 border-slate-700";

                    return (
                      <tr key={log.file_id} className="text-slate-300 hover:bg-slate-900/20">
                        <td className="py-3 font-semibold max-w-[200px] truncate" title={log.file_name}>
                          {log.file_name}
                        </td>
                        <td className="py-3">
                          <span className="bg-slate-800/80 px-2 py-0.5 rounded font-bold uppercase text-[10px] text-slate-400">
                            {log.logical_category}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusColors}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500 font-medium">
                          {new Date(log.timestamp).toLocaleDateString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: DETAIL VIEW */}
        <div className="lg:col-span-5">
          {selectedIntel ? (
            <article className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6 backdrop-blur-md sticky top-4">
              {/* Card Header */}
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <div className="flex justify-between items-center">
                  <span className="bg-sky-500/15 text-sky-400 px-3 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wide">
                    {selectedIntel.logicalCategory}
                  </span>
                  <button
                    onClick={() => setSelectedIntelligence(null)}
                    className="text-slate-500 hover:text-slate-300 text-xs font-semibold"
                  >
                    Cerrar panel ✕
                  </button>
                </div>
                <h3 className="text-lg font-bold text-slate-100">{selectedIntel.fileName}</h3>
                <p className="text-xs text-slate-400 font-medium">ID de Archivo: {selectedIntel.fileId}</p>
              </div>

              {/* Summary and Risk */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diagnóstico IA Táctico</h4>
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold">Nivel de Riesgo:</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded uppercase border ${
                        {
                          Bajo: "border-emerald-500/30 bg-emerald-950/20 text-emerald-400",
                          Medio: "border-amber-500/30 bg-amber-950/20 text-amber-400",
                          Alto: "border-orange-500/30 bg-orange-950/20 text-orange-400",
                          Crítico: "border-rose-500/30 bg-rose-950/20 text-rose-400",
                        }[selectedIntel.riskLevel || "Medio"]
                      }`}
                    >
                      {selectedIntel.riskLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">{selectedIntel.summary}</p>
                </div>
              </div>

              {/* Extracted Entities */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entidades Identificadas</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Names and Aliases */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300">👤 Sujetos y Alias</span>
                    <ul className="space-y-1 text-xs text-slate-400">
                      {selectedIntel.entities?.names?.length === 0 && selectedIntel.entities?.aliases?.length === 0 ? (
                        <li className="italic text-slate-500">Ninguno detectado</li>
                      ) : (
                        <>
                          {selectedIntel.entities?.names?.map((n, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-slate-300 font-medium">
                              <span className="h-1 w-1 bg-sky-400 rounded-full" /> {n}
                            </li>
                          ))}
                          {selectedIntel.entities?.aliases?.map((a, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-indigo-400 font-bold bg-indigo-950/15 border border-indigo-900/30 px-2 py-0.5 rounded-md w-fit">
                              👻 &quot;{a}&quot;
                            </li>
                          ))}
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Organizations and Gangs */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300">🛡️ Bandas/Clicas</span>
                    <ul className="space-y-1 text-xs text-slate-400">
                      {selectedIntel.entities?.organizations?.length === 0 ? (
                        <li className="italic text-slate-500">Ninguna detectada</li>
                      ) : (
                        selectedIntel.entities?.organizations?.map((org, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <span className="h-1 w-1 bg-orange-400 rounded-full" /> {org}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                {/* Plates and Phones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300">🚗 Vehículos/Placas</span>
                    <ul className="space-y-1 text-xs text-slate-400">
                      {selectedIntel.entities?.plates?.length === 0 ? (
                        <li className="italic text-slate-500">Ninguna detectada</li>
                      ) : (
                        selectedIntel.entities?.plates?.map((plt, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <span className="h-1 w-1 bg-slate-400 rounded-full" /> {plt}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300">📞 Números de Contacto</span>
                    <ul className="space-y-1 text-xs text-slate-400">
                      {selectedIntel.entities?.phoneNumbers?.length === 0 ? (
                        <li className="italic text-slate-500">Ninguno detectado</li>
                      ) : (
                        selectedIntel.entities?.phoneNumbers?.map((ph, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <span className="h-1 w-1 bg-emerald-400 rounded-full" /> {ph}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                {/* Locations GEOINT */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300">📍 GEOINT: Coordenadas y Ubicaciones</span>
                  <div className="space-y-2">
                    {selectedIntel.entities?.locations?.length === 0 ? (
                      <p className="text-xs italic text-slate-500">Ninguna ubicación geolocalizada</p>
                    ) : (
                      selectedIntel.entities?.locations?.map((loc, i) => (
                        <div key={i} className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80 text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <strong className="text-slate-200">{loc.name}</strong>
                            {loc.lat && loc.lng ? (
                              <span className="text-[10px] text-sky-400 font-bold bg-sky-950/30 px-2 py-0.5 rounded border border-sky-900/30">
                                Lat: {loc.lat.toFixed(4)}, Lng: {loc.lng.toFixed(4)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">No geoposicionado</span>
                            )}
                          </div>
                          {loc.description && <p className="text-slate-400 text-[11px] font-medium leading-relaxed">{loc.description}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Correlation & Handoff */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interconexiones y Correlación</h4>
                <div className="space-y-2">
                  {selectedIntel.correlationSuggestions?.length === 0 ? (
                    <p className="text-xs italic text-slate-500">No hay correlaciones sugeridas</p>
                  ) : (
                    selectedIntel.correlationSuggestions?.map((corr, i) => (
                      <div key={i} className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80 text-xs space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-950/30 text-indigo-400 border border-indigo-900/30 font-bold uppercase text-[9px] px-1.5 py-0.5 rounded">
                            {corr.targetType}
                          </span>
                          <strong className="text-slate-200">{corr.targetName}</strong>
                        </div>
                        <p className="text-slate-400 text-[11px] font-medium leading-relaxed">{corr.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* OCR Text Extracted */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Texto Crudo Extraído (OCR/Audio)</h4>
                <details className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 cursor-pointer">
                  <summary className="text-xs font-bold text-slate-400 hover:text-slate-200 outline-none">Ver contenido crudo del archivo</summary>
                  <pre className="mt-3 text-[10px] text-slate-400 font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto cursor-text bg-slate-950 p-3 rounded-lg leading-relaxed select-all">
                    {selectedIntel.extractedText || "No hay texto crudo extraído."}
                  </pre>
                </details>
              </div>
            </article>
          ) : (
            <div className="bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2 h-[450px] flex flex-col justify-center items-center">
              <span className="text-4xl">📄</span>
              <p className="text-sm font-semibold">Visor de Inteligencia Táctica</p>
              <p className="text-xs max-w-xs leading-relaxed">Selecciona cualquier archivo de la lista de la izquierda para desplegar el diagnóstico detallado de la IA, geoposicionamiento y correlaciones analíticas.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
