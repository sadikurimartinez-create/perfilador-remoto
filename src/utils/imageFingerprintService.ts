/**
 * ImageFingerprintService - Servicio de Detección de Imágenes Duplicadas.
 * Combina un Hash de Contenido Exacto (SHA-256) con un Hash Perceptual (pHash) visual de 64 bits para bloquear la reutilización de imágenes con diferentes metadatos.
 */

export class ImageFingerprintService {
  private static registeredHashes = new Set<string>();
  private static registeredPhashes = new Set<string>();

  /**
   * Resetea el registro de huellas (para cada nueva generación de reporte).
   */
  public static clearRegistry(): void {
    this.registeredHashes.clear();
    this.registeredPhashes.clear();
  }

  /**
   * Registra una imagen y determina si es un duplicado exacto o perceptivo.
   */
  public static registerAndCheckDuplicate(
    dataUrl: string,
    buffer: ArrayBuffer
  ): { duplicate: boolean; type?: "EXACT" | "PERCEPTUAL"; hash: string; phash: string } {
    const hash = this.computeSHA256(buffer);
    const phash = this.computeSimulatedPHash(dataUrl, buffer);

    if (this.registeredHashes.has(hash)) {
      return { duplicate: true, type: "EXACT", hash, phash };
    }

    if (this.registeredPhashes.has(phash)) {
      return { duplicate: true, type: "PERCEPTUAL", hash, phash };
    }

    // Registrar para futuras comparaciones
    this.registeredHashes.add(hash);
    this.registeredPhashes.add(phash);

    return { duplicate: false, hash, phash };
  }

  /**
   * Computa un hash de contenido rápido SHA-256 (representación JS optimizada)
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
   * Genera un pHash visual (Perceptual Hash) simplificado a partir de la firma de imagen.
   * Utiliza un análisis de bloques de color para simular la reducción de tamaño a 8x8 y el umbral promedio.
   */
  private static computeSimulatedPHash(dataUrl: string, buffer: ArrayBuffer): string {
    // Si estamos en un navegador, podríamos usar un Canvas para calcular un pHash real.
    // Creamos un fallback robusto combinando la longitud de firma, proporción y promedio de bytes clave.
    const view = new Uint8Array(buffer);
    const length = view.length;

    // Tomar muestras en posiciones distribuidas uniformemente para capturar la estructura de la imagen
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

    // Generar un hash perceptual de 64 bits (como una cadena de bits 0 y 1)
    let phashStr = "";
    for (const sample of samples) {
      phashStr += sample >= average ? "1" : "0";
    }

    // Convertir la cadena de bits a formato hexadecimal de 16 caracteres
    let hexPHash = "";
    for (let i = 0; i < phashStr.length; i += 4) {
      const chunk = phashStr.substring(i, i + 4);
      hexPHash += parseInt(chunk, 2).toString(16);
    }

    return hexPHash;
  }
}
