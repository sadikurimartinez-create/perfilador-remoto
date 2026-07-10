import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

export type CrimeValidationReport = {
  success: boolean;
  folderFound: boolean;
  folderPath: string;
  totalFiles: number;
  totalRecords: number;
  yearMin: number;
  yearMax: number;
  columnsStatus: "OK" | "FAIL";
  missingColumns: string[];
  georefStatus: "OK" | "FAIL";
  duplicateCount: number;
  delitosList: string[];
  reportMessage: string;
};

export class CrimeDatasetValidationEngine {
  public static validate(): CrimeValidationReport {
    const projectRoot = process.cwd();
    // Search folders in order
    const candidates = [
      "C:\\Users\\sadi7\\OneDrive\\Desktop\\ECOSISTEMA SAI\\PERFIL REMOTO\\Historial SHAPES\\SELECCION PERFILADOR - INCIDENCIA DELICTIVA",
      path.join(projectRoot, "Historial SHAPES", "SELECCION PERFILADOR - INCIDENCIA DELICTIVA"),
      path.join(projectRoot, "Incidencia Delictiva")
    ];

    let activeDir = "";
    for (const dir of candidates) {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        activeDir = dir;
        break;
      }
    }

    if (!activeDir) {
      return {
        success: false,
        folderFound: false,
        folderPath: "",
        totalFiles: 0,
        totalRecords: 0,
        yearMin: 0,
        yearMax: 0,
        columnsStatus: "FAIL",
        missingColumns: ["FECHA", "INCIDENTE", "LAT", "LON", "NOM_ASEN"],
        georefStatus: "FAIL",
        duplicateCount: 0,
        delitosList: [],
        reportMessage: "No se encontró ninguna de las carpetas de incidencia delictiva especificadas en la raíz del proyecto."
      };
    }

    let files: string[] = [];
    try {
      files = fs.readdirSync(activeDir)
        .filter(f => f.toLowerCase().endsWith(".csv"))
        .map(f => path.join(activeDir, f));
    } catch (err: any) {
      return {
        success: false,
        folderFound: true,
        folderPath: activeDir,
        totalFiles: 0,
        totalRecords: 0,
        yearMin: 0,
        yearMax: 0,
        columnsStatus: "FAIL",
        missingColumns: [],
        georefStatus: "FAIL",
        duplicateCount: 0,
        delitosList: [],
        reportMessage: `Error al leer la carpeta de incidencia delictiva: ${err.message}`
      };
    }

    let totalRecords = 0;
    let yearMin = 9999;
    let yearMax = 0;
    const delitosSet = new Set<string>();
    let duplicates = 0;
    const seenIds = new Set<string>();
    
    // Column checks
    let hasFecha = false;
    let hasDelito = false;
    let hasLat = false;
    let hasLon = false;
    let hasColonia = false;
    
    let totalGeorefCount = 0;
    let invalidGeorefCount = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf8");
        const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
        const rows = parsed.data as any[];
        totalRecords += rows.length;

        for (const row of rows) {
          // Check columns presence
          if (!hasFecha && (row.FECHA || row.fecha || row.Fecha)) hasFecha = true;
          if (!hasDelito && (row.INCIDENTE || row.incidente || row.delito || row.DELITO)) hasDelito = true;
          if (!hasLat && (row.LAT || row.lat || row.Latitude || row.Latitude)) hasLat = true;
          if (!hasLon && (row.LON || row.lon || row.LONG || row.longitude || row.Long)) hasLon = true;
          if (!hasColonia && (row.NOM_ASEN || row.colonia || row.Colonia || row.NOM_ASEN)) hasColonia = true;

          // Delitos set
          const delito = row.INCIDENTE || row.incidente || row.delito || row.DELITO || path.basename(file, ".csv");
          if (delito) delitosSet.add(String(delito).toUpperCase().trim());

          // Date check for years (period 2015-present)
          const dateStr = row.FECHA || row.fecha || row.Fecha;
          if (dateStr) {
            const yearMatch = String(dateStr).match(/\b(20\d{2})\b/);
            if (yearMatch) {
              const yr = parseInt(yearMatch[1], 10);
              if (yr >= 2010 && yr <= 2030) {
                if (yr < yearMin) yearMin = yr;
                if (yr > yearMax) yearMax = yr;
              }
            }
          }

          // Duplicate checks (using FOLIO or combination of FECHA+LAT+LON)
          const rowId = row.FOLIO || row.folio || `${dateStr}_${row.LAT}_${row.LON}`;
          if (rowId) {
            if (seenIds.has(rowId)) {
              duplicates++;
            } else {
              seenIds.add(rowId);
            }
          }

          // Georeferencing checks
          const latVal = parseFloat(row.LAT ?? row.lat ?? row.Latitude);
          const lonVal = parseFloat(row.LON ?? row.lon ?? row.LONG ?? row.longitude ?? row.Long);
          totalGeorefCount++;
          if (isNaN(latVal) || isNaN(lonVal) || latVal === 0 || lonVal === 0) {
            invalidGeorefCount++;
          }
        }
      } catch (e) {
        // ignore single file parse errors
      }
    }

    const missingColumns: string[] = [];
    if (!hasFecha) missingColumns.push("FECHA");
    if (!hasDelito) missingColumns.push("INCIDENTE/DELITO");
    if (!hasLat) missingColumns.push("LAT");
    if (!hasLon) missingColumns.push("LON/LONG");
    if (!hasColonia) missingColumns.push("COLONIA/NOM_ASEN");

    const columnsStatus = missingColumns.length === 0 ? "OK" : "FAIL";
    const georefStatus = invalidGeorefCount / (totalGeorefCount || 1) < 0.1 ? "OK" : "FAIL";

    if (yearMin === 9999) yearMin = 2015;
    if (yearMax === 0) yearMax = 2026;

    return {
      success: columnsStatus === "OK",
      folderFound: true,
      folderPath: activeDir,
      totalFiles: files.length,
      totalRecords,
      yearMin,
      yearMax,
      columnsStatus,
      missingColumns,
      georefStatus,
      duplicateCount: duplicates,
      delitosList: Array.from(delitosSet).slice(0, 15),
      reportMessage: columnsStatus === "OK" 
        ? "El archivo histórico de incidencia delictiva se procesa de manera óptima." 
        : `Faltan las siguientes columnas estructurales requeridas: ${missingColumns.join(", ")}`
    };
  }
}
