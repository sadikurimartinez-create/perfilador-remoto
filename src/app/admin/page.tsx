"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
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
import { ImiDashboard } from "@/components/ImiDashboard";

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
  aniosSspe?: string;
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
  const { restoreDoc, logAuditAction } = useProject();
  const [activeTab, setActiveTab] = useState<"supervision" | "usuarios" | "desempeno" | "papelera" | "auditoria">("supervision");
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

  // Estados para Papelera y Auditoría
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditModuleFilter, setAuditModuleFilter] = useState("TODOS");
  const [auditResultFilter, setAuditResultFilter] = useState("TODOS");

  // Estados para Supervisión
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [checklist, setChecklist] = useState<boolean[]>([false, false, false, false, false]);
  const [feedback, setFeedback] = useState("");
  const [plazoDevolucion, setPlazoDevolucion] = useState<number>(24);
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

    const unsubTrash = onSnapshot(collection(db, "trash"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTrashItems(list.sort((a: any, b: any) => (b.deletedAt || 0) - (a.deletedAt || 0)));
    });

    const unsubAudit = onSnapshot(collection(db, "audit_logs"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAuditLogs(list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0)));
    });

    let unsubUsers = () => {};
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
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
            aniosSspe: data.aniosSspe || "",
          };
        })
        .sort((a, b) => b.id.localeCompare(a.id));
      setUsers(list);
    });
    }

    return () => {
      unsubProjects();
      unsubTrash();
      unsubAudit();
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

  const handleRestoreDoc = async (itemId: string, type: string, name: string) => {
    try {
      await restoreDoc(itemId);
      alert(`El elemento "${name}" (${type}) ha sido restaurado exitosamente.`);
    } catch (err: any) {
      alert("Error al restaurar elemento: " + err.message);
    }
  };

  const handleDefinitiveDelete = async (item: any) => {
    if (!confirm("¿Está seguro de eliminar DEFINITIVAMENTE este registro? Esta acción es totalmente irreversible y quedará registrada en auditoría.")) return;
    try {
      const db = getDb();
      // 1. Borrar de la colección de la papelera
      await deleteDoc(doc(db, "trash", item.id));
      // 2. Borrar permanentemente el documento original
      await deleteDoc(doc(db, item.originalPath));

      await logAuditAction({
        action: "ELIMINACION_DEFINITIVA",
        module: "Papelera",
        projectId: item.projectId || item.originalId,
        projectName: item.projectCeipolId || item.name,
        result: "ÉXITO",
        details: `Eliminación definitiva de ${item.type} "${item.name}" tras vencimiento de papelera.`
      });
      alert("Elemento eliminado definitivamente.");
    } catch (err: any) {
      alert("Error en eliminación definitiva: " + err.message);
    }
  };

  const handleExportPerfPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    // 1. Cabecera Ejecutiva
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE INSTITUCIONAL DEL ÍNDICE DE MADUREZ INVESTIGATIVA", 14, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Plataforma Perfilador Remoto de Geointeligencia - SSP / CEIPOL", 14, y);
    y += 6;
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString("es-MX")} - ${new Date().toLocaleTimeString("es-MX")}`, 14, y);
    y += 6;
    doc.text(`Generado por: ${user?.name || user?.username} (${user?.role})`, 14, y);
    y += 8;

    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, 196, y);
    y += 10;

    // 2. Resumen Global de la Población de Analistas
    const totalProjs = projects.length;
    const totalValidados = projects.filter(p => p.estado === "CERRADO" || p.estado === "VALIDADO").length;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("SINOPSIS METODOLÓGICA", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fuerza Analítica Total: ${users.length} analistas`, 14, y);
    doc.text(`Expedientes Totales: ${totalProjs}`, 80, y);
    doc.text(`Expedientes Validados: ${totalValidados}`, 140, y);
    y += 10;

    // 3. Tabla de Desempeño IMI (Iterando sobre usuarios con el Motor Matemático Oficial)
    const drawHeaders = (posY: number) => {
      doc.setFillColor(15, 23, 42); // slate-900 look for header
      doc.rect(14, posY, 182, 8, "F");
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("ANALISTA", 16, posY + 5.5);
      doc.text("ID EMPLEADO", 65, posY + 5.5);
      doc.text("TOTAL EXP", 92, posY + 5.5);
      doc.text("IMI GRAL", 115, posY + 5.5);
      doc.text("IMI OPER", 137, posY + 5.5);
      doc.text("IMI ESTRAT", 160, posY + 5.5);
      doc.text("NIVEL", 182, posY + 5.5);
      doc.setTextColor(0, 0, 0); // reset
      doc.setFont("helvetica", "normal");
    };

    drawHeaders(y);
    y += 13;

    users.forEach((u) => {
      if (y > 275) { doc.addPage(); y = 20; drawHeaders(y); y += 13; }
      
      const userProjs = projects.filter(p => p.createdBy === u.username);
      const totalProjects = userProjs.length;
      const pAbiertos = userProjs.filter(p => !p.estado || p.estado === "ABIERTO").length;
      const pRevision = userProjs.filter(p => p.estado === "EN REVISIÓN").length;
      const pDevueltos = userProjs.filter(p => p.estado === "DEVUELTO").length;
      const pValidados = userProjs.filter(p => p.estado === "CERRADO" || p.estado === "VALIDADO").length;

      const userLogs = auditLogs.filter(
        (log) => log.user === u.username || log.userId === u.id
      );

      // MOTOR DE METRICAS
      const avgDescLen = totalProjects > 0
        ? userProjs.reduce((sum, p) => sum + (p.descripcion?.length || 0), 0) / totalProjects
        : 0;

      const analyticalKeywords = [
        "vulnerabilidad", "atractor", "patrón", "riesgo", "osint", "geoint", 
        "hipótesis", "criminógeno", "acecho", "movilidad", "rutina", "rutinas", 
        "conexiones", "ambiente", "delictivo", "entorno", "focalizado", "análisis"
      ];
      let keywordMatches = 0;
      userProjs.forEach((p) => {
        const desc = (p.descripcion || "").toLowerCase();
        analyticalKeywords.forEach((kw) => {
          if (desc.includes(kw)) keywordMatches++;
        });
      });

      const iccScore = Math.max(
        10,
        Math.min(
          100,
          totalProjects === 0
            ? 45
            : Math.round((avgDescLen / 250) * 55 + Math.min(45, keywordMatches * 3))
        )
      );

      let logicalConnectives = 0;
      userProjs.forEach((p) => {
        const desc = (p.descripcion || "").toLowerCase();
        ["porque", "debido a", "consecuencia", "por lo tanto", "causal", "hipótesis", "origen", "foco", "razon", "motivo", "factor"].forEach(
          (conn) => {
            if (desc.includes(conn)) logicalConnectives++;
          }
        );
      });
      const ishScore = Math.max(
        10,
        Math.min(
          100,
          totalProjects === 0
            ? 45
            : Math.round(50 + logicalConnectives * 5 + pValidados * 8 - pDevueltos * 6)
        )
      );

      const correlationActions = userLogs.filter((log) => {
        const act = (log.action || log.details || "").toLowerCase();
        return (
          act.includes("vínculo") || act.includes("conexion") || act.includes("correlación") ||
          act.includes("pandillas") || act.includes("mapa") || act.includes("asociación") ||
          act.includes("cruce") || act.includes("coincidencia")
        );
      }).length;
      const icaScore = Math.max(
        10,
        Math.min(
          100,
          totalProjects === 0 ? 45 : Math.round(45 + correlationActions * 8 + totalProjects * 3)
        )
      );

      const iaaScore = Math.max(
        20,
        Math.min(
          100,
          totalProjects === 0
            ? 75
            : Math.round(100 - pDevueltos * 10 + Math.min(15, avgDescLen / 15))
        )
      );

      const evidenceCount = userProjs.reduce((sum, p) => sum + (p.photoCount || 2), 0);
      const iceScore = Math.max(
        15,
        Math.min(
          100,
          totalProjects === 0
            ? 40
            : Math.round(Math.min(100, (evidenceCount / (totalProjects * 2 + 1)) * 40 + 40))
        )
      );

      const geointProjects = userProjs.filter(
        (p) => (p.geometryType && p.geometryType !== "individual") || p.latitud || p.coordenadas
      ).length;
      const igeoScore = Math.max(
        15,
        Math.min(
          100,
          totalProjects === 0 ? 45 : Math.round(50 + geointProjects * 15 + totalProjects * 3)
        )
      );

      const osintKeywords = ["osint", "curp", "rfc", "denue", "registro", "búsqueda", "consulta", "fuente", "osint-query"];
      let osintQueriesCount = userLogs.filter((log) => {
        const act = (log.action || log.details || "").toLowerCase();
        return osintKeywords.some((kw) => act.includes(kw));
      }).length;
      const iosintScore = Math.max(
        15,
        Math.min(
          100,
          totalProjects === 0 ? 45 : Math.round(48 + osintQueriesCount * 8 + totalProjects * 3)
        )
      );

      const completionRate = totalProjects > 0 ? pValidados / totalProjects : 0;
      const ipiScore = Math.max(
        10,
        Math.min(
          100,
          totalProjects === 0
            ? 40
            : Math.round(completionRate * 50 + pValidados * 8 + totalProjects * 2)
        )
      );

      const yearsSSPE = parseInt(u.aniosSspe || "0", 10);
      let rawExperiencePoints = totalProjects * 0.8 + pValidados * 1.5 + yearsSSPE * 1.2;
      const componentsBaseScore =
        iccScore * 0.20 +
        ishScore * 0.15 +
        icaScore * 0.15 +
        iaaScore * 0.10 +
        iceScore * 0.10 +
        igeoScore * 0.10 +
        iosintScore * 0.10 +
        ipiScore * 0.10;
      const experienceCapFactor = componentsBaseScore < 45 ? 0.3 : componentsBaseScore < 60 ? 0.7 : 1.0;
      const finalExperiencePoints = Math.min(15, Math.round(rawExperiencePoints * experienceCapFactor * 10) / 10);

      const recentProjects = userProjs.filter((p) => {
        if (!p.createdAt) return false;
        const diffMs = Date.now() - p.createdAt;
        return diffMs <= 30 * 24 * 60 * 60 * 1000;
      });
      let trend: "Crecimiento" | "Estable" | "Retroceso" = "Estable";
      let improvementBonus = 0;
      if (totalProjects > 2) {
        if (recentProjects.length > 0) {
          const avgRecentDesc = recentProjects.reduce((sum, p) => sum + (p.descripcion?.length || 0), 0) / recentProjects.length;
          if (avgRecentDesc > avgDescLen * 1.1) {
            trend = "Crecimiento";
            improvementBonus = 4;
          } else if (avgRecentDesc < avgDescLen * 0.9) {
            trend = "Retroceso";
          }
        }
      }

      let penaltyDeductions = 0;
      if (avgDescLen < 120 && totalProjects > 0) penaltyDeductions += 4;
      if (pDevueltos > pValidados && totalProjects > 1) penaltyDeductions += 5;
      if (evidenceCount < totalProjects && totalProjects > 0) penaltyDeductions += 3;
      if (logicalConnectives === 0 && totalProjects > 0) penaltyDeductions += 3;
      if (iaaScore < 50 && totalProjects > 0) penaltyDeductions += 2;

      const imiBase = componentsBaseScore * 0.85 + finalExperiencePoints;
      const imiFinal = Math.max(0, Math.min(100, Math.round(imiBase + improvementBonus - penaltyDeductions)));

      const imiOperativo = Math.round(iccScore * 0.40 + iceScore * 0.30 + ipiScore * 0.30);
      const imiEstrategico = Math.round(ishScore * 0.25 + icaScore * 0.25 + igeoScore * 0.20 + iosintScore * 0.20 + iaaScore * 0.10);

      const getImiLevel = (score: number) => {
        if (score >= 81) return "Experto";
        if (score >= 61) return "Avanzado";
        if (score >= 41) return "Intermedio";
        if (score >= 21) return "Básico";
        return "Inicial";
      };
      const currentLevel = getImiLevel(imiFinal);

      const name = (u.name || u.username).substring(0, 24);
      doc.text(name, 16, y);
      doc.text(u.id_empleado || "N/A", 65, y);
      doc.text(String(totalProjects), 95, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${imiFinal}%`, 117, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${imiOperativo}%`, 140, y);
      doc.text(`${imiEstrategico}%`, 163, y);
      doc.text(currentLevel, 182, y);
      
      y += 4;
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y, 196, y);
      y += 7;
    });

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Nota: El IMI se calcula a partir de 8 subíndices ponderados (85%) y experiencia histórica de campo (15%).", 14, y + 4);

    doc.save(`Desempeño_IMI_Analistas_${new Date().getTime()}.pdf`);
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
        comentariosAuditoria: feedback,
        comentariosSupervisor: feedback,
        fechaDevolucion: Date.now(),
        deadlineAt: Date.now() + (plazoDevolucion * 60 * 60 * 1000),
        devueltoPor: user.name || user.username,
        fechaEvaluacion: Date.now(),
      });
      setEvaluationMsg({ type: "ok", text: "Expediente DEVUELTO al analista con observaciones." });
      setTimeout(() => setSelectedProject(null), 1500);
    } catch (err: any) {
      setEvaluationMsg({ type: "error", text: err?.message || "Error al devolver el expediente." });
    }
  };

  const expedientesPendientes = projects.filter(p => 
    p.estado === "EN REVISIÓN" || 
    p.estado === "EN AUDITORÍA" || 
    ((!p.estado || p.estado === "ABIERTO") && p.printedAt && ((Date.now() - p.printedAt) / (1000 * 60 * 60) > 24))
  );
  const aprobados = projects.filter(p => p.estado === "CERRADO" || p.estado === "VALIDADO").length;
  const devueltos = projects.filter(p => p.estado === "DEVUELTO").length;

  const getRemainingTime = (expiresAt?: number) => {
    if (!expiresAt) return { text: "7d 0h", critical: false };
    const diff = expiresAt - Date.now();
    if (diff <= 0) return { text: "Expirado (Listo para purga)", critical: true };
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days === 0) {
      const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      return { text: `${hours}h ${minutes}m`, critical: true };
    }
    return { text: `${days}d ${hours}h`, critical: false };
  };

  const handleExportCSV = () => {
    const headers = [
      "Fecha",
      "Hora",
      "Usuario",
      "Nombre",
      "Rol",
      "Modulo",
      "Accion",
      "Resultado",
      "Direccion IP",
      "Detalles"
    ];

    const escapeCSVCell = (val: any) => {
      if (val === null || val === undefined) return "";
      let str = String(val);
      str = str.replace(/"/g, '""');
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str}"`;
      }
      return str;
    };

    const rows = auditLogs.map(log => [
      log.date || "",
      log.time || "",
      log.user || "",
      log.userName || "",
      log.userRole || "",
      log.module || "",
      log.action || "",
      log.result || "",
      log.ip || "",
      log.details || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(escapeCSVCell).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bitacora_auditoria_ceipol_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

      <div className="flex gap-4 border-b border-slate-800 pb-2 overflow-x-auto whitespace-nowrap">
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
        <button
          onClick={() => setActiveTab("papelera")}
          className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === "papelera" ? "border-amber-500 text-amber-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
        >
          ♻️ Papelera de Reciclaje
        </button>
        <button
          onClick={() => setActiveTab("auditoria")}
          className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === "auditoria" ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
        >
          📜 Auditoría Central
        </button>
      </div>

      {/* Alerta de Expiración Preventiva (Papelera) */}
      {(() => {
        const criticalCount = trashItems.filter((item) => {
          const diff = (item.expiresAt || 0) - Date.now();
          return diff > 0 && diff <= 24 * 60 * 60 * 1000;
        }).length;

        if (criticalCount === 0) return null;

        return (
          <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-4 flex items-start gap-3 shadow-lg text-red-300 animate-pulse">
            <span className="text-xl">🚨</span>
            <div className="flex-1 space-y-1">
              <h4 className="font-bold text-sm text-red-400">Atención: Eliminación Definitiva Inminente</h4>
              <p className="text-xs text-slate-300">
                Hay <span className="font-bold text-red-400">{criticalCount}</span> elemento(s) en la papelera de reciclaje con <span className="text-red-400 font-semibold">menos de 24 horas restantes</span> antes de ser eliminados permanentemente del sistema sin posibilidad de recuperación.
              </p>
              <button
                onClick={() => setActiveTab("papelera")}
                className="text-xs text-red-400 font-semibold hover:text-red-300 hover:underline mt-1 block text-left"
              >
                Ir a la Papelera de Reciclaje →
              </button>
            </div>
          </div>
        );
      })()}

      {activeTab === "supervision" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-center items-center shadow-md">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">En Revisión (Pendientes)</p>
              <p className="text-3xl font-bold mt-2 text-amber-400">{expedientesPendientes.length}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-center items-center shadow-md">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Validaciones Globales</p>
              <p className="text-3xl font-bold mt-2 text-emerald-400">{aprobados}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-center items-center shadow-md">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Devoluciones Activas</p>
              <p className="text-3xl font-bold mt-2 text-red-400">{devueltos}</p>
            </div>
          </div>

          {!selectedProject ? (
            <div className="card border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-100 mb-3">Bandeja de Entrada: Pendientes de Auditoría</h3>
              {expedientesPendientes.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-900/50 p-4 rounded-lg text-center border border-slate-800/50">No hay expedientes pendientes de validación en este momento.</p>
              ) : (
                <ul className="space-y-2">
                  {expedientesPendientes.map(p => (
                    <li key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 border border-slate-800 p-3 rounded-lg gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <p className="font-semibold text-sm text-slate-200">{p.name || p.nombre || "Expediente Sin Nombre"}</p>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            p.estado === "EN REVISIÓN" ? "bg-blue-900/60 text-blue-400 border border-blue-700" :
                            p.estado === "EN AUDITORÍA" ? "bg-purple-900/60 text-purple-400 border border-purple-700" :
                            "bg-slate-700 text-slate-300 border border-slate-500"
                          }`}>
                            {p.estado === "EN REVISIÓN" ? "En Revisión" : p.estado === "EN AUDITORÍA" ? "En Auditoría" : "Cerrado (24h)"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Analista: <span className="text-slate-300 font-medium">{p.createdBy || "Desconocido"}</span></p>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/project/${p.id}`}
                          className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded text-xs font-semibold shadow transition-colors flex items-center"
                        >
                          👁️ Ver
                        </Link>
                        <button
                          onClick={() => openEvaluation(p)}
                          className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-semibold shadow transition-colors flex items-center"
                        >
                          📋 Evaluar
                        </button>
                      </div>
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

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="text-xs text-slate-300 font-medium">Término para subsanar (en caso de devolución):</label>
                <select
                  value={plazoDevolucion}
                  onChange={(e) => setPlazoDevolucion(Number(e.target.value))}
                  className="bg-slate-950 text-slate-200 border border-slate-700 rounded-md px-2 py-1 text-xs focus:ring-sky-500 outline-none"
                >
                  <option value={24}>24 horas</option>
                  <option value={48}>48 horas</option>
                  <option value={72}>72 horas</option>
                </select>
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
                      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 text-center shadow-md">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Abiertos</p>
                        <p className="text-2xl font-black text-slate-200">{pAbiertos}</p>
                      </div>
                      <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4 text-center shadow-md">
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1">En Revisión</p>
                        <p className="text-2xl font-black text-blue-300">{pRevision}</p>
                      </div>
                      <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 text-center shadow-md">
                        <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1">Devueltos</p>
                        <p className="text-2xl font-black text-red-300">{pDevueltos}</p>
                      </div>
                      <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 text-center shadow-md">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Validados</p>
                        <p className="text-2xl font-black text-emerald-300">{pValidados}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Sistema IMI de Evaluación de Madurez Investigativa */}
                <ImiDashboard
                  selectedUser={selectedUserForPerf}
                  projects={projects}
                  auditLogs={auditLogs}
                  allUsers={users}
                />

              </div>
            )}
          </div>
        </div>
      )}

      {/* Papelera de Reciclaje Tab Body */}
      {activeTab === "papelera" && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>♻️</span> Papelera de Reciclaje Institucional
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              De acuerdo con las normativas de preservación de evidencia y gobernanza de la información, los elementos eliminados (proyectos, fotografías o documentos) no se borran de inmediato. Permanecen bajo resguardo temporal por <strong className="text-amber-400">7 días naturales (168 horas)</strong> para permitir su recuperación. Después de este plazo, se vuelven elegibles para eliminación definitiva irreversible.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200">
                Elementos bajo Resguardo Temporal ({trashItems.length})
              </h4>
            </div>

            {trashItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border-t border-slate-800 border-dashed text-xs">
                No hay elementos en la papelera de reciclaje actualmente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800">
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Nombre / Folio</th>
                      <th className="p-3">Eliminado por</th>
                      <th className="p-3">Fecha de Eliminación</th>
                      <th className="p-3">Justificación / Motivo</th>
                      <th className="p-3">Tiempo Restante</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {trashItems.map((item) => {
                      const timeInfo = getRemainingTime(item.expiresAt);
                      return (
                        <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.type === "Proyecto" ? "bg-blue-900/40 text-blue-400 border border-blue-800/50" :
                              item.type === "Fotografía" ? "bg-purple-900/40 text-purple-400 border border-purple-800/50" :
                              "bg-orange-900/40 text-orange-400 border border-orange-800/50"
                            }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="p-3 font-medium">
                            <p className="text-slate-200 font-bold">{item.name}</p>
                            {item.projectCeipolId && (
                              <p className="text-[10px] text-slate-400">CEIPOL: {item.projectCeipolId}</p>
                            )}
                          </td>
                          <td className="p-3 text-slate-400">
                            {item.deletedBy || "N/A"}
                          </td>
                          <td className="p-3 text-slate-400">
                            {item.deletedAt ? new Date(item.deletedAt).toLocaleString("es-MX") : "N/A"}
                          </td>
                          <td className="p-3 text-slate-400 max-w-[200px] truncate" title={item.deletionReason}>
                            {item.deletionReason || "Sin justificación"}
                          </td>
                          <td className="p-3 font-medium">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              timeInfo.critical
                                ? "bg-red-950/40 text-red-400 border border-red-800 animate-pulse"
                                : "bg-slate-800/60 text-slate-300 border border-slate-700"
                            }`}>
                              {timeInfo.critical ? "🚨 " : ""}{timeInfo.text}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => handleRestoreDoc(item.id, item.type, item.name)}
                              className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2.5 py-1 rounded text-[11px] font-semibold border border-emerald-700/50 transition-all inline-flex items-center gap-1"
                            >
                              ♻️ Restaurar
                            </button>
                            <button
                              onClick={() => handleDefinitiveDelete(item)}
                              className="bg-red-950/20 hover:bg-red-600 text-red-400 hover:text-white px-2.5 py-1 rounded text-[11px] font-semibold border border-red-900/50 transition-all inline-flex items-center gap-1"
                            >
                              🗑️ Eliminar Definitivo
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
        </div>
      )}

      {/* Auditoría Central Tab Body */}
      {activeTab === "auditoria" && (() => {
        const filteredLogs = auditLogs.filter((log) => {
          const matchesSearch =
            !auditSearch.trim() ||
            String(log.user || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
            String(log.userName || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
            String(log.details || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
            String(log.action || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
            String(log.module || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
            String(log.ip || "").toLowerCase().includes(auditSearch.toLowerCase());

          const matchesModule =
            auditModuleFilter === "TODOS" ||
            String(log.module || "").toUpperCase() === auditModuleFilter.toUpperCase();

          const matchesResult =
            auditResultFilter === "TODOS" ||
            String(log.result || "").toUpperCase() === auditResultFilter.toUpperCase();

          return matchesSearch && matchesModule && matchesResult;
        });

        const availableModules = Array.from(
          new Set(auditLogs.map((l) => String(l.module || "").toUpperCase()))
        ).filter(Boolean);

        return (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>📜</span> Bitácora de Auditoría Central (CEIPOL)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Registro criptográfico e inalterable de accesos, intentos de intrusión, modificaciones, eliminaciones y descargas de información de inteligencia.
                </p>
              </div>
              <button
                onClick={handleExportCSV}
                className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-xs font-bold tracking-wide shadow-lg transition-colors flex items-center gap-2 shrink-0 self-start md:self-center"
              >
                📥 Exportar Bitácora en CSV
              </button>
            </div>

            {/* Controles de Filtro */}
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Buscar en Bitácora</label>
                <input
                  type="text"
                  placeholder="Buscar usuario, IP, acción o detalles..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Filtrar por Módulo</label>
                <select
                  value={auditModuleFilter}
                  onChange={(e) => setAuditModuleFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:border-sky-500 outline-none transition-all"
                >
                  <option value="TODOS">Todos los Módulos</option>
                  {availableModules.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Filtrar por Resultado</label>
                <select
                  value={auditResultFilter}
                  onChange={(e) => setAuditResultFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:border-sky-500 outline-none transition-all"
                >
                  <option value="TODOS">Todos los Resultados</option>
                  <option value="ÉXITO">ÉXITO</option>
                  <option value="FALLO">FALLO</option>
                  <option value="BLOQUEADO">BLOQUEADO</option>
                </select>
              </div>
            </div>

            {/* Tabla de Auditoría */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-md">
              <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-200">
                  Eventos de Seguridad Registrados ({filteredLogs.length})
                </h4>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border-t border-slate-800 border-dashed text-xs">
                  No se encontraron eventos coincidentes con los filtros de búsqueda.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-950 text-slate-400 font-bold border-b border-slate-800 z-10">
                      <tr>
                        <th className="p-3 bg-slate-950">Fecha / Hora</th>
                        <th className="p-3 bg-slate-950">Usuario / Rol</th>
                        <th className="p-3 bg-slate-950">Módulo</th>
                        <th className="p-3 bg-slate-950">Acción</th>
                        <th className="p-3 bg-slate-950">Origen IP</th>
                        <th className="p-3 bg-slate-950">Resultado</th>
                        <th className="p-3 bg-slate-950">Detalles de Operación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {log.date} {log.time}
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-200">{log.user}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold uppercase tracking-wider ${
                                log.userRole === "SUPER_ADMIN" ? "bg-red-900/30 text-red-400 border border-red-800/40" :
                                log.userRole === "ADMIN" ? "bg-amber-900/30 text-amber-400 border border-amber-800/40" :
                                "bg-slate-800 text-slate-400 border border-slate-700/50"
                              }`}>
                                {log.userRole || "USER"}
                              </span>
                              {log.userName && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={log.userName}>
                                  {log.userName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-300 font-medium whitespace-nowrap">
                            {log.module}
                          </td>
                          <td className="p-3 font-bold text-slate-300 whitespace-nowrap">
                            {log.action}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-400">
                            {log.ip || "127.0.0.1"}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              log.result === "ÉXITO" ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800/50" :
                              log.result === "FALLO" ? "bg-red-900/40 text-red-400 border border-red-800/50" :
                              "bg-red-950/60 text-red-400 border border-red-800 animate-pulse font-extrabold"
                            }`}>
                              {log.result || "ÉXITO"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 max-w-[320px] whitespace-normal break-words leading-relaxed">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
