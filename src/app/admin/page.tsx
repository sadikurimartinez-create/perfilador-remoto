"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { jsPDF } from "jspdf";

type UserDoc = {
  id: string;
  username: string;
  role: string;
  name: string;
  grado?: string;
  id_empleado?: string;
  fecha_ingreso?: string;
  grado_estudio?: string;
  fortalezas?: string;
  debilidades?: string;
  fotografia?: string;
};

const CHECKLIST_QUESTIONS = [
  "¿Las fotografías incluyen coordenadas y comentarios tácticos claros?",
  "¿Se correlacionó correctamente la estadística delictiva local con el entorno?",
  "¿El análisis OSINT y DENUE sustenta el nivel de deterioro (Ventanas Rotas)?",
  "¿Las conclusiones y predicciones a 6 meses son objetivas y aplicables?",
  "¿Se aplicó correctamente la Teoría del Patrón Delictivo?"
];

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"supervision" | "usuarios" | "desempeno">("supervision");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [role, setRole] = useState("USER");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdMessage, setPwdMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Estados para Supervisión
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [checklist, setChecklist] = useState<boolean[]>([false, false, false, false, false]);
  const [feedback, setFeedback] = useState("");
  const [evaluationMsg, setEvaluationMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Estado para el Dashboard de Desempeño
  const [selectedUserForPerf, setSelectedUserForPerf] = useState<UserDoc | null>(null);

  useEffect(() => {
    if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) return;
    const db = getDb();
    
    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProjects(list.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
    });

    let unsubUsers = () => {};
    if (user.role === "SUPER_ADMIN") {
      unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const list: UserDoc[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            username: data.username ?? "",
            role: data.role ?? "USER",
            name: data.name ?? "",
            grado: data.grado || "",
            id_empleado: data.id_empleado || data.num_empleado || "",
            fecha_ingreso: data.fecha_ingreso_ceipol || data.anio_ingreso_corp || "",
            grado_estudio: data.grado_estudio || "",
            fortalezas: data.fortalezas || "",
            debilidades: data.debilidades || "",
            fotografia: data.fotografia || data.foto_url || "",
          };
        })
        .sort((a, b) => b.id.localeCompare(a.id));
      setUsers(list);
    });
    }

    return () => {
      unsubProjects();
      unsubUsers();
    };
  }, [user]);

  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN")) {
    return (
      <div className="card p-6 text-center space-y-3 mt-8 max-w-md mx-auto">
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

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !name.trim()) return;
    setMessage(null);

    if (role === "ADMIN") {
      const adminCount = users.filter((u) => u.role === "ADMIN").length;
      if (adminCount >= 2) {
        setMessage({ type: "error", text: "El sistema solo permite un máximo de 2 Administradores." });
        return;
      }
    }

    try {
      const db = getDb();
      await addDoc(collection(db, "users"), {
        username: username.trim(),
        passwordHash: password,
        role: role,
        name: name.trim(),
        createdAt: Date.now(),
      });
      setUsername("");
      setPassword("");
      setName("");
      setMessage({ type: "ok", text: "Usuario registrado correctamente." });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "No se pudo registrar." });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    const userToDelete = users.find((u) => u.id === id);
    if (userToDelete?.role === "SUPER_ADMIN") {
      setMessage({ type: "error", text: "Medida de seguridad: No se puede eliminar al Super Administrador." });
      return;
    }
    try {
      const db = getDb();
      await deleteDoc(doc(db, "users", id));
      setMessage({ type: "ok", text: "Usuario eliminado." });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "No se pudo eliminar." });
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPwd || !newPwd) return;
    setPwdMessage(null);
    try {
      const db = getDb();
      const userRef = doc(db, "users", String(user.id));
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
         throw new Error("Usuario no encontrado en la base de datos.");
      }
      if (snap.data().passwordHash !== currentPwd) {
         throw new Error("La contraseña actual es incorrecta.");
      }
      await updateDoc(userRef, {
         passwordHash: newPwd
      });
      setCurrentPwd("");
      setNewPwd("");
      setPwdMessage({ type: "ok", text: "Contraseña actualizada exitosamente." });
    } catch (err: any) {
      setPwdMessage({ type: "error", text: err?.message || "Error al actualizar contraseña." });
    }
  };

  const handleExportPerfPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    // 1. Cabecera Ejecutiva
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE EJECUTIVO DE DESEMPEÑO DE ANALISTAS", 14, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Centro de Estudios en Seguridad Pública y Política Criminal (CEIPOL)", 14, y);
    y += 6;
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString("es-MX")} - ${new Date().toLocaleTimeString("es-MX")}`, 14, y);
    y += 6;
    doc.text(`Generado por: ${user?.name || user?.username} (${user?.role})`, 14, y);
    y += 8;

    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, 196, y);
    y += 10;

    // 2. Resumen Global
    const totalProjs = projects.length;
    const totalValidados = projects.filter(p => p.estado === "CERRADO" || p.estado === "VALIDADO").length;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("MÉTRICAS GLOBALES", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fuerza Analítica Total: ${users.length} analistas`, 14, y);
    doc.text(`Expedientes Totales: ${totalProjs}`, 80, y);
    doc.text(`Expedientes Validados: ${totalValidados}`, 140, y);
    y += 10;

    // 3. Tabla de Desempeño (Iterando sobre usuarios)
    const drawHeaders = (posY: number) => {
      doc.setFillColor(240, 244, 248);
      doc.rect(14, posY, 182, 8, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("ANALISTA", 16, posY + 5.5);
      doc.text("NO. EMPLEADO", 70, posY + 5.5);
      doc.text("ABIERTOS", 105, posY + 5.5);
      doc.text("REVISIÓN", 125, posY + 5.5);
      doc.text("DEVUELTOS", 150, posY + 5.5);
      doc.text("VALIDADOS", 175, posY + 5.5);
      doc.setFont("helvetica", "normal");
    };

    drawHeaders(y);
    y += 13;

    users.forEach((u) => {
      if (y > 275) { doc.addPage(); y = 20; drawHeaders(y); y += 13; }
      const userProjs = projects.filter(p => p.createdBy === u.username);
      const pAbiertos = userProjs.filter(p => !p.estado || p.estado === "ABIERTO").length;
      const pRevision = userProjs.filter(p => p.estado === "EN REVISIÓN").length;
      const pDevueltos = userProjs.filter(p => p.estado === "DEVUELTO").length;
      const pValidados = userProjs.filter(p => p.estado === "CERRADO" || p.estado === "VALIDADO").length;

      const name = (u.name || u.username).substring(0, 26);
      doc.text(name, 16, y);
      doc.text(u.id_empleado || "N/A", 70, y);
      doc.text(String(pAbiertos), 112, y);
      doc.text(String(pRevision), 132, y);
      doc.text(String(pDevueltos), 158, y);
      doc.text(String(pValidados), 183, y);
      
      y += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y, 196, y);
      y += 7;
    });

    doc.save(`Desempeño_Analistas_${new Date().getTime()}.pdf`);
  };

  const openEvaluation = (proyecto: any) => {
    setSelectedProject(proyecto);
    setChecklist([false, false, false, false, false]);
    setFeedback("");
    setEvaluationMsg(null);
  };

  const toggleChecklist = (index: number) => {
    const newC = [...checklist];
    newC[index] = !newC[index];
    setChecklist(newC);
  };

  const handleValidar = async () => {
    if (checklist.some((c) => !c)) {
      setEvaluationMsg({ type: "error", text: "Debes marcar todos los puntos del checklist institucional (CEIPOL) para poder Validar." });
      return;
    }
    setEvaluationMsg(null);
    try {
      const db = getDb();
      await updateDoc(doc(db, "projects", selectedProject.id), {
        estado: "CERRADO",
        evaluadoPor: user.name,
        fechaEvaluacion: Date.now(),
      });
      setEvaluationMsg({ type: "ok", text: "Expediente VALIDADO y CERRADO exitosamente." });
      setTimeout(() => setSelectedProject(null), 1500);
    } catch (err: any) {
      setEvaluationMsg({ type: "error", text: err?.message || "Error al validar el expediente." });
    }
  };

  const handleDevolver = async () => {
    if (!feedback.trim()) {
      setEvaluationMsg({ type: "error", text: "Es OBLIGATORIO incluir observaciones en la caja de retroalimentación para devolver un expediente." });
      return;
    }
    setEvaluationMsg(null);
    try {
      const db = getDb();
      await updateDoc(doc(db, "projects", selectedProject.id), {
        estado: "DEVUELTO",
        comentariosSupervisor: feedback,
        evaluadoPor: user.name,
        fechaEvaluacion: Date.now(),
      });
      setEvaluationMsg({ type: "ok", text: "Expediente DEVUELTO al analista con observaciones." });
      setTimeout(() => setSelectedProject(null), 1500);
    } catch (err: any) {
      setEvaluationMsg({ type: "error", text: err?.message || "Error al devolver el expediente." });
    }
  };

  const enRevision = projects.filter(p => p.estado === "EN REVISIÓN");
  const aprobados = projects.filter(p => p.estado === "CERRADO" && p.evaluadoPor === user.name).length;
  const devueltos = projects.filter(p => p.estado === "DEVUELTO" && p.evaluadoPor === user.name).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">
            Panel de Administración
          </h2>
          <p className="text-xs text-slate-400">
            Gestión y supervisión de expedientes operativos.
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2"
        >
          Volver a Mis Expedientes
        </Link>
      </div>

      <div className="flex gap-4 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("supervision")}
          className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === "supervision" ? "border-sky-500 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
        >
          Supervisión de Expedientes
        </button>
        <button
          onClick={() => setActiveTab("desempeno")}
          className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === "desempeno" ? "border-fuchsia-500 text-fuchsia-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
        >
          Desempeño y Perfil
        </button>
        {user.role === "SUPER_ADMIN" && (
          <button
            onClick={() => setActiveTab("usuarios")}
            className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === "usuarios" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
          >
            Gestión de Usuarios
          </button>
        )}
      </div>

      {activeTab === "supervision" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-center items-center shadow-md">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">En Revisión (Pendientes)</p>
              <p className="text-3xl font-bold mt-2 text-amber-400">{enRevision.length}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-center items-center shadow-md">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Mis Validaciones (Aprobados)</p>
              <p className="text-3xl font-bold mt-2 text-emerald-400">{aprobados}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-center items-center shadow-md">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Mis Devoluciones</p>
              <p className="text-3xl font-bold mt-2 text-red-400">{devueltos}</p>
            </div>
          </div>

          {!selectedProject ? (
            <div className="card border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-100 mb-3">Bandeja de Entrada: Expedientes En Revisión</h3>
              {enRevision.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-900/50 p-4 rounded-lg text-center border border-slate-800/50">No hay expedientes pendientes de validación en este momento.</p>
              ) : (
                <ul className="space-y-2">
                  {enRevision.map(p => (
                    <li key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 border border-slate-800 p-3 rounded-lg gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-200">{p.name || p.nombre || "Expediente Sin Nombre"}</p>
                        <p className="text-[11px] text-slate-400">Enviado a revisión por: <span className="text-slate-300 font-medium">{p.createdBy || "Analista"}</span></p>
                      </div>
                      <button
                        onClick={() => openEvaluation(p)}
                        className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded text-xs font-semibold shadow transition-colors"
                      >
                        Evaluar Expediente
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="card border border-sky-900 bg-slate-900/80 p-5 space-y-5 shadow-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-sky-400">Evaluación de Calidad Institucional (CEIPOL)</h3>
                  <p className="text-xs text-slate-300 mt-1">Expediente: <span className="font-semibold text-white">{selectedProject.name || selectedProject.nombre}</span></p>
                </div>
                <button onClick={() => setSelectedProject(null)} className="text-slate-400 hover:text-white text-[11px] uppercase font-bold tracking-wider bg-slate-800 px-2 py-1 rounded">✕ Cerrar</button>
              </div>

              <div className="space-y-3 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                <h4 className="text-sm font-semibold text-slate-200 mb-4">Checklist de Revisión</h4>
                {CHECKLIST_QUESTIONS.map((q, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={checklist[i]} onChange={() => toggleChecklist(i)} className="mt-0.5 w-4 h-4 bg-slate-900 border-slate-600 rounded text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900 transition-colors" />
                    <span className={`text-xs leading-relaxed ${checklist[i] ? "text-slate-300" : "text-slate-400 group-hover:text-slate-300 transition-colors"}`}>{q}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-200">Retroalimentación / Comentarios de mejora (Obligatorio para devolver)</label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Ej. Falta profundidad en el análisis de las rutas de escape en el cuadrante nororiente..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-xs text-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-h-[80px]"
                />
              </div>

              {evaluationMsg && (
                <div className={`p-3 rounded text-xs font-semibold border ${evaluationMsg.type === "ok" ? "bg-emerald-900/40 text-emerald-400 border-emerald-800" : "bg-red-900/40 text-red-400 border-red-800"}`}>
                  {evaluationMsg.text}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button onClick={handleValidar} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded text-xs uppercase tracking-wider font-bold shadow-lg transition-colors">
                  ✓ Validar y Cerrar
                </button>
                <button onClick={handleDevolver} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded text-xs uppercase tracking-wider font-bold shadow-lg transition-colors">
                  ✗ Devolver al Analista
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "usuarios" && user.role === "SUPER_ADMIN" && (
        <div className="space-y-6">
      <form
        onSubmit={handleAddUser}
        className="card p-4 space-y-3 border border-slate-800"
      >
        <h3 className="text-sm font-semibold text-slate-100">
          Alta de analistas y administradores
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Contraseña
            </label>
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 pr-9 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-white"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Rol del sistema
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:ring-sky-500"
            >
              <option value="USER">Perfilador (USER)</option>
              <option value="ADMIN">Administrador (ADMIN)</option>
            </select>
          </div>
        </div>
        {message && (
          <p
            className={`text-xs ${
              message.type === "ok" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          Registrar Usuario
        </button>
      </form>

      <form
        onSubmit={handleChangePassword}
        className="card p-4 space-y-3 border border-slate-800"
      >
        <h3 className="text-sm font-semibold text-slate-100">
          Cambiar mi contraseña (SUPER_ADMIN)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Contraseña Actual
            </label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-300 mb-1">
              Nueva Contraseña
            </label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:ring-sky-500"
            />
          </div>
        </div>
        {pwdMessage && (
          <p
            className={`text-xs ${
              pwdMessage.type === "ok" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {pwdMessage.text}
          </p>
        )}
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
        >
          Actualizar Contraseña
        </button>
      </form>

      <div className="card p-4 border border-slate-800">
        <h3 className="text-sm font-semibold text-slate-100 mb-2">
          Usuarios registrados
        </h3>
        <ul className="space-y-1 text-xs text-slate-200">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5"
            >
              <div>
                <p className="font-medium">
                  {u.username}{" "}
                  <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                    {u.role}
                  </span>
                </p>
                <p className="text-[11px] text-slate-400">{u.name}</p>
              </div>
              {u.role !== "SUPER_ADMIN" && (
                <button
                  type="button"
                  onClick={() => handleDeleteUser(u.id)}
                  className="text-[11px] text-red-400 hover:text-red-300"
                >
                  Eliminar
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
        </div>
      )}

      {activeTab === "desempeno" && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Selector de Analistas */}
          <div className="w-full md:w-1/3 bg-slate-900/60 border border-slate-800 rounded-xl p-4 h-fit">
            <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
              <h3 className="text-sm font-bold text-slate-200">Seleccionar Analista</h3>
              <button
                onClick={handleExportPerfPDF}
                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-bold tracking-wide shadow transition-colors"
              >
                📄 Exportar Global
              </button>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserForPerf(u)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${selectedUserForPerf?.id === u.id ? 'bg-sky-900/40 border-sky-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}
                >
                  {u.fotografia ? (
                    <img src={u.fotografia} alt="foto" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">👤</div>
                  )}
                  <div>
                    <p className="font-bold text-sm text-slate-100">{u.name || u.username}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dashboard Operativo del Analista */}
          <div className="w-full md:w-2/3">
            {!selectedUserForPerf ? (
              <div className="card p-8 text-center text-slate-400 border border-slate-800 border-dashed">
                Selecciona un analista de la lista para visualizar su Identidad Operativa, Análisis FODA y Rendimiento.
              </div>
            ) : (
              <div className="space-y-6">
                {/* ID Card */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 select-none">
                    <span className="text-8xl">🦅</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
                    <div className="w-32 h-32 rounded-xl overflow-hidden border-4 border-slate-700 bg-slate-950 shrink-0 shadow-lg">
                      {selectedUserForPerf?.fotografia ? (
                        <img src={selectedUserForPerf?.fotografia} alt="Foto" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
                      )}
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h2 className="text-2xl font-black text-white tracking-tight">{selectedUserForPerf?.name || selectedUserForPerf?.username}</h2>
                      <p className="text-sky-400 font-bold text-sm tracking-widest uppercase mb-4">{selectedUserForPerf?.grado || "Analista de Inteligencia"}</p>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
                        <div>
                          <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">No. Empleado</p>
                          <p className="text-slate-200 font-medium">{selectedUserForPerf?.id_empleado || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Ingreso CEIPOL</p>
                          <p className="text-slate-200 font-medium">{selectedUserForPerf?.fecha_ingreso || "N/A"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Grado de Estudios</p>
                          <p className="text-slate-200 font-medium">{selectedUserForPerf?.grado_estudio || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Productividad en Vivo */}
                {(() => {
                  const userProjs = projects.filter(p => p.createdBy === selectedUserForPerf?.username);
                  const pAbiertos = userProjs.filter(p => !p.estado || p.estado === "ABIERTO").length;
                  const pRevision = userProjs.filter(p => p.estado === "EN REVISIÓN").length;
                  const pDevueltos = userProjs.filter(p => p.estado === "DEVUELTO").length;
                  const pValidados = userProjs.filter(p => p.estado === "CERRADO" || p.estado === "VALIDADO").length;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 text-center shadow-md"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Abiertos</p><p className="text-2xl font-black text-slate-200">{pAbiertos}</p></div>
                      <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4 text-center shadow-md"><p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1">En Revisión</p><p className="text-2xl font-black text-blue-300">{pRevision}</p></div>
                      <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 text-center shadow-md"><p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1">Devueltos</p><p className="text-2xl font-black text-red-300">{pDevueltos}</p></div>
                      <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 text-center shadow-md"><p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Validados</p><p className="text-2xl font-black text-emerald-300">{pValidados}</p></div>
                    </div>
                  )
                })()}

                {/* Análisis FODA Declarado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 border-b border-emerald-900/50 pb-2">
                      <span className="text-emerald-400 text-lg">⚡</span>
                      <h4 className="font-bold text-emerald-400 tracking-wide">FORTALEZAS</h4>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedUserForPerf?.fortalezas || "No ha declarado fortalezas en su perfil."}</p>
                  </div>
                  <div className="bg-orange-950/10 border border-orange-900/30 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 border-b border-orange-900/50 pb-2">
                      <span className="text-orange-400 text-lg">🎯</span>
                      <h4 className="font-bold text-orange-400 tracking-wide">DEBILIDADES / ÁREAS DE MEJORA</h4>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedUserForPerf?.debilidades || "No ha declarado áreas de oportunidad en su perfil."}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
