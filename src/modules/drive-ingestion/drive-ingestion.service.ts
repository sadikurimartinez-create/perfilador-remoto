import fs from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { getPool } from "@/lib/db";

export interface DriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  md5Checksum?: string;
  logicalCategory: string; // 'Root' or 'Pandillas', 'OSINT', 'Evidencia', 'Desaparecidos', etc.
}

export interface IngestionStatusLog {
  fileId: string;
  fileName: string;
  status: "processed" | "pending" | "failed";
  timestamp: string;
  source: "drive";
  logicalCategory: string;
  errorMessage?: string;
}

/**
 * Service to manage secure connection, geofenced listings, and duplicate checks for Google Drive.
 */
export class DriveIngestionService {
  private static driveClient: any = null;

  /**
   * Initializes and caches the authenticated Google Drive client securely.
   */
  private static async getDriveClient() {
    if (this.driveClient) return this.driveClient;

    let auth;

    // 1. Try to authenticate using in-memory environment variables (Optimal for Vercel without pushing JSON file)
    const clientEmail = process.env.DRIVE_CLIENT_EMAIL || process.env.GCP_CLIENT_EMAIL;
    const privateKey = process.env.DRIVE_PRIVATE_KEY || process.env.GCP_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      console.log("[DriveIngestionService] Autenticando en Google Drive mediante variables de entorno en memoria (Modo Vercel).");
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail.trim(),
          private_key: privateKey.replace(/\\n/g, "\n").trim(),
        },
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });
    } else {
      // 2. Fallback: Try reading the physical JSON file from disk (Optimal for Local Development)
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./perfil-remoto-94869497361e.json";
      const absolutePath = path.isAbsolute(credentialsPath)
        ? credentialsPath
        : path.resolve(process.cwd(), credentialsPath);

      try {
        await fs.access(absolutePath);
      } catch (err) {
        throw new Error(
          `Error Crítico de Seguridad: No se encontró el archivo de Service Account JSON en ${absolutePath} ni las credenciales DRIVE_CLIENT_EMAIL/DRIVE_PRIVATE_KEY en memoria.`
        );
      }

      console.log(`[DriveIngestionService] Autenticando en Google Drive mediante archivo físico JSON: ${absolutePath}`);
      auth = new google.auth.GoogleAuth({
        keyFile: absolutePath,
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });
    }

    this.driveClient = google.drive({ version: "v3", auth });
    return this.driveClient;
  }

  /**
   * Safe-guard check: Ensures GOOGLE_DRIVE_FOLDER_ID is set and valid.
   */
  private static getRootFolderId(): string {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId || folderId === "ID_DE_CARPETA_PERFILADOR_INGESTA" || folderId.trim() === "") {
      throw new Error("Error Crítico de Seguridad: GOOGLE_DRIVE_FOLDER_ID no está configurado en las variables de entorno.");
    }
    return folderId.trim();
  }

  /**
   * Ensures the PostgreSQL tracking table exists for duplicate control.
   */
  public static async ensureTrackingTableExists(): Promise<void> {
    const pool = getPool();
    const queryStr = `
      CREATE TABLE IF NOT EXISTS drive_ingestion_log (
        file_id VARCHAR(255) PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        source VARCHAR(50) DEFAULT 'drive',
        logical_category VARCHAR(100),
        error_message TEXT,
        metadata JSONB
      );
    `;
    try {
      await pool.query(queryStr);
      console.log("[DriveIngestionService] Tabla drive_ingestion_log verificada/creada.");
    } catch (err) {
      console.error("[DriveIngestionService] Error al crear tabla de control de duplicados:", err);
      throw err;
    }
  }

  /**
   * Check if a file has already been ingested or is in-progress.
   */
  public static async getFileStatus(fileId: string): Promise<IngestionStatusLog | null> {
    await this.ensureTrackingTableExists();
    const pool = getPool();
    const res = await pool.query(
      "SELECT file_id, file_name, status, timestamp, source, logical_category, error_message FROM drive_ingestion_log WHERE file_id = $1",
      [fileId]
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      fileId: row.file_id,
      fileName: row.file_name,
      status: row.status,
      timestamp: row.timestamp.toISOString(),
      source: row.source,
      logicalCategory: row.logical_category,
      errorMessage: row.error_message || undefined,
    };
  }

  /**
   * Register or update ingestion status for duplicate control.
   */
  public static async setFileStatus(
    fileId: string,
    fileName: string,
    status: "processed" | "pending" | "failed",
    logicalCategory: string,
    errorMessage?: string,
    metadata?: any
  ): Promise<void> {
    await this.ensureTrackingTableExists();
    const pool = getPool();
    const timestamp = new Date();

    const queryStr = `
      INSERT INTO drive_ingestion_log (file_id, file_name, status, timestamp, source, logical_category, error_message, metadata)
      VALUES ($1, $2, $3, $4, 'drive', $5, $6, $7)
      ON CONFLICT (file_id) DO UPDATE
      SET status = EXCLUDED.status,
          timestamp = EXCLUDED.timestamp,
          error_message = EXCLUDED.error_message,
          metadata = EXCLUDED.metadata;
    `;

    await pool.query(queryStr, [
      fileId,
      fileName,
      status,
      timestamp,
      logicalCategory,
      errorMessage || null,
      metadata ? JSON.stringify(metadata) : null,
    ]);
  }

  /**
   * Lists files strictly limited to Perfilador_Ingesta (root) and its immediate subdirectories.
   * This is GEOFENCED to block any global Drive discovery.
   */
  public static async listIngestableFiles(): Promise<DriveFileRecord[]> {
    const drive = await this.getDriveClient();
    const rootFolderId = this.getRootFolderId();

    console.log(`[DriveIngestionService] Escaneando de forma segura la carpeta de Drive ID: ${rootFolderId}`);

    // Step 1: Query immediate subfolders of Perfilador_Ingesta to handle category classification
    const subfoldersRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name)",
    });
    const subfolders = subfoldersRes.data.files || [];

    // Map folder ID to category name for classification. Root files are marked as 'Root'
    const folderCategoryMap: Record<string, string> = { [rootFolderId]: "Root" };
    for (const folder of subfolders) {
      if (folder.id && folder.name) {
        folderCategoryMap[folder.id] = folder.name;
      }
    }

    const allowedParents = Object.keys(folderCategoryMap);
    const ingestableFiles: DriveFileRecord[] = [];

    // Step 2: Iterate only over allowed parent IDs and query their children (strict geofencing)
    for (const parentId of allowedParents) {
      const category = folderCategoryMap[parentId];
      let pageToken: string | undefined = undefined;

      do {
        const res: any = await drive.files.list({
          q: `'${parentId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
          fields: "nextPageToken, files(id, name, mimeType, size, createdTime, md5Checksum, parents)",
          pageToken: pageToken,
        });

        const files = res.data.files || [];
        for (const file of files) {
          // Double-check: confirm parent is strictly in the allowed geofenced list
          const hasAllowedParent = file.parents && file.parents.some((p: string) => allowedParents.includes(p));
          if (!hasAllowedParent) {
            console.error(
              `⚠️ [DriveIngestionService] BLOQUEO CRÍTICO: El archivo ${file.name} (ID: ${file.id}) intentó ser listado pero su parentesco no está autorizado.`
            );
            continue; // Ignore and skip
          }

          ingestableFiles.push({
            id: file.id!,
            name: file.name!,
            mimeType: file.mimeType!,
            size: file.size || undefined,
            createdTime: file.createdTime || undefined,
            md5Checksum: file.md5Checksum || undefined,
            logicalCategory: category,
          });
        }

        pageToken = res.data.nextPageToken || undefined;
      } while (pageToken);
    }

    return ingestableFiles;
  }

  /**
   * Downloads a file safely as a binary buffer, strictly confirming it resides inside the geofenced folders.
   */
  public static async downloadFileContent(fileId: string): Promise<{ buffer: Buffer; fileMeta: DriveFileRecord }> {
    const drive = await this.getDriveClient();
    const rootFolderId = this.getRootFolderId();

    // 1. Fetch metadata first to enforce strict geofencing before downloading!
    const metaRes = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, parents, size, createdTime, md5Checksum",
    });

    const fileMetaRaw = metaRes.data;
    if (!fileMetaRaw) {
      throw new Error(`No se pudo recuperar los metadatos del archivo con ID ${fileId}`);
    }

    // 2. Fetch allowed subfolders again to double-check geofencing
    const subfoldersRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name)",
    });
    const subfolders = subfoldersRes.data.files || [];
    const allowedParents = [rootFolderId, ...subfolders.map((f: any) => f.id!).filter(Boolean)];

    const hasAllowedParent = fileMetaRaw.parents && fileMetaRaw.parents.some((p: string) => allowedParents.includes(p));
    if (!hasAllowedParent) {
      throw new Error(
        `⛔ [DriveIngestionService] VIOLACIÓN DE SEGURIDAD DETECTADA: Se denegó la descarga del archivo "${fileMetaRaw.name}" (ID: ${fileId}) porque reside fuera del Folder ID autorizado.`
      );
    }

    // Determine category
    let category = "Root";
    if (fileMetaRaw.parents) {
      const actualParent = fileMetaRaw.parents.find((p: string) => allowedParents.includes(p));
      const matchedFolder = subfolders.find((sf: any) => sf.id === actualParent);
      if (matchedFolder) {
        category = matchedFolder.name!;
      }
    }

    const fileMeta: DriveFileRecord = {
      id: fileMetaRaw.id!,
      name: fileMetaRaw.name!,
      mimeType: fileMetaRaw.mimeType!,
      size: fileMetaRaw.size || undefined,
      createdTime: fileMetaRaw.createdTime || undefined,
      md5Checksum: fileMetaRaw.md5Checksum || undefined,
      logicalCategory: category,
    };

    console.log(`[DriveIngestionService] Descargando de forma segura el archivo: "${fileMeta.name}" (${fileMeta.mimeType})`);

    // 3. Perform download
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const buffer = Buffer.from(response.data);
    return { buffer, fileMeta };
  }
}
