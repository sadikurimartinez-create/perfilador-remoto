import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { classifyCrimeDataset, type CrimeDatasetValidationStatus } from "./crimeIncidenceCanonicalPipeline";

export type CrimeValidationReport = {
  success: boolean;
  folderFound: boolean;
  folderPath: string;
  totalFiles: number;
  totalRecords: number;
  yearMin: number | null;
  yearMax: number | null;
  temporalCoverageStatus: "KNOWN" | "TEMPORAL_COVERAGE_UNKNOWN";
  validationStatus: CrimeDatasetValidationStatus;
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
        yearMin: null,
        yearMax: null,
        temporalCoverageStatus: "TEMPORAL_COVERAGE_UNKNOWN",
        validationStatus: "INVALID",
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
        yearMin: null,
        yearMax: null,
        temporalCoverageStatus: "TEMPORAL_COVERAGE_UNKNOWN",
        validationStatus: "INVALID",
        columnsStatus: "FAIL",
        missingColumns: [],
        georefStatus: "FAIL",
        duplicateCount: 0,
        delitosList: [],
        reportMessage: `Error al leer la carpeta de incidencia delictiva: ${err.message}`
      };
    }

    let totalRecords = 0;
    let yearMin: number | null = null;
    let yearMax: number | null = null;
    const delitosSet = new Set<string>();
    let duplicates = 0;
    let rejectedRecords = 0;
    let validationStatus: CrimeDatasetValidationStatus = "INVALID";
    
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
        const classified = classifyCrimeDataset(rows, path.basename(file));
        duplicates += classified.summary.duplicates;
        rejectedRecords += classified.summary.rejected;
        if (classified.status === "SCHEMA_VALID" || (validationStatus !== "SCHEMA_VALID" && classified.status === "PARTIAL")) {
          validationStatus = classified.status;
        } else if (validationStatus === "INVALID" && classified.status === "GEO_INVALID") {
          validationStatus = "GEO_INVALID";
        }
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

          const dateStr = row.FECHA || row.fecha || row.Fecha;
          if (dateStr) {
            const yearMatch = String(dateStr).match(/\b(20\d{2})\b/);
            if (yearMatch) {
              const yr = parseInt(yearMatch[1], 10);
              if (yr >= 2010 && yr <= 2030) {
                if (yearMin == null || yr < yearMin) yearMin = yr;
                if (yearMax == null || yr > yearMax) yearMax = yr;
              }
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
    const georefStatus = invalidGeorefCount === 0 ? "OK" : "FAIL";
    const temporalCoverageStatus = yearMin == null || yearMax == null ? "TEMPORAL_COVERAGE_UNKNOWN" : "KNOWN";

    return {
      success: columnsStatus === "OK" && georefStatus === "OK",
      folderFound: true,
      folderPath: activeDir,
      totalFiles: files.length,
      totalRecords,
      yearMin,
      yearMax,
      temporalCoverageStatus,
      validationStatus,
      columnsStatus,
      missingColumns,
      georefStatus,
      duplicateCount: duplicates,
      delitosList: Array.from(delitosSet).slice(0, 15),
      reportMessage: columnsStatus === "OK" && georefStatus === "OK"
        ? "El archivo histórico de incidencia delictiva se procesa con esquema y georreferencia válidos."
        : `Validación no aprobada. Columnas faltantes: ${missingColumns.join(", ") || "ninguna"}. Registros rechazados por georreferencia/cobertura: ${rejectedRecords}.`
    };
  }
}
