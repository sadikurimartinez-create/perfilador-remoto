import axios from "axios";
import * as fs from "fs";
import * as path from "path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

interface FirestoreValue {
  doubleValue?: number;
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
}

interface FirestoreFields {
  [key: string]: FirestoreValue;
}

interface FirestoreDocument {
  name: string;
  fields?: FirestoreFields;
}

async function runPhotoAudit() {
  console.log("\n========================================================");
  console.log("   SSPE-CEIPOL - DIAGNÓSTICO DE INTEGRIDAD FOTOGRÁFICA  ");
  console.log("========================================================\n");
  console.log("Conectando con la base de datos de Firestore...");

  const projectsUrl = "https://firestore.googleapis.com/v1/projects/perfilador-remoto/databases/(default)/documents/projects?pageSize=500";

  try {
    const projectsResponse = await axios.get<{ documents?: FirestoreDocument[] }>(projectsUrl);
    const rawProjects = projectsResponse.data.documents || [];

    console.log(`Se recuperaron ${rawProjects.length} expedientes de la base de datos.`);
    console.log("Analizando subcolecciones fotográficas de forma secuencial...\n");

    const projectsReportList: any[] = [];
    let totalPhotos = 0;
    let maxPhotos = 0;
    let maxPhotosProjectName = "";
    let projectsOver40 = 0;
    let totalDuplicates = 0;
    let totalMissingMetadata = 0;

    for (const projectDoc of rawProjects) {
      const fields = projectDoc.fields || {};
      const rawId = path.basename(projectDoc.name);
      const id = fields.id?.stringValue || rawId;
      const name = fields.nombre?.stringValue || fields.name?.stringValue || "Sin nombre";

      // Consensuar fotos
      const photosUrl = `https://firestore.googleapis.com/v1/projects/perfilador-remoto/databases/(default)/documents/projects/${rawId}/photos?pageSize=500`;
      let photos: any[] = [];

      try {
        const photosResponse = await axios.get<{ documents?: FirestoreDocument[] }>(photosUrl);
        const rawPhotos = photosResponse.data.documents || [];
        
        photos = rawPhotos.map(pDoc => {
          const pFields = pDoc.fields || {};
          const pId = path.basename(pDoc.name);
          const url = pFields.url?.stringValue || pFields.previewUrl?.stringValue || "";
          const tipo = pFields.tipo?.stringValue || pFields.category?.stringValue || "";
          const comentario = pFields.comentario?.stringValue || pFields.observation?.stringValue || "";
          const lat = pFields.lat?.doubleValue !== undefined 
            ? pFields.lat.doubleValue 
            : (parseFloat(pFields.lat?.stringValue || "0") || null);
          const lng = pFields.lng?.doubleValue !== undefined 
            ? pFields.lng.doubleValue 
            : (parseFloat(pFields.lng?.stringValue || "0") || null);
          const deleted = pFields.deleted?.booleanValue || false;

          return { id: pId, url, tipo, comentario, lat, lng, deleted };
        }).filter(p => !p.deleted);
      } catch (err: any) {
        // subcollection might be empty or not created yet (404 is normal for empty subcollections in REST)
        if (err.response?.status !== 404) {
          console.warn(`[Aviso] No se pudo leer fotos de [${id}] ${name}: ${err.message}`);
        }
      }

      const photoCount = photos.length;
      totalPhotos += photoCount;

      if (photoCount > maxPhotos) {
        maxPhotos = photoCount;
        maxPhotosProjectName = name;
      }

      if (photoCount > 40) {
        projectsOver40++;
      }

      // Analizar duplicados y metadatos vacíos para este proyecto
      const urlSet = new Set<string>();
      let duplicatesInProject = 0;
      let missingMetadataInProject = 0;

      photos.forEach(p => {
        // Duplicados por URL
        if (p.url) {
          if (urlSet.has(p.url)) {
            duplicatesInProject++;
          } else {
            urlSet.add(p.url);
          }
        }

        // Faltos de metadata (sin comentario ni tipo válidos)
        const hasNoType = !p.tipo || p.tipo.trim() === "" || p.tipo === "Otro; ventana para contextualizar";
        const hasNoComment = !p.comentario || p.comentario.trim() === "" || p.comentario === "Evidencia fotográfica de campo.";
        if (hasNoType && hasNoComment) {
          missingMetadataInProject++;
        }
      });

      totalDuplicates += duplicatesInProject;
      totalMissingMetadata += missingMetadataInProject;

      projectsReportList.push({
        id,
        name,
        photoCount,
        duplicates: duplicatesInProject,
        missingMetadata: missingMetadataInProject,
        status: photoCount > 40 ? "EXCESSIVE" : photoCount > 20 ? "HIGH" : "NORMAL"
      });

      console.log(`- Expediente [${id}]: ${name} -> ${photoCount} fotos (${duplicatesInProject} duplicadas, ${missingMetadataInProject} sin metadatos)`);
    }

    const averagePhotos = rawProjects.length > 0 ? parseFloat((totalPhotos / rawProjects.length).toFixed(1)) : 0;

    const finalReport = {
      timestamp: new Date().toISOString(),
      totalProjects: rawProjects.length,
      totalPhotos,
      averagePhotos,
      maximumPhotos: maxPhotos,
      maximumPhotosProject: maxPhotosProjectName,
      projectsOver40,
      totalDuplicates,
      totalMissingMetadata,
      details: projectsReportList
    };

    const reportPath = path.join(process.cwd(), "photo_integrity_audit_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2), "utf8");

    console.log("\n--------------------------------------------------------");
    console.log("                 RESUMEN DE AUDITORÍA                   ");
    console.log("--------------------------------------------------------");
    console.log(` Expedientes Totales:     ${finalReport.totalProjects}`);
    console.log(` Fotografías Totales:     ${finalReport.totalPhotos}`);
    console.log(` Promedio de Fotos:       ${finalReport.averagePhotos}`);
    console.log(` Máximo de Fotos:         ${finalReport.maximumPhotos} (en "${finalReport.maximumPhotosProject}")`);
    console.log(` Expedientes con +40:     ${finalReport.projectsOver40}`);
    console.log(` Fotografías Duplicadas:  ${finalReport.totalDuplicates}`);
    console.log(` Sin metadatos analíticos: ${finalReport.totalMissingMetadata}`);
    console.log("--------------------------------------------------------");
    console.log(`Detalles guardados en: ${reportPath}\n`);

  } catch (error: any) {
    console.error("Error crítico ejecutando la auditoría de fotos:", error?.message || error);
  }
}

runPhotoAudit();
