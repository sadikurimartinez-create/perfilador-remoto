"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function PerfilPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    nombre: "",
    grado: "",
    id_empleado: "",
    dependencia: "Secretaría de Seguridad Pública del Estado",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({
        nombre: (user as any).nombre || "",
        grado: (user as any).grado || "",
        id_empleado: (user as any).id_empleado || "",
        dependencia: (user as any).dependencia || "Secretaría de Seguridad Pública del Estado",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    // TODO: Enlazar esto con la función de actualización real de tu AuthContext/API
    // await updateProfile(formData);
    
    setTimeout(() => {
      setIsLoading(false);
      setMessage("Perfil guardado correctamente.");
      
      // Si el perfil ya está completo, redirigimos al Dashboard Principal (Mis Expedientes)
      if (formData.nombre && formData.grado && formData.id_empleado) {
         setTimeout(() => router.push("/"), 800);
      }
    }, 1000);
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
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-slate-300 mb-1">Nombre Completo</label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              required
              value={formData.nombre}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
              placeholder="Ej. Juan Pérez López"
            />
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

          <div>
            <label htmlFor="dependencia" className="block text-sm font-medium text-slate-300 mb-1">Dependencia de Adscripción</label>
            <input
              type="text"
              id="dependencia"
              name="dependencia"
              required
              value={formData.dependencia}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
              placeholder="Ej. Secretaría de Seguridad Pública del Estado"
            />
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