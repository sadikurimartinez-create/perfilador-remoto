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

type UserDoc = {
  id: string;
  username: string;
  role: string;
  name: string;
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
  const [activeTab, setActiveTab] = useState<"supervision" | "usuarios">("supervision");
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
    </div>
  );
}
