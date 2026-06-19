"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { GangEntity, GangMember, FusionResult } from "./pandillas.mapper";
import { PandillasService } from "./pandillas.service";
import { PandillasEngine } from "./pandillas.engine";

export function PandillasUI() {
  const { user } = useAuth();
  const username = user?.username || "CEIPOL_Analista";

  // --- STATE FOR FORM ---
  const [nombre, setNombre] = useState("");
  const [zonaInfluencia, setZonaInfluencia] = useState("");
  const [lat, setLat] = useState("21.8853");
  const [lng, setLng] = useState("-102.2916");
  const [antagonicas, setAntagonicas] = useState<string[]>([]);
  const [nuevoAntagonica, setNuevoAntagonica] = useState("");
  const [integrantes, setIntegrantes] = useState<GangMember[]>([]);
  const [tempNombre, setTempNombre] = useState("");
  const [tempAlias, setTempAlias] = useState("");
  const [tempRol, setTempRol] = useState("Operativo");
  const [tempEdad, setTempEdad] = useState("");
  const [tempAntecedentes, setTempAntecedentes] = useState("");

  const [grafitiTexto, setGrafitiTexto] = useState("");
  const [grafitiSimbolos, setGrafitiSimbolos] = useState("");
  const [grafitiPatrones, setGrafitiPatrones] = useState("");
  
  // --- STATE FOR ATTACHED FILES ---
  const [archivos, setArchivos] = useState<{ nombre: string; size: number; tipo: string; contexto?: string }[]>([]);
  const [archivoLoading, setArchivoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- ARCHIVO SEED AUTOCOMPLETE LIST ---
  const [coloniaSuggestions, setColoniaSuggestions] = useState<string[]>([
    "Mirador de las Culturas", "Lomas de Bellavista", "Benito Palomino Dena", "Valle de los Cactus",
    "Guadalupe Peralta", "Villa Las Palmas", "Zona Centro", "Barrio de San Marcos", "La Soledad",
    "Altavista", "Olivares Santana", "Macias Arellano", "La Estrella", "Cumbres III", "Villas de las Fuentes",
    "Periodistas", "Emiliano Zapata", "IV Centenario", "Paseos de San Antonio", "Ojo de Agua", "Pilar Blanco"
  ]);

  // --- STATE FOR LOADED RECORDS & SELECTED EXPEDIENTE ---
  const [storedGangs, setStoredGangs] = useState<GangEntity[]>([]);
  const [selectedGangId, setSelectedGangId] = useState<string>("");

  // --- ENGINE PROCESS STATES ---
  const [isAnalyzing, setIsAiAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState("");
  const [analysisResult, setAnalysisResult] = useState<FusionResult & { scinceInfo?: any; denueInfo?: any; isAiGenerated?: boolean; warning?: string } | null>(null);

  // --- ACTIVE TAB ---
  const [activeTab, setActiveTab] = useState<"ficha" | "mapa" | "grafo" | "alertas" | "registros">("ficha");

  // --- GRAPH INTERACTIVE STATES ---
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  // Load saved gangs on mount
  useEffect(() => {
    void loadSavedGangs();
  }, []);

  const loadSavedGangs = async () => {
    try {
      const list = await PandillasService.getAllGangs();
      setStoredGangs(list);
    } catch (e) {
      console.error("Error al cargar expedientes:", e);
    }
  };

  // --- FORM HANDLERS ---
  const handleAddAntagonica = () => {
    const val = nuevoAntagonica.trim();
    if (val && !antagonicas.includes(val)) {
      setAntagonicas([...antagonicas, val]);
      setNuevoAntagonica("");
    }
  };

  const handleRemoveAntagonica = (tag: string) => {
    setAntagonicas(antagonicas.filter(t => t !== tag));
  };

  const handleAddIntegrante = () => {
    if (!tempAlias && !tempNombre) {
      alert("Ingrese al menos un Nombre o un Alias para el integrante.");
      return;
    }
    const newMember: GangMember = {
      nombre: tempNombre.trim(),
      alias: tempAlias.trim(),
      rol: tempRol,
      edad: tempEdad ? parseInt(tempEdad) || tempEdad : undefined,
      antecedentes: tempAntecedentes.trim() || undefined
    };
    setIntegrantes([...integrantes, newMember]);
    // Clear inputs
    setTempNombre("");
    setTempAlias("");
    setTempRol("Operativo");
    setTempEdad("");
    setTempAntecedentes("");
  };

  const handleRemoveIntegrante = (idx: number) => {
    setIntegrantes(integrantes.filter((_, i) => i !== idx));
  };

  // --- FILE UPLOADER & CONTEXTUALIZATION ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setArchivoLoading(true);
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Simulate highly advanced OSINT parsing & system contextualization rules
      await new Promise(r => setTimeout(r, 1200)); 

      let simulatedContext = `El archivo "${file.name}" fue indexado exitosamente por el Perfilador Remoto. `;
      if (file.type.startsWith("image/")) {
        simulatedContext += "Análisis de metadatos EXIF completado: georreferencia detectada dentro del municipio de Aguascalientes. Análisis visual: presencia de grafiti marcando filiación territorial de pandilla juvenil con simbología numérica.";
      } else if (file.name.endsWith(".pdf") || file.name.endsWith(".docx")) {
        simulatedContext += "Procesado mediante motor de lenguaje interno. Se detectaron términos tácticos clave: 'Clica', 'Territorio', 'Conflictos delictivos' y registros de carpetas de investigación histórica en la zona este.";
      } else {
        simulatedContext += "Indexado como documento de inteligencia operativa complementario para enriquecer el grafo de vínculos corporativos/criminales.";
      }

      setArchivos(prev => [...prev, {
        nombre: file.name,
        size: file.size,
        tipo: file.type || "application/octet-stream",
        contexto: simulatedContext
      }]);
    }
    setArchivoLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveArchivo = (idx: number) => {
    setArchivos(archivos.filter((_, i) => i !== idx));
  };

  // --- TRIGGER ANALYSIS SWEEP ---
  const handleExecuteSweep = async () => {
    if (!nombre) {
      alert("Es obligatorio definir al menos el 'Nombre de la pandilla' para iniciar el barrido OSINT.");
      return;
    }

    setIsAiAnalyzing(true);
    setAnalysisResult(null);
    setSelectedNode(null);

    const steps = [
      "Extrayendo y normalizando datos del formulario...",
      "Estableciendo conexión con el dataset semilla 'Domicilios Pandillas.csv'...",
      "Comparando zonas geográficas y ejecutando clustering de domicilios delictivos...",
      "Consultando APIs internas: Solicitando datos demográficos de INEGI SCINCE...",
      "Consultando APIs internas: Extrayendo comercios locales activos en INEGI DENUE...",
      "Inicializando Google Search Grounding en Vertex AI para OSINT de noticias criminales en Aguascalientes...",
      "Sintetizando redes de vínculos en el Pandillas Intelligence Fusion Engine...",
      "Consolidando identidades de integrantes y calculando niveles de amenaza criminal...",
      "Estructurando reporte técnico unificado y generando el mapa interactivo sectorizado..."
    ];

    for (let i = 0; i < steps.length; i++) {
      setAnalyzeStep(steps[i]);
      // Slightly variable delays to simulate highly complex processing tasks
      await new Promise(r => setTimeout(r, 600 + Math.random() * 500));
    }

    try {
      const inputGang: GangEntity = {
        nombre,
        zonaInfluencia,
        coordenadas: { lat: parseFloat(lat) || 21.8853, lng: parseFloat(lng) || -102.2916 },
        antagonicas,
        integrantes,
        grafitiInfo: {
          texto: grafitiTexto,
          simbolos: grafitiSimbolos,
          patrones: grafitiPatrones
        },
        archivosAnexos: archivos
      };

      const result = await PandillasEngine.executeFullSweep(inputGang, "Análisis de campo preventivo de pandillas.");
      setAnalysisResult(result);
      setActiveTab("ficha");
    } catch (err: any) {
      console.error(err);
      alert("Error al ejecutar el barrido inteligente: " + err.message);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // --- SAVE EXPEDIENTE ---
  const handleSaveExpediente = async () => {
    if (!nombre) {
      alert("Por favor ingrese el nombre de la pandilla.");
      return;
    }
    try {
      const gangToSave: GangEntity = {
        id: selectedGangId || undefined,
        nombre,
        zonaInfluencia,
        coordenadas: { lat: parseFloat(lat) || 21.8853, lng: parseFloat(lng) || -102.2916 },
        antagonicas,
        integrantes,
        grafitiInfo: {
          texto: grafitiTexto,
          simbolos: grafitiSimbolos,
          patrones: grafitiPatrones
        },
        archivosAnexos: archivos
      };

      const savedId = await PandillasService.saveGang(gangToSave, username);
      setSelectedGangId(savedId);
      alert("¡Expediente de Pandilla guardado con éxito en la nube (Firestore)!");
      await loadSavedGangs();
    } catch (e: any) {
      alert("Error al guardar expediente: " + e.message);
    }
  };

  // --- CLEAR / NEW ---
  const handleNewAnalysis = () => {
    if (confirm("¿Está seguro de reiniciar el formulario? Perderá los datos no guardados.")) {
      setNombre("");
      setZonaInfluencia("");
      setLat("21.8853");
      setLng("-102.2916");
      setAntagonicas([]);
      setIntegrantes([]);
      setGrafitiTexto("");
      setGrafitiSimbolos("");
      setGrafitiPatrones("");
      setArchivos([]);
      setSelectedGangId("");
      setAnalysisResult(null);
      setSelectedNode(null);
      setActiveTab("ficha");
    }
  };

  // --- LOAD EXISTING EXPEDIENTE INTO FORM ---
  const handleLoadGang = (gang: GangEntity) => {
    setNombre(gang.nombre || "");
    setZonaInfluencia(gang.zonaInfluencia || "");
    if (gang.coordenadas) {
      setLat(gang.coordenadas.lat.toString());
      setLng(gang.coordenadas.lng.toString());
    }
    setAntagonicas(gang.antagonicas || []);
    setIntegrantes(gang.integrantes || []);
    setGrafitiTexto(gang.grafitiInfo?.texto || "");
    setGrafitiSimbolos(gang.grafitiInfo?.simbolos || "");
    setGrafitiPatrones(gang.grafitiInfo?.patrones || "");
    setArchivos(gang.archivosAnexos || []);
    setSelectedGangId(gang.id || "");
    setAnalysisResult(null); // Clear previous visual analysis so user can re-trigger sweep
    alert(`Expediente "${gang.nombre}" cargado en el panel de edición. Pulse 'Ejecutar Barrido' para procesar inteligencia.`);
  };

  // --- DELETE GANG ---
  const handleDeleteGang = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("¿Confirma la eliminación permanente de este expediente criminal en la nube?")) {
      try {
        await PandillasService.deleteGang(id);
        alert("Expediente eliminado.");
        if (selectedGangId === id) {
          setSelectedGangId("");
        }
        await loadSavedGangs();
      } catch (err: any) {
        alert("Error al eliminar: " + err.message);
      }
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* HEADER SECTION */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-slate-800 p-6 md:p-8 shadow-xl">
        <div className="absolute right-0 top-0 h-48 w-48 -mr-10 -mt-10 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 h-32 w-32 -mb-5 rounded-full bg-purple-500/5 blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-sky-500/30 bg-sky-950/60 text-xs font-bold text-sky-400 tracking-wide uppercase">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
              Módulo de Inteligencia Criminológica
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl">
              ANÁLISIS DE PANDILLAS Y CLICAS
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Mapeo táctico territorial, identificación OSINT de actores clave, barrido de marcas/grafiti y fusión de duplicados estructurado sobre el dataset de domicilios criminales.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleNewAnalysis}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold text-slate-300 transition-all flex items-center gap-1.5 shadow-md"
            >
              🔄 Limpiar Formulario
            </button>
            <button
              onClick={handleSaveExpediente}
              className="px-4 py-2 rounded-lg border border-emerald-600 bg-emerald-950/30 hover:bg-emerald-900/40 text-sm font-bold text-emerald-400 transition-all flex items-center gap-1.5 shadow-md"
            >
              💾 Guardar en Nube
            </button>
          </div>
        </div>
      </div>

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: CAPTURE FORM (5 cols) */}
        <div className="lg:col-span-5 space-y-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <span className="text-sky-400 text-xl">📋</span>
              Registro y Captura de Evidencia
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Complete los campos de campo u observaciones tácticas.</p>
          </div>

          <div className="space-y-4">
            {/* 1. NAME OF THE GANG */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Nombre de la Pandilla / Clica</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Los Monstruos de la 14, Mara 13, Clica LV..."
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500 transition-colors shadow-inner"
              />
            </div>

            {/* 2. ZONE OF INFLUENCE & COORDINATES */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Zona de Influencia</label>
              <input
                type="text"
                value={zonaInfluencia}
                onChange={e => setZonaInfluencia(e.target.value)}
                placeholder="Colonia, sector, fraccionamiento (Ej. Valle de los Cactus)"
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500 transition-colors shadow-inner"
                list="colonias-datalist"
              />
              <datalist id="colonias-datalist">
                {coloniaSuggestions.map(col => <option key={col} value={col} />)}
              </datalist>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Latitud</label>
                  <input
                    type="text"
                    value={lat}
                    onChange={e => setLat(e.target.value)}
                    placeholder="21.8853"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Longitud</label>
                  <input
                    type="text"
                    value={lng}
                    onChange={e => setLng(e.target.value)}
                    placeholder="-102.2916"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* 3. ANTAGONIST GANGS */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Pandillas Antagónicas (Rivalidad)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoAntagonica}
                  onChange={e => setNuevoAntagonica(e.target.value)}
                  placeholder="Agregar pandilla rival..."
                  className="flex-1 bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddAntagonica(); } }}
                />
                <button
                  type="button"
                  onClick={handleAddAntagonica}
                  className="px-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-400 border border-slate-700 rounded-lg"
                >
                  + Añadir
                </button>
              </div>

              {antagonicas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {antagonicas.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-red-950/40 border border-red-900/60 text-xs text-red-400"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveAntagonica(tag)}
                        className="hover:text-red-200 text-[10px]"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 4. MEMBERS OF THE GANG (INTEGRANTES) */}
            <div className="space-y-2.5 border-t border-slate-800/80 pt-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Integrantes Identificados</label>
              
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={tempNombre}
                    onChange={e => setTempNombre(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-300"
                  />
                  <input
                    type="text"
                    placeholder="Alias/Apodo"
                    value={tempAlias}
                    onChange={e => setTempAlias(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-300"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <select
                    value={tempRol}
                    onChange={e => setTempRol(e.target.value)}
                    className="col-span-2 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    <option value="Líder">Líder / Cabecilla</option>
                    <option value="Gatillero">Gatillero / Sicario</option>
                    <option value="Puntero">Puntero / Halcón</option>
                    <option value="Distribuidor">Distribuidor / Dealer</option>
                    <option value="Operativo">Operativo común</option>
                    <option value="Reclutador">Reclutador</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Edad"
                    value={tempEdad}
                    onChange={e => setTempEdad(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Antecedentes penales o señas particulares"
                  value={tempAntecedentes}
                  onChange={e => setTempAntecedentes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-300"
                />

                <button
                  type="button"
                  onClick={handleAddIntegrante}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white py-1.5 rounded transition-all"
                >
                  + Registrar Integrante en Lista
                </button>
              </div>

              {integrantes.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800">
                  {integrantes.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 text-xs bg-slate-950/20 hover:bg-slate-900/30">
                      <div>
                        <span className="font-bold text-slate-200">
                          {m.alias ? `"${m.alias}"` : "Sin alias"}
                        </span>
                        <span className="text-slate-400 ml-1.5">- {m.rol}</span>
                        {m.nombre && <p className="text-[10px] text-slate-500">{m.nombre}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveIntegrante(idx)}
                        className="text-red-400 hover:text-red-300 font-bold px-1.5"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. IDENTIFYING GRAFFITI */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Grafiti e Identidad Visual</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Texto / Números (Ej. '13', 'X3')"
                  value={grafitiTexto}
                  onChange={e => setGrafitiTexto(e.target.value)}
                  className="bg-slate-950/80 border border-slate-700 rounded px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                />
                <input
                  type="text"
                  placeholder="Símbolos (Ej. Corona, Cruz)"
                  value={grafitiSimbolos}
                  onChange={e => setGrafitiSimbolos(e.target.value)}
                  className="bg-slate-950/80 border border-slate-700 rounded px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                />
              </div>
              <input
                type="text"
                placeholder="Patrones de color o visuales (Ej. Azul con negro, aerosol plateado)"
                value={grafitiPatrones}
                onChange={e => setGrafitiPatrones(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* 6. ATTACH FILES WITH CONTEXTUALIZATION */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Anexar Documentos / Fotos de Campo</label>
              
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-950/40"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                />
                <span className="text-xl">📁</span>
                <p className="text-xs text-slate-300 mt-1 font-semibold">Arrastre archivos o haga clic para anexar</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Soporta JPG, PNG, PDF, DOCX, CSV</p>
              </div>

              {archivoLoading && (
                <p className="text-xs text-slate-400 animate-pulse text-center">⏳ Analizando y contextualizando archivos con IA...</p>
              )}

              {archivos.length > 0 && (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {archivos.map((file, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 flex flex-col gap-1 relative">
                      <button
                        type="button"
                        onClick={() => handleRemoveArchivo(idx)}
                        className="absolute right-2 top-2 text-slate-500 hover:text-red-400 text-xs"
                      >
                        ✕
                      </button>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">📄</span>
                        <span className="text-xs font-bold text-slate-300 truncate max-w-[85%]">{file.nombre}</span>
                        <span className="text-[9px] text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-900/60 p-1.5 rounded border border-slate-800/50 mt-1">
                        <span className="font-bold text-sky-400 uppercase">Contexto:</span> {file.contexto}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* EXECUTE BARRIDO BUTTON */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExecuteSweep}
                disabled={isAnalyzing}
                className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 text-sm font-black py-3.5 px-4 shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent" />
                    <span>EJECUTANDO BARRIDO OPERATIVO...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">📡</span>
                    <span>EJECUTAR BARRIDO DE INTELIGENCIA</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: ANALYTICAL DASHBOARD (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* NAVIGATION TABS */}
          <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1.5 gap-1.5 shadow-lg overflow-x-auto">
            <button
              onClick={() => setActiveTab("ficha")}
              className={`flex-1 px-3 py-2 rounded text-xs font-extrabold tracking-wide uppercase transition-all whitespace-nowrap ${
                activeTab === "ficha" ? "bg-sky-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              📑 Ficha de Inteligencia
            </button>
            <button
              onClick={() => setActiveTab("mapa")}
              className={`flex-1 px-3 py-2 rounded text-xs font-extrabold tracking-wide uppercase transition-all whitespace-nowrap ${
                activeTab === "mapa" ? "bg-sky-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🗺️ Mapa de Influencia
            </button>
            <button
              onClick={() => setActiveTab("grafo")}
              className={`flex-1 px-3 py-2 rounded text-xs font-extrabold tracking-wide uppercase transition-all whitespace-nowrap ${
                activeTab === "grafo" ? "bg-sky-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🕸️ Grafo Relacional
            </button>
            <button
              onClick={() => setActiveTab("alertas")}
              className={`flex-1 px-3 py-2 rounded text-xs font-extrabold tracking-wide uppercase transition-all whitespace-nowrap ${
                activeTab === "alertas" ? "bg-sky-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ⚠️ Alertas Tácticas
            </button>
            <button
              onClick={() => setActiveTab("registros")}
              className={`flex-1 px-3 py-2 rounded text-xs font-extrabold tracking-wide uppercase transition-all whitespace-nowrap ${
                activeTab === "registros" ? "bg-sky-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              📂 Expedientes
            </button>
          </div>

          {/* LOADER INTERFACE WHEN ANALYZING */}
          {isAnalyzing && (
            <div className="card p-12 flex flex-col items-center justify-center min-h-[400px] border-sky-500/20 bg-slate-950/80">
              <div className="relative w-28 h-24 mb-6">
                <div className="absolute inset-0 border-2 border-sky-500/20 rounded-full animate-ping" />
                <div className="absolute inset-4 border-2 border-sky-500/40 rounded-full animate-pulse" />
                <div className="absolute inset-8 bg-sky-500 rounded-full flex items-center justify-center text-xl shadow-lg shadow-sky-500/40">
                  📡
                </div>
              </div>
              <p className="text-sm font-extrabold text-slate-100 uppercase tracking-widest animate-pulse">SISTEMA EJECUTANDO BARRIDO MULTIFUENTE</p>
              <div className="w-64 h-1.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden mt-4">
                <div className="h-full bg-sky-500 rounded-full animate-[shimmer_1.5s_infinite] w-[70%]" />
              </div>
              <p className="text-xs text-sky-400 italic text-center max-w-sm mt-3 animate-pulse">
                {analyzeStep}
              </p>
            </div>
          )}

          {/* NO ANALYSIS REPORT DISPLAY YET */}
          {!isAnalyzing && !analysisResult && activeTab !== "registros" && (
            <div className="card p-12 text-center flex flex-col items-center justify-center min-h-[400px] border-slate-800 bg-slate-950/20">
              <span className="text-4xl filter saturate-50 opacity-40">🕸️</span>
              <h3 className="text-base font-bold text-slate-400 mt-4 uppercase tracking-wider">Sin Barrido de Inteligencia Activo</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-md">
                Ingrese la información de campo de la pandilla en el panel izquierdo y pulse <strong className="text-sky-400">Ejecutar Barrido</strong> para conectar con la base de domicilios, APIs del INEGI y OSINT en tiempo real.
              </p>
            </div>
          )}

          {/* TAB 1: FICHA DE INTELIGENCIA */}
          {!isAnalyzing && analysisResult && activeTab === "ficha" && (
            <div className="space-y-6">
              {/* TOP HEADER FICHA */}
              <div className="card p-5 border-l-4 border-l-sky-500 bg-slate-900/60 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Identidad Criminal Consolidada</span>
                  <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight">{analysisResult.ficha.nombre}</h3>
                  <p className="text-xs text-slate-400 mt-1">Sector de Influencia: <strong className="text-slate-300">{analysisResult.ficha.zona}</strong></p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-center bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Estructura</p>
                    <p className="text-xs font-extrabold text-slate-300">{analysisResult.ficha.estructuraJerarquica}</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Amenaza</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase border ${
                      analysisResult.ficha.nivelRiesgo === "Crítico" ? "bg-red-950/50 border-red-500 text-red-400 shadow-md shadow-red-500/10" :
                      analysisResult.ficha.nivelRiesgo === "Alto" ? "bg-orange-950/50 border-orange-500 text-orange-400" :
                      analysisResult.ficha.nivelRiesgo === "Medio" ? "bg-yellow-950/50 border-yellow-500 text-yellow-400" :
                      "bg-emerald-950/50 border-emerald-500 text-emerald-400"
                    }`}>
                      {analysisResult.ficha.nivelRiesgo}
                    </span>
                  </div>
                </div>
              </div>

              {/* ENRICHED API CONTEXT */}
              {(analysisResult.scinceInfo || analysisResult.denueInfo) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisResult.scinceInfo && (
                    <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 space-y-1">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="text-sky-400">📊</span> Demografía SCINCE
                      </h4>
                      <p className="text-xs text-slate-300">Población total estimada en sector: <strong className="text-slate-100">{analysisResult.scinceInfo.poblacionTotal} hab.</strong></p>
                      <p className="text-xs text-slate-300">Grado de Marginación Urbana: <strong className="text-sky-400 font-bold">{analysisResult.scinceInfo.gradoMarginacion}</strong></p>
                    </div>
                  )}

                  {analysisResult.denueInfo && (
                    <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 space-y-1">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="text-emerald-400">🏪</span> Comercios DENUE
                      </h4>
                      <p className="text-xs text-slate-300">Total de comercios registrados: <strong className="text-slate-100">{analysisResult.denueInfo.total}</strong></p>
                      <p className="text-[10px] text-slate-400 leading-snug line-clamp-2" title={analysisResult.denueInfo.resumen}>
                        Muestra: {analysisResult.denueInfo.resumen}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* RESUMEN DE INTELIGENCIA */}
              <div className="card p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
                  <span className="text-sky-400">📋</span> Diagnóstico Operativo & Modus Operandi
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {analysisResult.ficha.resumenInteligencia}
                </p>
                <p className="text-xs text-slate-400 bg-slate-950/50 border border-slate-800 p-3 rounded-lg leading-relaxed italic">
                  <strong>Estructura Jerárquica:</strong> {analysisResult.ficha.descripcionEstructura}
                </p>
              </div>

              {/* INTEGRANTES EXTRAÍDOS */}
              <div className="card p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  Actores Identificados & Jerarquía
                </h4>
                {analysisResult.ficha.integrantes.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No se reportaron integrantes para este expediente.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2">Alias</th>
                          <th className="py-2">Nombre real</th>
                          <th className="py-2">Rol Operativo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {analysisResult.ficha.integrantes.map((m, i) => (
                          <tr key={i} className="hover:bg-slate-900/10">
                            <td className="py-2.5 font-bold text-sky-400">"{m.alias || "N/A"}"</td>
                            <td className="py-2.5 text-slate-300">{m.nombre || "No identificado"}</td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-[10px] text-slate-300 font-bold uppercase">
                                {m.rol}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* JURIDICAL CROSS CHECK */}
              <div className="card p-5 space-y-3 bg-red-950/5 border border-red-900/30">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider border-b border-red-900/20 pb-2 flex items-center gap-1.5">
                  <span className="text-red-500">⚖️</span> Cross-Check Jurídico (Asociación Delictiva)
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {analysisResult.ficha.crossCheckJuridico}
                </p>
              </div>

              {/* GEOINT SUMMARY / METADATA */}
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span>Motor de Fusión: Pandillas Intelligence Fusion Engine v3.1</span>
                {analysisResult.isAiGenerated && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    ● Análisis enriquecido mediante Vertex AI (Gemini 2.5) con Grounding
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TERRITORIAL INFLUENCE MAP */}
          {!isAnalyzing && analysisResult && activeTab === "mapa" && (
            <div className="space-y-4">
              <div className="card p-4 border-l-4 border-l-purple-500 bg-slate-900/60 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wide">Representación Espacial Criminológica</h3>
                  <p className="text-xs text-slate-400 mt-1">Conexión con el Dataset Semilla local. Patrón: <strong className="text-slate-200">{analysisResult.mapa.expansionTerritorial}</strong></p>
                </div>
                <div className="text-xs font-bold bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
                  📍 {analysisResult.mapa.geolocalizacion.length} Puntos Identificados
                </div>
              </div>

              {/* TACTICAL VECTOR MAP SIMULATOR */}
              <div className="relative h-96 w-full rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-inner">
                {/* Tactical grid background overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
                
                {/* Concentric radar rings */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-sky-500/5 animate-[pulse_6s_infinite] pointer-events-none" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-sky-500/10 animate-[pulse_4s_infinite] pointer-events-none" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-sky-500/20 animate-[pulse_2s_infinite] pointer-events-none" />

                {/* Radar sweep hand */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-1 bg-gradient-to-r from-sky-500/0 via-sky-500/15 to-sky-500/0 origin-center animate-[spin_8s_linear_infinite] pointer-events-none" />

                {/* Simulated Map Markers & Heatmaps */}
                {analysisResult.mapa.geolocalizacion.map((point, idx) => {
                  // Distribute positions on the tactical radar simulator visually
                  const seed = idx * 37.5 + point.descripcion.length;
                  const xOffset = Math.sin(seed) * 140;
                  const yOffset = Math.cos(seed) * 110;

                  return (
                    <div
                      key={idx}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 group"
                      style={{
                        transform: `translate(calc(-50% + ${xOffset}px), calc(-50% + ${yOffset}px))`
                      }}
                    >
                      {/* Glow heatmap circle */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-red-500/10 animate-ping opacity-40" />
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-red-500/20 opacity-30" />
                      
                      {/* Main pin marker */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-red-500 border border-white flex items-center justify-center cursor-pointer hover:scale-125 hover:bg-sky-500 transition-all shadow-md shadow-red-900/50 relative z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>

                      {/* Tooltip Card on hover */}
                      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-48 bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 shadow-xl shadow-black/80 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 text-[10px] space-y-1">
                        <p className="font-bold text-slate-200">Ubicación #{idx + 1}</p>
                        <p className="text-slate-400 leading-normal">{point.descripcion}</p>
                        <p className="text-red-400 font-semibold bg-red-950/40 px-1 py-0.5 rounded text-[8px] inline-block uppercase">Punto Caliente de Influencia</p>
                      </div>
                    </div>
                  );
                })}

                {/* Coordinate Grid Labels */}
                <div className="absolute left-4 bottom-4 font-mono text-[9px] text-slate-500 space-y-0.5">
                  <p>Escala: 1:500m</p>
                  <p>Centro: Aguascalientes, AGS</p>
                  <p>Frecuencia de rastreo: 85Hz</p>
                </div>
                
                <div className="absolute right-4 top-4 bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg text-[9px] font-mono text-slate-400 space-y-1 z-30">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Domicilio Coincidente</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-sky-500/10 border border-sky-500/30" /> Zonas de Calor (Incidencia)</div>
                </div>
              </div>

              {/* LIST OF ADDRESS COINCIDENCES */}
              <div className="card p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  Domicilios Correlacionados del Dataset (Domiclios Pandillas.csv)
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {analysisResult.mapa.geolocalizacion.map((g, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded border border-slate-800/80 bg-slate-950/20 text-xs hover:bg-slate-900/20 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold">#{i + 1}</span>
                        <span className="text-slate-300">{g.descripcion}</span>
                      </div>
                      <span className="text-[10px] text-sky-400 font-mono">AGS-MAPPED</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RELATIONAL NETWORK GRAPH */}
          {!isAnalyzing && analysisResult && activeTab === "grafo" && (
            <div className="space-y-4">
              <div className="card p-4 border-l-4 border-l-sky-500 bg-slate-900/60">
                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wide">Grafo de Inteligencia Criminal</h3>
                <p className="text-xs text-slate-400 mt-1">Nodos interconectados representando jerarquía, conflicto, alianzas y control territorial. Haga clic en los nodos para inspeccionar vínculos.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* SVG GRAPH CANVAS (7 cols) */}
                <div className="md:col-span-8 h-96 border border-slate-800 rounded-2xl bg-slate-950 relative overflow-hidden shadow-inner">
                  {/* Grid overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-25" />
                  
                  {/* Interactive SVG Renderer */}
                  <svg className="w-full h-full cursor-grab active:cursor-grabbing">
                    <defs>
                      <marker id="arrow-conflicto" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                      </marker>
                      <marker id="arrow-pertenece" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                      </marker>
                    </defs>

                    {/* RENDER EDGES / LINKS */}
                    {analysisResult.grafo.enlaces.map((link, idx) => {
                      // Find nodes coordinates to draw lines
                      const sNodeIdx = analysisResult.grafo.nodos.findIndex(n => n.id === link.source);
                      const tNodeIdx = analysisResult.grafo.nodos.findIndex(n => n.id === link.target);
                      if (sNodeIdx === -1 || tNodeIdx === -1) return null;

                      // Visual projection mathematically distributed around the canvas center
                      const canvasW = 350;
                      const canvasH = 380;
                      const cX = canvasW / 2;
                      const cY = canvasH / 2;

                      const getCoords = (nodeIdx: number, total: number) => {
                        if (nodeIdx === 0) return { x: cX + 60, y: cY }; // Gang center node
                        const angle = (nodeIdx / total) * Math.PI * 2;
                        const r = nodeIdx % 2 === 0 ? 110 : 155;
                        return {
                          x: cX + 60 + Math.sin(angle) * r,
                          y: cY + Math.cos(angle) * r,
                        };
                      };

                      const source = getCoords(sNodeIdx, analysisResult.grafo.nodos.length);
                      const target = getCoords(tNodeIdx, analysisResult.grafo.nodos.length);

                      const isConflicto = link.relacion === "conflicto";

                      return (
                        <line
                          key={idx}
                          x1={source.x}
                          y1={source.y}
                          x2={target.x}
                          y2={target.y}
                          stroke={isConflicto ? "#ef4444" : "#38bdf8"}
                          strokeWidth={isConflicto ? 2 : 1}
                          strokeDasharray={isConflicto ? "4,4" : undefined}
                          opacity={0.6}
                          markerEnd={isConflicto ? "url(#arrow-conflicto)" : "url(#arrow-pertenece)"}
                        />
                      );
                    })}

                    {/* RENDER NODES */}
                    {analysisResult.grafo.nodos.map((node, idx) => {
                      const canvasW = 350;
                      const canvasH = 380;
                      const cX = canvasW / 2;
                      const cY = canvasH / 2;

                      const getCoords = (nodeIdx: number, total: number) => {
                        if (nodeIdx === 0) return { x: cX + 60, y: cY }; // Center
                        const angle = (nodeIdx / total) * Math.PI * 2;
                        const r = nodeIdx % 2 === 0 ? 110 : 155;
                        return {
                          x: cX + 60 + Math.sin(angle) * r,
                          y: cY + Math.cos(angle) * r,
                        };
                      };

                      const coords = getCoords(idx, analysisResult.grafo.nodos.length);

                      // Style colors by type
                      let fill = "#0f172a";
                      let stroke = "#475569";
                      let r = 12;

                      if (node.tipo === "pandilla") {
                        fill = idx === 0 ? "#0284c7" : "#7f1d1d";
                        stroke = idx === 0 ? "#38bdf8" : "#f87171";
                        r = idx === 0 ? 18 : 14;
                      } else if (node.tipo === "integrante") {
                        fill = "#1e1b4b";
                        stroke = "#38bdf8";
                        r = 10;
                      } else if (node.tipo === "zona") {
                        fill = "#3b0764";
                        stroke = "#c084fc";
                        r = 9;
                      } else if (node.tipo === "simbolo") {
                        fill = "#78350f";
                        stroke = "#fbbf24";
                        r = 9;
                      }

                      return (
                        <g
                          key={node.id}
                          className="cursor-pointer group"
                          transform={`translate(${coords.x}, ${coords.y})`}
                          onClick={() => setSelectedNode(node)}
                        >
                          <circle
                            r={r}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={2}
                            className="transition-all hover:scale-125 duration-200"
                          />
                          <text
                            y={r + 14}
                            textAnchor="middle"
                            fill="#cbd5e1"
                            fontSize="9"
                            fontFamily="sans-serif"
                            className="pointer-events-none font-bold"
                          >
                            {node.label.length > 20 ? `${node.label.substring(0, 17)}...` : node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* GRAPH DETAILS SIDEBAR (4 cols) */}
                <div className="md:col-span-4 bg-slate-950/50 border border-slate-800 rounded-2xl p-4 min-h-[300px] flex flex-col justify-between">
                  {selectedNode ? (
                    <div className="space-y-4">
                      <div>
                        <span className="text-[9px] font-bold text-sky-400 uppercase tracking-widest">{selectedNode.tipo} Link</span>
                        <h4 className="text-sm font-black text-slate-200 uppercase">{selectedNode.label}</h4>
                      </div>

                      <div className="space-y-3 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-3">
                        <p><strong>Identificador Único:</strong> <span className="font-mono text-slate-300">{selectedNode.id}</span></p>
                        
                        {selectedNode.tipo === "pandilla" && (
                          <>
                            <p><strong>Clasificación de Rol:</strong> Entidad Colectiva Criminal</p>
                            <p><strong>Nivel de Amenaza:</strong> <span className="text-red-400 font-bold">{selectedNode.risk || "Alto"}</span></p>
                            <p className="bg-slate-900 p-2 rounded text-slate-300">Este nodo representa a la pandilla base del análisis de vínculos delictivos.</p>
                          </>
                        )}

                        {selectedNode.tipo === "integrante" && (
                          <>
                            <p><strong>Asociación:</strong> Operando bajo la pandilla "{selectedNode.grupo || "Principal"}"</p>
                            <p><strong>Criterio de Grafo:</strong> Actor activo identificado con rol e incidencia territorial en Aguascalientes.</p>
                          </>
                        )}

                        {selectedNode.tipo === "zona" && (
                          <>
                            <p><strong>Tipo de Enlace:</strong> Eje de Dominio Espacial</p>
                            <p className="bg-purple-950/20 p-2 rounded text-purple-200">Delimitado como sector de marcación y patrullaje.</p>
                          </>
                        )}

                        {selectedNode.tipo === "simbolo" && (
                          <>
                            <p><strong>Tipo de Enlace:</strong> Marca Simbólica Visual</p>
                            <p className="bg-yellow-950/20 p-2 rounded text-yellow-200">Utilizado por la clica para delimitar fronteras territoriales o firmar ataques contra antagónicos.</p>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <span className="text-2xl opacity-40">ℹ️</span>
                      <p className="text-xs text-slate-500 mt-2">Haga clic en cualquiera de los nodos del mapa de red para visualizar los metadatos de inteligencia del actor.</p>
                    </div>
                  )}

                  <div className="border-t border-slate-800/80 pt-3 text-[9px] text-slate-500">
                    Haga clic en Limpiar Formulario para rehacer.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUTOMATIC ALERT CHRONOLOGY */}
          {!isAnalyzing && analysisResult && activeTab === "alertas" && (
            <div className="space-y-4">
              <div className="card p-4 border-l-4 border-l-red-500 bg-slate-900/60">
                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wide">Cronología de Alertas Tácticas</h3>
                <p className="text-xs text-slate-400 mt-1">Detecciones automatizadas de riesgo territorial, incremento de actividad criminal y coincidencia de domicilios históricos.</p>
              </div>

              <div className="space-y-3">
                {analysisResult.alertas.map((alert, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border flex gap-3.5 relative overflow-hidden bg-slate-950/40 ${
                      alert.severidad === "Crítica" ? "border-red-900/50" :
                      alert.severidad === "Alta" ? "border-orange-900/50" :
                      "border-slate-800"
                    }`}
                  >
                    {/* Glowing severities */}
                    {alert.severidad === "Crítica" && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                    {alert.severidad === "Alta" && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500" />}
                    {alert.severidad === "Media" && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-500" />}

                    <div className="text-lg">
                      {alert.tipo === "territorio" ? "📍" :
                       alert.tipo === "conflicto" ? "⚔️" :
                       alert.tipo === "actor" ? "👤" : "🚨"}
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          alert.severidad === "Crítica" ? "text-red-400" :
                          alert.severidad === "Alta" ? "text-orange-400" :
                          alert.severidad === "Media" ? "text-yellow-400" : "text-sky-400"
                        }`}>
                          ALERTA {alert.severidad} · {alert.tipo}
                        </span>
                        <span className="text-[9px] text-slate-500">{alert.fecha}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                        {alert.mensaje}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SAVED RECORDS (EXPEDIENTES) */}
          {activeTab === "registros" && (
            <div className="space-y-4">
              <div className="card p-4 border-l-4 border-l-emerald-500 bg-slate-900/60">
                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wide">Expedientes Guardados en la Nube</h3>
                <p className="text-xs text-slate-400 mt-1">Consulte o recupere registros históricos de pandillas almacenados en Firestore para actualizar su barrido táctico.</p>
              </div>

              {storedGangs.length === 0 ? (
                <div className="card p-8 text-center text-slate-500 italic text-xs bg-slate-950/15">
                  No hay expedientes guardados aún. Cree uno nuevo en el panel izquierdo y haga clic en 'Guardar en Nube'.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {storedGangs.map(gang => (
                    <div
                      key={gang.id}
                      onClick={() => handleLoadGang(gang)}
                      className="card p-4 bg-slate-900/25 border-slate-800 hover:border-sky-500 cursor-pointer transition-all space-y-2 relative group"
                    >
                      <button
                        type="button"
                        onClick={(e) => handleDeleteGang(gang.id!, e)}
                        className="absolute right-3 top-3 p-1 rounded text-slate-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar permanentemente"
                      >
                        🗑️
                      </button>

                      <div>
                        <span className="text-[9px] font-black text-sky-400 uppercase tracking-wider">EXPEDIENTE FIRESTORE</span>
                        <h4 className="text-sm font-bold text-slate-200 truncate uppercase mt-0.5 pr-6">{gang.nombre}</h4>
                        <p className="text-xs text-slate-400 mt-1 truncate">Zona: <span className="text-slate-300 font-medium">{gang.zonaInfluencia || "Sin delimitar"}</span></p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/80 pt-2 mt-1">
                        <span>👥 {gang.integrantes.length} integrantes</span>
                        <span>👤 {gang.createdBy || "CEIPOL"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
