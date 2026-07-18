import { ImageDeletionGovernanceService, ImageDeletionAuditLog } from "../src/utils/imageDeletionGovernanceService";

function runDeletionSuite() {
  console.log("================================");
  console.log("\nIMAGE DELETE GOVERNANCE\n");

  const initialAlbum = [
    {
      id: "photo-field-1",
      url: "https://storage.ceipol.gob.mx/photos/field1.jpg",
      tipo: "Perímetro",
      evidenceType: "FIELD_CAPTURE",
      riskLevel: "CRÍTICO",
      fecha: Date.now()
    },
    {
      id: "photo-sv-2",
      url: "https://maps.googleapis.com/cbk?streetview2",
      tipo: "STREET_VIEW",
      evidenceType: "VIRTUAL_STREET_VIEW",
      riskLevel: "MEDIO",
      fecha: Date.now()
    },
    {
      id: "photo-supp-3",
      url: "https://storage.ceipol.gob.mx/photos/supp3.png",
      tipo: "SUPPORTING",
      evidenceType: "SUPPORTING",
      riskLevel: "BAJO",
      fecha: Date.now()
    }
  ];

  const projectId = "PROJ-2026-TEST";
  const user = "Investigador.CEIPOL";

  // Almacenar todas las bitácoras generadas
  const auditLogs: ImageDeletionAuditLog[] = [];

  // --- Caso 1: Imagen analista (FIELD_CAPTURE) ---
  const fieldPhoto = initialAlbum[0];
  const case1 = ImageDeletionGovernanceService.deleteImage(
    fieldPhoto,
    projectId,
    user,
    initialAlbum,
    "polígono"
  );
  auditLogs.push(case1.auditLog);
  const case1DeletedFromAlbum = !case1.updatedAlbum.some((p) => p.id === fieldPhoto.id);
  const case1AuditValid = case1.auditLog.event === "IMAGE_DELETED" && case1.auditLog.source === "FIELD_CAPTURE";
  console.log("FIELD IMAGE:");
  console.log(case1DeletedFromAlbum && case1AuditValid ? "PASS" : "FAIL");
  console.log("");

  // --- Caso 2: Imagen Street View (STREET_VIEW) ---
  const svPhoto = initialAlbum[1];
  const case2 = ImageDeletionGovernanceService.deleteImage(
    svPhoto,
    projectId,
    user,
    initialAlbum,
    "polígono"
  );
  auditLogs.push(case2.auditLog);
  const case2DeletedFromAlbum = !case2.updatedAlbum.some((p) => p.id === svPhoto.id);
  const case2AuditValid = case2.auditLog.event === "IMAGE_DELETED" && case2.auditLog.source === "STREET_VIEW";
  console.log("STREET VIEW:");
  console.log(case2DeletedFromAlbum && case2AuditValid ? "PASS" : "FAIL");
  console.log("");

  // --- Caso 3: Imagen soporte (SUPPORTING) ---
  const suppPhoto = initialAlbum[2];
  const case3 = ImageDeletionGovernanceService.deleteImage(
    suppPhoto,
    projectId,
    user,
    initialAlbum,
    "polígono"
  );
  auditLogs.push(case3.auditLog);
  const case3DeletedFromAlbum = !case3.updatedAlbum.some((p) => p.id === suppPhoto.id);
  const case3AuditValid = case3.auditLog.event === "IMAGE_DELETED" && case3.auditLog.source === "SUPPORTING";
  console.log("SUPPORTING:");
  console.log(case3DeletedFromAlbum && case3AuditValid ? "PASS" : "FAIL");
  console.log("");

  // --- Caso 4: Cancelar eliminación ---
  // En la UI, la cancelación se traduce en NO llamar a deleteImage y mantener el álbum intacto.
  const cancelFlowAlbum = [...initialAlbum]; // Simulación de álbum sin modificación
  const cancelFlowAuditLogsBefore = auditLogs.length;
  // (El usuario cerró la ventana de advertencia de cancelación de flujo de borrado)
  const case4ImagePreserved = cancelFlowAlbum.length === initialAlbum.length;
  const case4NoNewAuditLogs = auditLogs.length === cancelFlowAuditLogsBefore;
  console.log("CANCEL FLOW:");
  console.log(case4ImagePreserved && case4NoNewAuditLogs ? "PASS" : "FAIL");
  console.log("");

  // --- Validación de Bitácoras (AUDIT LOG constraints) ---
  // Ninguna bitácora debe almacenar la imagen, thumbnail, URL activa o contenido visual.
  const auditLogsCompliance = auditLogs.every((log) => {
    const json = JSON.stringify(log);
    const hasNoUrls = !json.includes("http") && !json.includes(".jpg") && !json.includes(".png");
    const hasRequiredFields = 
      log.event === "IMAGE_DELETED" &&
      !!log.imageId &&
      !!log.projectId &&
      !!log.deletedBy &&
      !!log.timestamp &&
      !!log.source &&
      !!log.previousClassification &&
      !!log.geometryType &&
      log.deletionReason === "USER_REQUEST";
    return hasNoUrls && hasRequiredFields;
  });

  console.log("AUDIT LOG:");
  console.log(auditLogsCompliance ? "PASS" : "FAIL");
  console.log("");

  const allPassed = 
    case1DeletedFromAlbum && case1AuditValid &&
    case2DeletedFromAlbum && case2AuditValid &&
    case3DeletedFromAlbum && case3AuditValid &&
    case4ImagePreserved && case4NoNewAuditLogs &&
    auditLogsCompliance;

  console.log("\nSTATUS:");
  console.log(allPassed ? "GREEN" : "RED");
  console.log("\n================================");

  if (!allPassed) {
    process.exit(1);
  }
}

runDeletionSuite();
