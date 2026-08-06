import { calculateUserImi, UserDoc } from "../src/utils/imiEngine";

console.log("=== PRUEBA DE VERIFICACIÓN: LÍNEA BASE CERO IMI ===");

// 1. Caso de usuario SIN actividad (0 proyectos, 0 audit logs)
const userSinActividad: UserDoc = {
  id: "user_test_0",
  username: "RPaez",
  name: "Betsaida Rubi Paez Durón",
  role: "USER"
};

const projectsVacio: any[] = [];
const auditLogsVacio: any[] = [];

const resultZero = calculateUserImi(userSinActividad, projectsVacio, auditLogsVacio);

console.log("\n--- RESULTADO USUARIO SIN ACTIVIDAD ---");
console.log("IMI General:    ", resultZero.imiFinal, "%");
console.log("IMI Operativo:  ", resultZero.imiOperativo, "%");
console.log("IMI Estratégico:", resultZero.imiEstrategico, "%");
console.log("Nivel:          ", resultZero.currentLevel);
console.log("\n--- SUBÍNDICES (DEBEN SER TODOS 0%) ---");
console.log("ICC (Contexto):    ", resultZero.iccScore, "%");
console.log("ISH (Hipótesis):   ", resultZero.ishScore, "%");
console.log("ICA (Correlación): ", resultZero.icaScore, "%");
console.log("IAA (Autonomía):   ", resultZero.iaaScore, "%");
console.log("ICE (Evidencia):   ", resultZero.iceScore, "%");
console.log("IGEO (GEOINT):     ", resultZero.igeoScore, "%");
console.log("IOSINT (OSINT):    ", resultZero.iosintScore, "%");
console.log("IPI (Productividad):", resultZero.ipiScore, "%");

let passed = true;

if (
  resultZero.imiFinal !== 0 ||
  resultZero.imiOperativo !== 0 ||
  resultZero.imiEstrategico !== 0 ||
  resultZero.iccScore !== 0 ||
  resultZero.ishScore !== 0 ||
  resultZero.icaScore !== 0 ||
  resultZero.iaaScore !== 0 ||
  resultZero.iceScore !== 0 ||
  resultZero.igeoScore !== 0 ||
  resultZero.iosintScore !== 0 ||
  resultZero.ipiScore !== 0
) {
  console.error("\n❌ ERROR: Los indicadores no son todos 0%");
  passed = false;
} else {
  console.log("\n✅ PRUEBA 1 SUPERADA: Usuario sin actividad tiene IMI General = 0% y todos sus subíndices en 0%.");
}

// 2. Caso de usuario CON actividad real
const userConActividad: UserDoc = {
  id: "user_test_1",
  username: "analista_activo",
  name: "Analista Activo SSPE",
  role: "USER"
};

const projectsActivo = [
  {
    id: "proj_1",
    createdBy: "analista_activo",
    descripcion: "Análisis de vulnerabilidad ambiental y atractor de riesgo delictivo en sector norte con patrón de movilidad criminógeno. Hipótesis debido a deterioro físico por lo tanto existe origen de foco.",
    estado: "VALIDADO",
    photoCount: 4,
    hasGeoint: true,
    geometryType: "polygon"
  }
];

const logsActivo = [
  { user: "analista_activo", action: "CORRELACION_PANDILLAS", details: "Cruce de vínculo" },
  { user: "analista_activo", action: "BUSQUEDA_OSINT_DENUE", details: "Consulta DENUE" }
];

const resultActivo = calculateUserImi(userConActividad, projectsActivo, logsActivo);

console.log("\n--- RESULTADO USUARIO CON ACTIVIDAD REAL ---");
console.log("IMI General:    ", resultActivo.imiFinal, "%");
console.log("IMI Operativo:  ", resultActivo.imiOperativo, "%");
console.log("IMI Estratégico:", resultActivo.imiEstrategico, "%");
console.log("Nivel:          ", resultActivo.currentLevel);
console.log("Subíndices:      ", {
  ICC: resultActivo.iccScore,
  ISH: resultActivo.ishScore,
  ICA: resultActivo.icaScore,
  IAA: resultActivo.iaaScore,
  ICE: resultActivo.iceScore,
  IGEO: resultActivo.igeoScore,
  IOSINT: resultActivo.iosintScore,
  IPI: resultActivo.ipiScore
});

if (resultActivo.imiFinal > 0) {
  console.log("\n✅ PRUEBA 2 SUPERADA: Usuario con evidencia real incrementa IMI proporcionalmente (", resultActivo.imiFinal, "%).");
} else {
  console.error("\n❌ ERROR: Usuario activo debería tener IMI > 0%");
  passed = false;
}

if (passed) {
  console.log("\n=======================================================");
  console.log("✓ TODAS LAS PRUEBAS DE LÍNEA BASE CERO HAN PASADO EXITOSAMENTE");
  console.log("=======================================================\n");
  process.exit(0);
} else {
  process.exit(1);
}
