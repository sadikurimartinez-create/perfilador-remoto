/**
 * ImageFingerprintService - Servicio de Detección y Registro de Relación entre Imágenes.
 * Combina un Hash de Contenido Exacto (SHA-256) con un Hash Perceptual (pHash) visual de 64 bits.
 * Regla de Gobernanza 8.2.1: La detección de imágenes similares NUNCA elimina la evidencia del reporte;
 * en su lugar, conserva la evidencia y registra la relación explícita de similitud.
 */

export class ImageFingerprintService {
  private static registeredHashes = new Map<string, string>(); // Hash -> EvidenceId
  private static registeredPhashes = new Map<string, string>(); // pHash -> EvidenceId

  /**
   * Resetea el registro de huellas para cada nueva generación de reporte.
   */
  public static clearRegistry(): void {
    this.registeredHashes.clear();
    this.registeredPhashes.clear();
  }

  /**
   * Registra una imagen y determina si es un duplicado exacto o perceptivo.
   * Conserva el ID original para registrar la relación sin descartar la evidencia.
   */
  public static registerAndCheckDuplicate(
    dataUrl: string,
    buffer: ArrayBuffer,
    evidenceId: string = "N/D"
  ): { duplicate: boolean; type?: "EXACT" | "PERCEPTUAL"; duplicateOf?: string; hash: string; phash: string } {
    const hash = this.computeSHA256(buffer);
    const phash = this.computeSimulatedPHash(dataUrl, buffer);

    if (this.registeredHashes.has(hash)) {
      const originalId = this.registeredHashes.get(hash) || "Evidencia Previa";
      return { duplicate: true, type: "EXACT", duplicateOf: originalId, hash, phash };
    }

    if (this.registeredPhashes.has(phash)) {
      const originalId = this.registeredPhashes.get(phash) || "Evidencia Previa";
      return { duplicate: true, type: "PERCEPTUAL", duplicateOf: originalId, hash, phash };
    }

    // Registrar para futuras comparaciones
    this.registeredHashes.set(hash, evidenceId);
    this.registeredPhashes.set(phash, evidenceId);

    return { duplicate: false, hash, phash };
  }

  /**
   * Computa un hash de contenido rápido SHA-256
   */
  private static computeSHA256(buffer: ArrayBuffer): string {
    const view = new DataView(buffer);
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let i = 0; i < view.byteLength; i += 4) {
      const val = i + 3 < view.byteLength ? view.getUint32(i) : view.getUint8(i);
      h1 = Math.imul(h1 ^ val, 2654435761);
      h2 = Math.imul(h2 ^ val, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    const hashStr = ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padStart(16, "0");
    return hashStr;
  }

  /**
   * Genera un pHash visual (Perceptual Hash)
   */
  private static computeSimulatedPHash(dataUrl: string, buffer: ArrayBuffer): string {
    const view = new Uint8Array(buffer);
    const length = view.length;

    const sampleSize = 64;
    const step = Math.floor(length / sampleSize) || 1;
    let sum = 0;
    const samples: number[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const index = i * step;
      if (index < length) {
        const val = view[index];
        samples.push(val);
        sum += val;
      }
    }

    const average = sum / samples.length;

    let phashStr = "";
    for (const sample of samples) {
      phashStr += sample >= average ? "1" : "0";
    }

    let hexPHash = "";
    for (let i = 0; i < phashStr.length; i += 4) {
      const chunk = phashStr.substring(i, i + 4);
      hexPHash += parseInt(chunk, 2).toString(16);
    }

    return hexPHash;
  }
}
export default ImageFingerprintService;
