"use client";
// Vista del Dashboard de Monitoreo para el Superadministrador
// [Fuerza de compilación para Next.js App Router]

import React from "react";

// Mocks de datos - Esto provendría de tu base de datos y módulo de Auth
const mockUser = {
  nombre: "Juan Pérez López",
  grado: "Inspector",
  foto: "https://i.pravatar.cc/150?img=11",
  id_empleado: "123456"
};

const mockMetrics = {
  proyectosAbiertos: 14,
  proyectosCerrados: 45,
  contextosOptimos: 85, // % de contextos >= 80% sin IA
  hipotesisOptimas: 78, // % de hipótesis >= 80% sin IA
  usoSugerenciasIA: 62, // % de ayudas utilizadas
  evidenciasCargadas: 342,
  erroresComunes: [
    "Falta correlacionar comercios irregulares en el contexto",
    "Hipótesis muy general o escueta",
    "No se especifican horarios de riesgo"
  ],
  fortalezasDetectadas: [
    "Excelente identificación de OCR táctico",
    "Alto nivel de detalle en evidencia fotográfica"
  ],
  tiposEvidencia: [
    { tipo: "Fotografía In-Situ", cantidad: 210 },
    { tipo: "Captura Street View", cantidad: 80 },
    { tipo: "Documental/Gabinete", cantidad: 52 }
  ],
  tasaCorreccionIA: "12%",
  tiempoPromedioContexto: "18 mins"
};

export default function MonitoreoAdminPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-slate-900 border-b border-slate-800 p-4 md:p-6 sticky top-0 z-10 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-sky-500 shadow-lg">
              <img src={mockUser.foto} alt="Foto Perfil" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-50">{mockUser.nombre}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                <span className="bg-slate-800 text-sky-400 px-2 py-0.5 rounded text-xs font-semibold">
                  {mockUser.grado}
                </span>
                <span>ID: {mockUser.id_empleado}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-md text-sm font-semibold transition-colors">
              Seleccionar otro Analista
            </button>
            <button className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors shadow-lg shadow-sky-900/20">
              Ver Profile Completo
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="Proyectos Abiertos" value={mockMetrics.proyectosAbiertos} color="text-amber-400" />
          <MetricCard title="Proyectos Cerrados" value={mockMetrics.proyectosCerrados} color="text-emerald-400" />
          <MetricCard title="Total Evidencias" value={mockMetrics.evidenciasCargadas} color="text-sky-400" />
          <MetricCard title="Tpo. Promedio Contexto" value={mockMetrics.tiempoPromedioContexto} color="text-purple-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">Interacción con IA</h3>
            <div className="space-y-4">
              <ProgressBar label="Contextos ≥80% sin IA" value={mockMetrics.contextosOptimos} color="bg-emerald-500" />
              <ProgressBar label="Hipótesis ≥80% sin IA" value={mockMetrics.hipotesisOptimas} color="bg-emerald-500" />
              <ProgressBar label="Uso de Ayudas de IA" value={mockMetrics.usoSugerenciasIA} color="bg-sky-500" />
            </div>
            <p className="text-xs text-slate-500 mt-4 italic">
              * Tasa de Corrección Post-IA: <span className="font-bold text-red-400">{mockMetrics.tasaCorreccionIA}</span>
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-lg md:col-span-2">
            <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">Registro Conductual y Epistemológico</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 mb-2">
                  ↑ Fortalezas (Contextualización)
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-sm text-slate-300">
                  {mockMetrics.fortalezasDetectadas.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-2">
                  ↓ Áreas de Oportunidad (Errores/Limitaciones)
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-sm text-slate-300">
                  {mockMetrics.erroresComunes.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">Tipos de Evidencia Aportados</h3>
          <div className="flex flex-col md:flex-row gap-4">
            {mockMetrics.tiposEvidencia.map((te, idx) => (
              <div key={idx} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-200">{te.cantidad}</span>
                <span className="text-xs text-slate-400 text-center mt-1">{te.tipo}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-center items-center shadow-md">
      <p className="text-xs text-slate-400 font-medium text-center uppercase tracking-wide">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  );
}

function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}