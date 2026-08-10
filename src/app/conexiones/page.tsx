"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getFirebaseApp, getAuthInstance } from "@/lib/firebase";

function classifyProvider(id: string): string[] {
  const categories: string[] = [];
  const lower = id.toLowerCase();

  // Satellite
  if (lower.includes("nasa") || lower.includes("copernicus")) {
    categories.push("satelital");
  }
  // Hydrological
  if (lower.includes("conagua") || lower.includes("hydro")) {
    categories.push("hidrologico");
  }
  // Meteorological
  if (lower.includes("tomorrow") || lower.includes("noaa") || lower.includes("conagua")) {
    categories.push("meteorologico");
  }
  // Cartographical / Geographical
  if (lower.includes("google") || lower.includes("wms") || lower.includes("inegi")) {
    categories.push("cartografico");
  }
  // Demographic / Economic
  if (lower === "inegi" || lower === "inegi_wms") {
    categories.push("demografico");
    categories.push("economico");
  }
  // Infrastructure
  if (lower.includes("google") || lower.includes("usgs") || lower.includes("inegi_wms")) {
    categories.push("infraestructura");
  }
  // Criminal / Civil Protection
  if (lower.includes("cenapred") || lower === "inegi") {
    categories.push("criminal");
  }
  // OSINT & Social Networks
  if (["telegram", "x", "facebook", "instagram", "reddit"].includes(lower)) {
    categories.push("osint");
    categories.push("redes_sociales");
  }
  // Institutional
  if (["inegi", "inegi_wms", "conagua", "cenapred", "noaa", "copernicus", "nasa", "usgs"].includes(lower)) {
    categories.push("institucional");
  }

  if (categories.length === 0) {
    categories.push("cartografico");
  }
  return categories;
}

type Status = "pending" | "ok" | "error";

type SensorKey =
  | "online"
  | "geolocation"
  | "camera"
  | "microphone"
  | "firebase"
  | "maps"
  | "gemini";

type SensorState = Record<SensorKey, Status>;

const initialSensorState: SensorState = {
  online: "pending",
  geolocation: "pending",
  camera: "pending",
  microphone: "pending",
  firebase: "pending",
  maps: "pending",
  gemini: "pending",
};

interface WmsCatalogEntry {
  id: string;
  name: string;
  version: string;
  status: string;
  featureFlag: string;
  authType: string;
  geographicCoverage: string;
  outputFormat: string;
  // UI states
  testStatus?: "idle" | "testing" | "ok" | "error";
  testLatency?: number;
  testRecords?: number;
  testError?: string;
  category?: string;
}

export default function ConexionesPage() {
  // Hardware & basic network sensors
  const [sensors, setSensors] = useState<SensorState>(initialSensorState);
  const [sensorMessages, setSensorMessages] = useState<Record<SensorKey, string>>({
    online: "",
    geolocation: "",
    camera: "",
    microphone: "",
    firebase: "",
    maps: "",
    gemini: "",
  });

  // Dynamic WMS/OSINT provider catalog
  const [providers, setProviders] = useState<WmsCatalogEntry[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // MSCE engine state
  const [activeModule, setActiveModule] = useState<"pandillas" | "inundaciones" | "perfil">("inundaciones");
  const [msceReport, setMsceReport] = useState<any>(null);
  const [isMsceLoading, setIsMsceLoading] = useState(false);

  // Fetch providers catalog
  const loadCatalog = async () => {
    setIsLoadingCatalog(true);
    try {
      const res = await fetch("/api/providers/catalog");
      if (res.ok) {
        const json = await res.json();
        const list = (json.catalog || []).map((p: any) => ({
          ...p,
          testStatus: "idle" as const,
        }));
        setProviders(list);
      }
    } catch (e) {
      console.error("Error loading provider catalog:", e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  // Fetch MSCE Correlation Report
  const loadMsce = async (mod: "pandillas" | "inundaciones" | "perfil") => {
    setIsMsceLoading(true);
    try {
      const res = await fetch(`/api/geoint/correlation?module=${mod}`);
      if (res.ok) {
        const json = await res.json();
        setMsceReport(json);
      }
    } catch (e) {
      console.error("Error loading MSCE report:", e);
    } finally {
      setIsMsceLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadMsce(activeModule);
  }, []);

  useEffect(() => {
    loadMsce(activeModule);
  }, [activeModule]);

  // Test individual provider connection
  const handleTestConnection = async (id: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, testStatus: "testing" } : p))
    );

    try {
      const res = await fetch(`/api/providers/test?provider=${id}`);
      const json = await res.json();
      const testResult = json.results?.[0];

      setProviders((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            if (res.ok && testResult) {
              return {
                ...p,
                testStatus: "ok",
                testLatency: testResult.latency,
                testRecords: testResult.recordsCount,
                testError: undefined,
              };
            } else {
              const errMsg = testResult?.errors?.[0] || json.message || "Fallo en la conexión.";
              return {
                ...p,
                testStatus: "error",
                testLatency: testResult?.latency || 0,
                testRecords: 0,
                testError: errMsg,
              };
            }
          }
          return p;
        })
      );

      // Reload MSCE to reflect availability updates
      loadMsce(activeModule);
    } catch (err: any) {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                testStatus: "error",
                testLatency: 0,
                testRecords: 0,
                testError: err.message || String(err),
              }
            : p
        )
      );
    }
  };

  // Hardware/Browser sensors verification
  useEffect(() => {
    const updateSensor = (key: SensorKey, status: Status, msg?: string) => {
      setSensors((prev) => ({ ...prev, [key]: status }));
      if (msg) {
        setSensorMessages((prev) => ({ ...prev, [key]: msg }));
      }
    };

    // Internet Status
    try {
      const online = typeof navigator !== "undefined" ? navigator.onLine : false;
      updateSensor(
        "online",
        online ? "ok" : "error",
        online ? "Conectado a la red de banda ancha." : "Sin conexión a Internet."
      );
    } catch {
      updateSensor("online", "error", "No se pudo determinar el estado de red.");
    }

    const checkPermission = async (name: PermissionName, key: SensorKey) => {
      if (typeof navigator === "undefined") {
        updateSensor(key, "error", "Navegador no disponible.");
        return;
      }
      if (!("permissions" in navigator)) {
        updateSensor(
          key,
          "pending",
          "Permisos no expuestos en este navegador. Utilice el botón Autorizar."
        );
        return;
      }
      try {
        const status = await (navigator.permissions as any).query({ name });
        const state = status.state as PermissionState;
        if (state === "granted") {
          updateSensor(key, "ok", "Permiso concedido.");
        } else if (state === "prompt") {
          updateSensor(
            key,
            "pending",
            "Permiso pendiente. Solicite autorización."
          );
        } else {
          updateSensor(
            key,
            "error",
            "Permiso denegado. Conceda acceso en los ajustes del sitio."
          );
        }
      } catch (e) {
        updateSensor(
          key,
          "pending",
          "No se pudo leer el permiso. Use el botón Autorizar."
        );
      }
    };

    // GPS & Hardware media
    void checkPermission("geolocation" as PermissionName, "geolocation");
    void checkPermission("camera" as PermissionName, "camera");
    void checkPermission("microphone" as PermissionName, "microphone");

    // Firebase Connection
    try {
      const app = getFirebaseApp();
      const auth = getAuthInstance();
      const user = auth.currentUser;
      if (app) {
        updateSensor(
          "firebase",
          "ok",
          user
            ? `Firebase inicializado. Cuenta activa: ${user.email || user.uid}.`
            : "Firebase conectado. Sin sesión activa."
        );
      } else {
        updateSensor("firebase", "error", "No se pudo inicializar Firebase.");
      }
    } catch (e) {
      updateSensor("firebase", "error", "Error de conexión de Firebase.");
    }

    // Google Maps API Key
    try {
      const mapsKey =
        typeof process !== "undefined"
          ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
            process.env.GOOGLE_MAPS_API_KEY
          : undefined;
      updateSensor(
        "maps",
        mapsKey && mapsKey.trim().length > 0 ? "ok" : "error",
        mapsKey
          ? "Clave NEXT_PUBLIC_GOOGLE_MAPS_API_KEY cargada en el entorno."
          : "Falta la clave NEXT_PUBLIC_GOOGLE_MAPS_API_KEY."
      );
    } catch {
      updateSensor("maps", "error", "Fallo al verificar clave de Maps.");
    }

    // Gemini API Key
    try {
      const geminiKey =
        typeof process !== "undefined"
          ? process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY
          : undefined;
      updateSensor(
        "gemini",
        geminiKey && geminiKey.toString().trim().length > 0 ? "ok" : "error",
        geminiKey
          ? "Clave de Gemini API detectada y lista."
          : "No se detecta GEMINI_API_KEY en el entorno."
      );
    } catch {
      updateSensor("gemini", "error", "Fallo al verificar clave de Gemini.");
    }
  }, []);

  const authorizeCamera = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      alert("Navegador no soporta acceso directo a la cámara.");
      return;
    }
    try {
      setSensors((prev) => ({ ...prev, camera: "pending" }));
      await navigator.mediaDevices.getUserMedia({ video: true });
      setSensors((prev) => ({ ...prev, camera: "ok" }));
      setSensorMessages((prev) => ({ ...prev, camera: "Acceso de cámara autorizado." }));
    } catch {
      setSensors((prev) => ({ ...prev, camera: "error" }));
      alert("Permiso de cámara bloqueado por el sistema.");
    }
  };

  const authorizeMicrophone = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      alert("Navegador no soporta acceso directo al micrófono.");
      return;
    }
    try {
      setSensors((prev) => ({ ...prev, microphone: "pending" }));
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setSensors((prev) => ({ ...prev, microphone: "ok" }));
      setSensorMessages((prev) => ({ ...prev, microphone: "Acceso de micrófono autorizado." }));
    } catch {
      setSensors((prev) => ({ ...prev, microphone: "error" }));
      alert("Permiso de micrófono bloqueado por el sistema.");
    }
  };

  const authorizeGeolocation = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      alert("Geolocalización no disponible.");
      return;
    }
    try {
      setSensors((prev) => ({ ...prev, geolocation: "pending" }));
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 6000,
        });
      });
      setSensors((prev) => ({ ...prev, geolocation: "ok" }));
      setSensorMessages((prev) => ({ ...prev, geolocation: "Ubicación GPS autorizada." }));
    } catch {
      setSensors((prev) => ({ ...prev, geolocation: "error" }));
      alert("Permiso de ubicación GPS denegado.");
    }
  };

  const statusBadge = (status: Status) => {
    const base = "inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full border";
    if (status === "ok") {
      return <span className={`${base} border-emerald-500/40 bg-emerald-950/40 text-emerald-400`}>● Activo</span>;
    }
    if (status === "error") {
      return <span className={`${base} border-rose-500/40 bg-rose-950/40 text-rose-400`}>● Error</span>;
    }
    return <span className={`${base} border-amber-500/40 bg-amber-950/40 text-amber-400`}>● Comprobando</span>;
  };

  // Determine provider category color
  const getCategoryColor = (cat: string) => {
    if (cat === "hidrologico") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    if (cat === "satelital") return "bg-teal-500/20 text-teal-300 border-teal-500/30";
    if (cat === "meteorologico") return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    if (cat === "cartografico") return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    if (cat === "osint" || cat === "redes_sociales") return "bg-orange-500/20 text-orange-300 border-orange-500/30";
    return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
        
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-5">
          <div>
            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1.5">
              <Link href="/" className="hover:text-cyan-300 transition-colors flex items-center gap-1">
                ← Volver al Lobby Principal
              </Link>
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">
              Centro de Conexiones
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Consola unificada para la auditoría de hardware, servicios en la nube y verdad operacional de geointeligencia.
            </p>
          </div>
        </header>

        {/* SECTION 1: MSCE TRUTH SCORE ENGINE */}
        <section className="bg-slate-900/40 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-850 pb-3">
            <div>
              <h2 className="text-sm font-black text-cyan-400 uppercase tracking-wider">🧠 Multi-Source Correlation Engine (MSCE)</h2>
              <p className="text-[10px] text-slate-500">Evaluación algorítmica de la verdad operacional para la toma de decisiones geoespaciales</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Módulo Operacional:</span>
              <select
                value={activeModule}
                onChange={(e) => setActiveModule(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-bold text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="inundaciones">Inundaciones (Hidro/Meteo)</option>
                <option value="pandillas">Pandillas (Seguridad/Redes)</option>
                <option value="perfil">Perfilador (General)</option>
              </select>
            </div>
          </div>

          {isMsceLoading ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-500">
              Correlacionando fuentes operacionales...
            </div>
          ) : msceReport ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* DOMINANT SOURCE CARD */}
              <div className="lg:col-span-1 bg-gradient-to-br from-cyan-950/20 to-slate-950 border border-cyan-500/20 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded text-[9px] font-bold uppercase tracking-wider">
                    Fuente Dominante del Módulo
                  </span>
                  <h3 className="text-lg font-black text-white mt-2 uppercase tracking-wide">
                    {msceReport.dominantProvider?.toUpperCase()}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {msceReport.dominantReason}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-black">Truth Score</span>
                  <span className="text-2xl font-black text-cyan-400 font-mono">
                    {msceReport.dominantScore}%
                  </span>
                </div>
              </div>

              {/* DETAILED ENGINE MATRIX */}
              <div className="lg:col-span-2 space-y-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Matriz de Ponderación de Verdad Operacional</p>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {msceReport.results?.map((res: any) => (
                    <div key={res.providerId} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-950/40 border border-slate-900 rounded-lg hover:border-slate-800 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          res.decision === "use" ? "bg-emerald-500" :
                          res.decision === "merge" ? "bg-sky-500" :
                          res.decision === "degrade" ? "bg-amber-500" : "bg-slate-700"
                        }`} />
                        <div>
                          <p className="text-xs font-bold text-slate-200">{res.name}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{res.explanation}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                          res.decision === "use" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" :
                          res.decision === "merge" ? "border-sky-500/30 text-sky-400 bg-sky-500/5" :
                          res.decision === "degrade" ? "border-amber-500/30 text-amber-400 bg-amber-500/5" : "border-slate-800 text-slate-500 bg-slate-900/40"
                        }`}>
                          {res.decision}
                        </span>
                        <span className="text-xs font-black text-slate-300 font-mono w-10 text-right">
                          {res.truthScore}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-28 flex items-center justify-center text-xs text-slate-500">
              Error al consultar el MSCE. Verifique conectividad.
            </div>
          )}
        </section>

        {/* SECTION 2: GRID OF LOCAL SENSORS & DYNAMIC REGISTRY */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SENSORS COL (1/3 cols) */}
          <div className="lg:col-span-1 bg-slate-900/40 border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-wider">🔌 Hardware y Servicios Base</h2>
              <p className="text-[10px] text-slate-500">Diagnóstico de recursos locales y llaves del entorno</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-200">Internet / Enlace</p>
                  <p className="text-[10px] text-slate-400 leading-normal">{sensorMessages.online}</p>
                </div>
                {statusBadge(sensors.online)}
              </div>

              <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-200">Ubicación GPS</p>
                  <p className="text-[10px] text-slate-400 leading-normal">{sensorMessages.geolocation}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {statusBadge(sensors.geolocation)}
                  <button
                    type="button"
                    onClick={authorizeGeolocation}
                    className="px-2 py-0.5 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 rounded text-[9px] font-bold uppercase tracking-wider text-slate-400 transition-colors"
                  >
                    Autorizar
                  </button>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-200">Cámara Multimedia</p>
                  <p className="text-[10px] text-slate-400 leading-normal">{sensorMessages.camera}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {statusBadge(sensors.camera)}
                  <button
                    type="button"
                    onClick={authorizeCamera}
                    className="px-2 py-0.5 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 rounded text-[9px] font-bold uppercase tracking-wider text-slate-400 transition-colors"
                  >
                    Autorizar
                  </button>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-200">Micrófono</p>
                  <p className="text-[10px] text-slate-400 leading-normal">{sensorMessages.microphone}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {statusBadge(sensors.microphone)}
                  <button
                    type="button"
                    onClick={authorizeMicrophone}
                    className="px-2 py-0.5 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 rounded text-[9px] font-bold uppercase tracking-wider text-slate-400 transition-colors"
                  >
                    Autorizar
                  </button>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-200">Google Maps SDK</p>
                  <p className="text-[10px] text-slate-400 leading-normal">{sensorMessages.maps}</p>
                </div>
                {statusBadge(sensors.maps)}
              </div>

              <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-200">Firebase Core</p>
                  <p className="text-[10px] text-slate-400 leading-normal">{sensorMessages.firebase}</p>
                </div>
                {statusBadge(sensors.firebase)}
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-200">Gemini LLM Engine</p>
                  <p className="text-[10px] text-slate-400 leading-normal">{sensorMessages.gemini}</p>
                </div>
                {statusBadge(sensors.gemini)}
              </div>
            </div>
          </div>

          {/* DYNAMIC REGISTRY DOCK (2/3 cols) */}
          <div className="lg:col-span-2 bg-slate-900/40 border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-wider">📦 Integraciones y Proveedores Geoespaciales</h2>
              <p className="text-[10px] text-slate-500">Catálogo dinámico autodetectado desde ApiOrchestrator Registry</p>
            </div>

            {isLoadingCatalog ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                Auditando registro de proveedores...
              </div>
            ) : providers.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                Ningún proveedor registrado en ApiOrchestrator.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                      <th className="py-2.5">Proveedor</th>
                      <th className="py-2.5">Autenticación</th>
                      <th className="py-2.5">Geografía</th>
                      <th className="py-2.5">Latencia</th>
                      <th className="py-2.5 text-right">Prueba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((p) => {
                      const categories = classifyProvider(p.id);
                      return (
                        <tr key={p.id} className="border-b border-slate-900/60 hover:bg-slate-900/10 transition-colors">
                          <td className="py-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-200">{p.name}</span>
                                <span className="text-[9px] font-mono text-slate-500 font-normal">v{p.version}</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {categories.map(cat => (
                                  <span key={cat} className={`px-1.5 py-0.5 border rounded-[3px] text-[8px] font-black uppercase ${getCategoryColor(cat)}`}>
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-slate-400 font-mono text-[10px]">
                            {p.authType}
                          </td>
                          <td className="py-3 text-slate-400">
                            {p.geographicCoverage}
                          </td>
                          <td className="py-3">
                            {p.testStatus === "ok" && (
                              <div className="space-y-0.5">
                                <span className="text-emerald-400 font-bold font-mono">{p.testLatency}ms</span>
                                <p className="text-[9px] text-slate-500">{p.testRecords} reg. obtenidos</p>
                              </div>
                            )}
                            {p.testStatus === "error" && (
                              <div className="space-y-0.5">
                                <span className="text-rose-400 font-black uppercase text-[10px]">⚠️ Error</span>
                                <p className="text-[8px] text-rose-500 max-w-[120px] truncate" title={p.testError}>
                                  {p.testError}
                                </p>
                              </div>
                            )}
                            {p.testStatus === "testing" && (
                              <span className="text-sky-400 animate-pulse font-bold text-[10px] uppercase">Probando...</span>
                            )}
                            {p.testStatus === "idle" && (
                              <span className="text-slate-500 italic">No probado</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleTestConnection(p.id)}
                              disabled={p.testStatus === "testing"}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 rounded text-[9.5px] font-bold text-slate-300 uppercase tracking-wide disabled:opacity-40 transition-all"
                            >
                              Probar Conexión
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </section>

      </div>
    </main>
  );
}
