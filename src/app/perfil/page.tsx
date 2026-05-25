"use client";

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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!user) return;
    setIsLoading(true);
    setMessage("");

    try {
      const { getDb } = await import("@/lib/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      const db = getDb();
      
      const fullName = `${formData.nombre.trim()} ${formData.apellidoPaterno.trim()} ${formData.apellidoMaterno.trim()}`.trim();
      
      await updateDoc(doc(db, "users", String((user as any).id)), {
        ...formData,
        name: fullName,
        perfilCompleto: true
      });

      setMessage("Perfil guardado correctamente.");
      // El AuthContext debería actualizarse automáticamente gracias a los listeners de Firebase.
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
    <div className="max-w-2xl mx-auto w-full mt-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Mi Perfil Operativo</h1>
        <p className="text-sm text-slate-400 mt-2">
          Es <strong>obligatorio</strong> completar todos los campos para poder acceder al sistema y generar análisis. Esta regla aplica para todos los roles (Analistas, Administradores y Superadministradores).
        </p>
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
                value={formData.nombre}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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
                value={formData.apellidoPaterno}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label htmlFor="apellidoMaterno" className="block text-sm font-medium text-slate-300 mb-1">Apellido Materno</label>
              <input
                type="text"
                id="apellidoMaterno"
                name="apellidoMaterno"
                required
                value={formData.apellidoMaterno}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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
                value={formData.grado}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
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
                value={formData.id_empleado}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
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
                value={formData.adscripcionAnterior}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label htmlFor="aniosSspe" className="block text-sm font-medium text-slate-300 mb-1">Años de pertenecer a la SSPE</label>
              <input
                type="number"
                id="aniosSspe"
                name="aniosSspe"
                required
                min="0"
                value={formData.aniosSspe}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Historial Académico</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Bachillerato</label>
                <select name="bachillerato" value={formData.bachillerato} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-sky-500">
                  <option value="NO">NO</option>
                  <option value="SI">SI</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Licenciatura</label>
                <select name="licenciatura" value={formData.licenciatura} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-sky-500">
                  <option value="NO">NO</option>
                  <option value="SI">SI</option>
                </select>
                {formData.licenciatura === "SI" && (
                  <input type="text" name="licenciaturaCual" value={formData.licenciaturaCual} onChange={handleChange} placeholder="¿Cuál?" required className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100" />
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Maestría</label>
                <select name="maestria" value={formData.maestria} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-sky-500">
                  <option value="NO">NO</option>
                  <option value="SI">SI</option>
                </select>
                {formData.maestria === "SI" && (
                  <input type="text" name="maestriaCual" value={formData.maestriaCual} onChange={handleChange} placeholder="¿En qué?" required className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100" />
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
                  onChange={handleFileChange}
                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-2">La fotografía se guardará en tu perfil operativo.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-2 rounded-md text-sm font-semibold transition-colors shadow-lg shadow-sky-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Guardando..." : "Guardar Perfil"}
          </button>
        </div>
      </form>
    </div>
  );
}