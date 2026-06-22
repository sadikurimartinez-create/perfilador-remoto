"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function PerfilPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    grado: "",
    id_empleado: "",
    adscripcionAnterior: "",
    aniosSspe: "",
    bachillerato: "NO",
    licenciatura: "NO",
    licenciaturaCual: "",
    maestria: "NO",
    maestriaCual: "",
    fotografia: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isLocked = !!(user as any)?.perfilCompleto;

  useEffect(() => {
    if (user) {
      setFormData({
        nombre: (user as any).nombre || "",
        apellidoPaterno: (user as any).apellidoPaterno || "",
        apellidoMaterno: (user as any).apellidoMaterno || "",
        grado: (user as any).grado || "",
        id_empleado: (user as any).id_empleado || "",
        adscripcionAnterior: (user as any).adscripcionAnterior || "",
        aniosSspe: (user as any).aniosSspe || "",
        bachillerato: (user as any).bachillerato || "NO",
        licenciatura: (user as any).licenciatura || "NO",
        licenciaturaCual: (user as any).licenciaturaCual || "",
        maestria: (user as any).maestria || "NO",
        maestriaCual: (user as any).maestriaCual || "",
        fotografia: (user as any).fotografia || "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (isLocked) return;
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, fotografia: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isLocked) return;
    setIsLoading(true);
    setMessage("");

    try {
      const { getDb } = await import("@/lib/firebase");
      const { doc, setDoc } = await import("firebase/firestore");
      const db = getDb();
      
      const fullName = `${formData.nombre.trim()} ${formData.apellidoPaterno.trim()} ${formData.apellidoMaterno.trim()}`.trim();
      
      await setDoc(doc(db, "users", String((user as any).id)), {
        ...formData,
        name: fullName,
        perfilCompleto: true
      }, { merge: true });

      setMessage("Perfil guardado correctamente.");
      // El AuthContext se actualizará automáticamente gracias al listener de Firestore.
      // Navegamos al Lobby después de un momento para que el usuario vea el mensaje.
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error: any) {
      setMessage("Error al guardar perfil: " + error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full mt-4">
      <header className="mb-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Mi Perfil Operativo</h1>
          <p className="text-sm text-slate-400 mt-2">
            Es <strong>obligatorio</strong> completar todos los campos para poder acceder al sistema y generar análisis. Esta regla aplica para todos los roles (Analistas, Administradores y Superadministradores).
          </p>
        </div>

        {isLocked && (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-5 flex items-start gap-4 shadow-lg text-amber-200">
            <span className="text-3xl flex-shrink-0">🔒</span>
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                Pestaña Bloqueada - Registro de Perfil Completado
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Por motivos de seguridad, integridad y auditoría institucional, una vez que has dado de alta tus datos operativos de perfilador, esta pestaña queda bloqueada para edición. No se admiten modificaciones adicionales. Si requieres corregir algún dato, por favor contacta al Super Administrador de la plataforma.
              </p>
            </div>
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-5">
        {message && (
          <div className={`p-3 rounded-md text-sm font-semibold ${message.includes("error") ? "bg-red-900/50 text-red-300 border border-red-800" : "bg-emerald-900/50 text-emerald-300 border border-emerald-800"}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-slate-300 mb-1">Nombre(s)</label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                required
                disabled={isLocked}
                value={formData.nombre}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Ej. Juan"
              />
            </div>
            <div>
              <label htmlFor="apellidoPaterno" className="block text-sm font-medium text-slate-300 mb-1">Apellido Paterno</label>
              <input
                type="text"
                id="apellidoPaterno"
                name="apellidoPaterno"
                required
                disabled={isLocked}
                value={formData.apellidoPaterno}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="apellidoMaterno" className="block text-sm font-medium text-slate-300 mb-1">Apellido Materno</label>
              <input
                type="text"
                id="apellidoMaterno"
                name="apellidoMaterno"
                required
                disabled={isLocked}
                value={formData.apellidoMaterno}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="grado" className="block text-sm font-medium text-slate-300 mb-1">Grado / Cargo</label>
              <input
                type="text"
                id="grado"
                name="grado"
                required
                disabled={isLocked}
                value={formData.grado}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Ej. Inspector, Analista, etc."
              />
            </div>
            <div>
              <label htmlFor="id_empleado" className="block text-sm font-medium text-slate-300 mb-1">ID de Empleado / Placa</label>
              <input
                type="text"
                id="id_empleado"
                name="id_empleado"
                required
                disabled={isLocked}
                value={formData.id_empleado}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Ej. 123456"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="adscripcionAnterior" className="block text-sm font-medium text-slate-300 mb-1">Adscripción Inmediata Anterior</label>
              <input
                type="text"
                id="adscripcionAnterior"
                name="adscripcionAnterior"
                required
                disabled={isLocked}
                value={formData.adscripcionAnterior}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="aniosSspe" className="block text-sm font-medium text-slate-300 mb-1">Años de pertenecer a la SSPE</label>
              <input
                type="number"
                id="aniosSspe"
                name="aniosSspe"
                required
                disabled={isLocked}
                min="0"
                value={formData.aniosSspe}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Historial Académico</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Bachillerato</label>
                <select name="bachillerato" disabled={isLocked} value={formData.bachillerato} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="NO">NO</option>
                  <option value="SI">SI</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Licenciatura</label>
                <select name="licenciatura" disabled={isLocked} value={formData.licenciatura} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="NO">NO</option>
                  <option value="SI">SI</option>
                </select>
                {formData.licenciatura === "SI" && (
                  <input type="text" name="licenciaturaCual" disabled={isLocked} value={formData.licenciaturaCual} onChange={handleChange} placeholder="¿Cuál?" required className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed" />
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Maestría</label>
                <select name="maestria" disabled={isLocked} value={formData.maestria} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="NO">NO</option>
                  <option value="SI">SI</option>
                </select>
                {formData.maestria === "SI" && (
                  <input type="text" name="maestriaCual" disabled={isLocked} value={formData.maestriaCual} onChange={handleChange} placeholder="¿En qué?" required className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed" />
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Fotografía Institucional</h3>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-24 h-24 rounded-lg bg-slate-950 border border-slate-700 overflow-hidden flex items-center justify-center">
                {formData.fotografia ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={formData.fotografia} alt="Fotografía" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">👤</span>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-1">Subir imagen</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isLocked}
                  onChange={handleFileChange}
                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-2">
                  {isLocked ? "La fotografía de tu perfil operativo está guardada y bloqueada." : "La fotografía se guardará en tu perfil operativo."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isLoading || isLocked}
            className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${
              isLocked
                ? "bg-slate-800 text-slate-500 border border-slate-700 shadow-none cursor-not-allowed"
                : "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/20"
            }`}
          >
            {isLoading ? "Guardando..." : isLocked ? "🔒 Perfil Bloqueado" : "Guardar Perfil"}
          </button>
        </div>
      </form>
    </div>
  );
}