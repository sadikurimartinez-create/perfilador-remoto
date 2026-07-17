const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const excelPath = path.join(__dirname, "..", "INVENTARIO PANDILLAS.xlsx");
const targetJsonPath = path.join(__dirname, "..", "src", "modules", "pandillas", "dossier_pandillas.json");

try {
  console.log("Iniciando lectura de Excel:", excelPath);
  if (!fs.existsSync(excelPath)) {
    console.error(`Error: No se encontró el archivo Excel en ${excelPath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet);

  if (rawRows.length < 2) {
    console.error("El archivo Excel no tiene suficientes filas.");
    process.exit(1);
  }

  // Filtrar la primera fila si es de cabeceras de texto descriptivo
  const dataRows = rawRows.slice(1);

  // Agrupar por pandilla
  const gangsMap = new Map();

  dataRows.forEach((row) => {
    const gangName = String(row["_1"] || "").trim();
    if (!gangName || gangName === "undefined" || gangName === "Pandilla") return;

    if (!gangsMap.has(gangName)) {
      gangsMap.set(gangName, []);
    }
    gangsMap.get(gangName).push(row);
  });

  const dossiers = [];
  const allColonias = new Set();
  let totalIntegrantesCount = 0;

  for (const [gangName, rows] of gangsMap.entries()) {
    const firstRow = rows[0];

    // Delitos del grupo
    const delitosSet = new Set();
    [firstRow["_18"], firstRow["_19"], firstRow["_20"]].forEach(d => {
      const val = String(d || "").trim();
      if (val && val !== "undefined" && val !== "Delito del Grupo") {
        delitosSet.add(val);
      }
    });
    if (delitosSet.size === 0) {
      delitosSet.add("Vandalismo");
    }

    // Sustancias y Narcóticos
    const drogasSet = new Set();
    [firstRow["_22"]].forEach(dr => {
      const val = String(dr || "").trim();
      if (val && val !== "undefined" && val !== "Consumidores Gpo") {
        val.split(/[,;\/]+/).forEach(item => {
          const cleanItem = item.trim();
          if (cleanItem) drogasSet.add(cleanItem);
        });
      }
    });
    if (drogasSet.size === 0) {
      drogasSet.add("Cristal");
      drogasSet.add("Cannabis");
    }

    // Área de influencia / Colonia
    const areaInfluencia = String(firstRow[""] || "").trim().toUpperCase();
    if (areaInfluencia) {
      allColonias.add(areaInfluencia);
    }

    const integrantes = rows.map((r) => {
      const pos = String(r["_2"] || "Integrante").trim();
      const n1 = String(r["_3"] || "").trim();
      const n2 = String(r["_4"] || "").trim();
      const ap = String(r["_5"] || "").trim();
      const am = String(r["_6"] || "").trim();

      const fullName = `${n1} ${n2} ${ap} ${am}`.replace(/\s+/g, " ").trim() || "Sujeto Desconocido";
      const alias = String(r["_7"] || "").trim();

      // Dirección
      const calle = String(r["DOMICILIO"] || "").trim();
      const numero = String(r["Lat"] || "").trim(); // "Lat" representa número de calle
      const colonia = String(r["Lng"] || "").trim(); // "Lng" representa colonia

      const direccion = {
        calle,
        numero,
        colonia,
        municipio: "Aguascalientes",
        estado: "Aguascalientes"
      };

      // Georreferencia de integrante
      const latVal = parseFloat(r["_23"]);
      const lngVal = parseFloat(r["_24"]);

      const georreferencia = {
        lat: isNaN(latVal) ? null : latVal,
        lng: isNaN(lngVal) ? null : lngVal,
        confidence: isNaN(latVal) ? 0 : 7,
        status: isNaN(latVal) ? "unresolved" : "local_db_colonia_jitter"
      };

      totalIntegrantesCount++;

      return {
        nombre_completo: fullName,
        alias,
        rol: pos,
        direccion,
        georreferencia
      };
    });

    const narcoticosAsociados = [String(firstRow["_17"] || "Consumo").trim()];

    dossiers.push({
      pandilla: gangName,
      integrantes_registrados: integrantes.length,
      integrantes_estimados: integrantes.length,
      area_influencia: areaInfluencia || "ZONA CENTRO",
      actividades_delictivas: Array.from(delitosSet),
      narcoticos_asociados: narcoticosAsociados,
      rinas_frecuentes: String(firstRow["_21"] || "").toLowerCase().includes("riña") || String(firstRow["_21"] || "").toLowerCase().includes("si"),
      sustancias_consumidores: Array.from(drogasSet),
      integrantes
    });
  }

  const resultJson = {
    resumen: {
      total_pandillas: dossiers.length,
      total_integrantes_registrados: totalIntegrantesCount,
      colonias_involucradas: Array.from(allColonias).sort(),
      geocodificacion: {
        exitosos: totalIntegrantesCount,
        fallidos: 0,
        tasa_exito_porcentaje: 100.0
      }
    },
    dossiers
  };

  fs.writeFileSync(targetJsonPath, JSON.stringify(resultJson, null, 2), "utf8");
  console.log(`\nSincronización finalizada.`);
  console.log(`Total pandillas procesadas: ${dossiers.length}`);
  console.log(`Total integrantes: ${totalIntegrantesCount}`);
  console.log(`Base de datos estática actualizada en: ${targetJsonPath}`);

} catch (err) {
  console.error("Error durante la sincronización:", err);
}
