"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { 
  getAuthorizedSources, 
  getDiscoveredSources, 
  updateSource, 
  authorizeSource, 
  deleteSource, 
  ImfoSource 
} from "../../../utils/imfoService";

export default function ImfoAdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"authorized" | "discovered" | "register">("authorized");
  const [authorizedList, setAuthorizedList] = useState<ImfoSource[]>([]);
  const [discoveredList, setDiscoveredList] = useState<ImfoSource[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    platform: "Telegram",
    type: "Bot",
    coverage: "Local",
    state: "Aguascalientes",
    municipality: "Aguascalientes",
    neighborhood: "",
    zone: "",
    category: "Seguridad",
    trustworthiness: "Alta" as const,
    priority: 3,
    updateFrequency: "Diario",
    observations: ""
  });

  const loadData = async () => {
    try {
      const authList = await getAuthorizedSources();
      setAuthorizedList(authList);
      const discList = await getDiscoveredSources();
      setDiscoveredList(discList);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN")) {
      loadData();
    }
  }, [user]);

  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
    return (
      <div className="card p-6 text-center space-y-3 mt-8 max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-xl">
        <p className="text-sm text-red-400 font-semibold">
          Acceso restringido. Se requieren permisos de ADMINISTRADOR o SUPER_ADMIN.
        </p>
        <Link
          href="/"
          className="inline-block text-xs text-sky-400 hover:text-sky-300"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  const handleAuthorize = async (id: string) => {
    await authorizeSource(id);
    alert("✅ Fuente autorizada con éxito.");
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar esta fuente permanentemente?")) return;
    await deleteSource(id);
    alert("✅ Fuente eliminada con éxito.");
    loadData();
  };

  const handleToggleStatus = async (src: ImfoSource) => {
    const nextStatus = src.operationalStatus === "Activa" ? "Suspendida" : "Activa";
    await updateSource({ ...src, operationalStatus: nextStatus });
    alert(`✅ Fuente cambiada a estado: ${nextStatus}.`);
    loadData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const sourceId = formData.id.trim() || `manual_${formData.platform.toLowerCase()}_${Date.now()}`;
    const newSource: ImfoSource = {
      ...formData,
      id: sourceId,
      discoveryDate: new Date().toISOString().split("T")[0],
      lastValidationDate: new Date().toISOString().split("T")[0],
      operationalStatus: "Activa"
    };

    await updateSource(newSource);
    alert("✅ Nueva fuente registrada e integrada con éxito.");
    loadData();
    setActiveTab("authorized");
    setFormData({
      id: "",
      name: "",
      platform: "Telegram",
      type: "Bot",
      coverage: "Local",
      state: "Aguascalientes",
      municipality: "Aguascalientes",
      neighborhood: "",
      zone: "",
      category: "Seguridad",
      trustworthiness: "Alta",
      priority: 3,
      updateFrequency: "Diario",
      observations: ""
    });
  };

  return (
    <div className="w-full p-4 md:p-6 flex flex-col gap-6 bg-slate-950/20 border border-slate-900 rounded-3xl min-h-screen">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/admin" className="text-xs text-slate-500 hover:text-slate-400 mb-1 inline-block">
            ← Volver a Panel de Administración
          </Link>
          <h1 className="text-2xl font-black text-white tracking-wide">
            Inventario Maestro de Fuentes de Inteligencia <span className="text-cyan-400">(IMFO)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gobernanza, control y auditoría de canales y fuentes de recolección OSINT activas.
          </p>
        </div>
      </header>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-800 gap-4 pb-2">
        <button
          onClick={() => setActiveTab("authorized")}
          className={`text-sm font-bold pb-2 transition-all border-b-2 ${
            activeTab === "authorized" ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          📂 Fuentes Autorizadas ({authorizedList.length})
        </button>
        <button
          onClick={() => setActiveTab("discovered")}
          className={`text-sm font-bold pb-2 transition-all border-b-2 relative ${
            activeTab === "discovered" ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          📩 Descubrimientos Pendientes ({discoveredList.length})
          {discoveredList.length > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white rounded-full text-[8px] font-black h-4 w-4 flex items-center justify-center animate-pulse">
              {discoveredList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("register")}
          className={`text-sm font-bold pb-2 transition-all border-b-2 ${
            activeTab === "register" ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          ➕ Registrar Nueva Fuente
        </button>
      </div>

      {/* Content */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* TAB 1: Authorized sources table */}
        {activeTab === "authorized" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-800">
              <thead>
                <tr className="text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Nombre / Plataforma</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Cobertura</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Confiabilidad</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {authorizedList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">No hay fuentes registradas.</td>
                  </tr>
                ) : (
                  authorizedList.map((src) => (
                    <tr key={src.id} className="hover:bg-slate-800/20">
                      <td className="py-4 px-4 font-bold text-white">
                        <div>{src.name}</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">{src.platform}</div>
                      </td>
                      <td className="py-4 px-4">{src.type}</td>
                      <td className="py-4 px-4">{src.coverage}</td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-semibold">
                          {src.category}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          src.trustworthiness === "Alta" ? "text-emerald-400 bg-emerald-950/40" : src.trustworthiness === "Media" ? "text-amber-400 bg-amber-950/40" : "text-red-400 bg-red-950/40"
                        }`}>
                          {src.trustworthiness}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          src.operationalStatus === "Activa" ? "text-emerald-400" : "text-amber-400"
                        }`}>
                          {src.operationalStatus}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleToggleStatus(src)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition"
                        >
                          {src.operationalStatus === "Activa" ? "Suspender" : "Activar"}
                        </button>
                        <button
                          onClick={() => handleDelete(src.id)}
                          className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900/60 border border-red-800/40 text-[10px] font-bold rounded-lg text-red-400 transition"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: Discovered pending sources */}
        {activeTab === "discovered" && (
          <div className="space-y-4">
            {discoveredList.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">No hay nuevas fuentes descubiertas pendientes de autorización.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discoveredList.map((src) => (
                  <div key={src.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-3 animate-fadeIn">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800/40 rounded text-[9px] font-black uppercase tracking-wider">Pendiente Autorización</span>
                        <span className="text-[10px] text-slate-500 font-mono">{src.platform} • {src.type}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-3">{src.name}</h3>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{src.observations}</p>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-slate-800/80 pt-3 mt-1">
                      <button
                        onClick={() => handleDelete(src.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg transition"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={() => handleAuthorize(src.id)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-[10px] font-bold text-white rounded-lg transition"
                      >
                        Autorizar Integración
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Register Form */}
        {activeTab === "register" && (
          <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Metadatos de la Nueva Fuente</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ID Único (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ej. tg_canaldatos_ags"
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre Descriptivo (Obligatorio):</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cuentas SSP Noticias"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Plataforma:</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="Telegram">Telegram</option>
                  <option value="X">X (Twitter)</option>
                  <option value="Reddit">Reddit</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="YouTube">YouTube</option>
                  <option value="RSS">RSS</option>
                  <option value="Google Drive">Google Drive</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo:</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="Bot">Bot</option>
                  <option value="Canal">Canal</option>
                  <option value="Grupo">Grupo</option>
                  <option value="Cuenta">Cuenta</option>
                  <option value="Hashtag">Hashtag</option>
                  <option value="Feed RSS">Feed RSS</option>
                  <option value="API">API</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Categoría:</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="Seguridad">Seguridad</option>
                  <option value="Prensa">Prensa</option>
                  <option value="Narcotráfico">Narcotráfico</option>
                  <option value="Accidentes">Accidentes</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Colonia / Zona:</label>
                <input
                  type="text"
                  placeholder="Ej. Villas de Nuestra Señora..."
                  value={formData.neighborhood}
                  onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nivel Confiabilidad:</label>
                <select
                  value={formData.trustworthiness}
                  onChange={(e) => setFormData(prev => ({ ...prev, trustworthiness: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observaciones / Enlace de Acceso:</label>
              <textarea
                placeholder="Indique detalles sobre la cobertura o url de suscripción..."
                value={formData.observations}
                onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 outline-none focus:border-cyan-500 min-h-[80px]"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
              >
                Autorizar y Guardar Nueva Fuente
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
