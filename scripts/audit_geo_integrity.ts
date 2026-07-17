import axios from "axios";
import * as fs from "fs";
import * as path from "path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface FirestoreValue {
  doubleValue?: number;
  stringValue?: string;
  integerValue?: string;
}

interface FirestoreFields {
  [key: string]: FirestoreValue;
}

interface FirestoreDocument {
  name: string;
  fields?: FirestoreFields;
  createTime: string;
  updateTime: string;
}

interface ProjectData {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
}

async function runAudit() {
  console.log("\n========================================================");
  console.log("   SSPE-CEIPOL - DIAGNÓSTICO DE INTEGRIDAD GEOGRÁFICA  ");
  console.log("========================================================\n");
  console.log("Conectando con la base de datos de Firestore...");

  const url = "https://firestore.googleapis.com/v1/projects/perfilador-remoto/databases/(default)/documents/projects?pageSize=500";

  try {
    const response = await axios.get<{ documents?: FirestoreDocument[] }>(url);
    const rawDocs = response.data.documents || [];

    console.log(`Se recuperaron ${rawDocs.length} expedientes de la base de datos.`);

    const projects: ProjectData[] = rawDocs.map(doc => {
      const fields = doc.fields || {};
      const id = fields.id?.stringValue || path.basename(doc.name);
      const name = fields.nombre?.stringValue || fields.name?.stringValue || "Sin nombre";
      
      let lat: number | null = null;
      let lng: number | null = null;

      if (fields.latitude) {
        lat = fields.latitude.doubleValue !== undefined 
          ? fields.latitude.doubleValue 
          : parseFloat(fields.latitude.stringValue || "0") || parseFloat(fields.latitude.integerValue || "0") || null;
      }

      if (fields.longitude) {
        lng = fields.longitude.doubleValue !== undefined 
          ? fields.longitude.doubleValue 
          : parseFloat(fields.longitude.stringValue || "0") || parseFloat(fields.longitude.integerValue || "0") || null;
      }

      return { id, name, lat, lng };
    });

    // Análisis de integridad
    const report = {
      timestamp: new Date().toISOString(),
      totalProjects: projects.length,
      valid: 0,
      defaultLocation: 0,
      duplicated: 0,
      empty: 0,
      suspicious: 0,
      classifications: [] as any[]
    };

    // Para detectar duplicados (coordenadas repetidas de forma inusual)
    const coordMap = new Map<string, ProjectData[]>();

    projects.forEach(p => {
      if (p.lat !== null && p.lng !== null) {
        const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
        if (!coordMap.has(key)) {
          coordMap.set(key, []);
        }
        coordMap.get(key)!.push(p);
      }
    });

    const defaultLat = 21.8853;
    const defaultLng = -102.2916;

    projects.forEach(p => {
      let status: "VALID" | "DEFAULT" | "DUPLICATED" | "EMPTY" | "SUSPICIOUS" = "VALID";
      let reason = "Coordenada válida";

      if (p.lat === null || p.lng === null || isNaN(p.lat) || isNaN(p.lng)) {
        status = "EMPTY";
        reason = "Sin coordenadas de ubicación asignadas";
        report.empty++;
      } else {
        const isNearDefault = Math.abs(p.lat - defaultLat) < 0.001 && Math.abs(p.lng - defaultLng) < 0.001;

        if (isNearDefault) {
          status = "DEFAULT";
          reason = "Ubicación por defecto: Centro de Aguascalientes (Fallback detectado)";
          report.defaultLocation++;
        } else if (p.lat === 0 && p.lng === 0) {
          status = "SUSPICIOUS";
          reason = "Coordenada improbables (0,0)";
          report.suspicious++;
        } else if (p.lat < 14.0 || p.lat > 33.0 || p.lng < -118.0 || p.lng > -86.0) {
          status = "SUSPICIOUS";
          reason = "Coordenada fuera de los límites de México";
          report.suspicious++;
        } else {
          // Revisar si está duplicado
          const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
          const sharing = coordMap.get(key) || [];
          if (sharing.length > 1) {
            status = "DUPLICATED";
            reason = `Comparte coordenadas idénticas con otros ${sharing.length - 1} expedientes`;
            report.duplicated++;
          } else {
            report.valid++;
          }
        }
      }

      report.classifications.push({
        id: p.id,
        name: p.name,
        latitude: p.lat,
        longitude: p.lng,
        status,
        reason
      });
    });

    // Escribir reporte JSON
    const reportPath = path.join(process.cwd(), "geo_integrity_audit_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

    // Imprimir resumen en consola
    console.log("\n--------------------------------------------------------");
    console.log("                 RESUMEN DE AUDITORÍA                   ");
    console.log("--------------------------------------------------------");
    console.log(` Expedientes Totales:     ${report.totalProjects}`);
    console.log(` Ubicaciones Válidas:     ${report.valid}`);
    console.log(` Ubicaciones Fallback (AGS): ${report.defaultLocation}  <-- ¡Riesgo de contaminación!`);
    console.log(` Ubicaciones Duplicadas:  ${report.duplicated}`);
    console.log(` Ubicaciones Vacías:      ${report.empty}`);
    console.log(` Ubicaciones Sospechosas: ${report.suspicious}`);
    console.log("--------------------------------------------------------");
    console.log(`Detalles guardados en: ${reportPath}\n`);

    // Mostrar lista de expedientes afectados por Aguascalientes fallback
    const contaminated = report.classifications.filter(c => c.status === "DEFAULT");
    if (contaminated.length > 0) {
      console.log("Expedientes Contaminados con el Fallback de Aguascalientes:");
      contaminated.slice(0, 15).forEach((c, index) => {
        console.log(` ${index + 1}. [${c.id}] ${c.name}`);
      });
      if (contaminated.length > 15) {
        console.log(` ... y otros ${contaminated.length - 15} expedientes más.`);
      }
    }

  } catch (error: any) {
    console.error("Error al conectarse o consultar la base de datos de Firestore:", error?.message || error);
  }
}

runAudit();
