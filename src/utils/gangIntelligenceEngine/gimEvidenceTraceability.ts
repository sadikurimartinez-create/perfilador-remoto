import { GIMTraceabilityRecord } from "./models/gangIntelligenceTypes";

export class GimEvidenceTraceability {
  private static historyLog: GIMTraceabilityRecord[] = [];

  /**
   * Genera un identificador único y determinista para el registro de trazabilidad.
   */
  public static generateTraceId(sourcePrefix: string, index: number): string {
    const cleanPrefix = sourcePrefix.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `gim-trace-${cleanPrefix}-${index}`;
  }

  /**
   * Crea un nuevo registro de procedencia e inmutabilidad de la evidencia.
   */
  public static createTraceabilityRecord(
    id: string,
    sourceType: GIMTraceabilityRecord["sourceType"],
    sourceName: string,
    operatorId: string,
    transformationApplied: string,
    gimConfidenceAllocated: number,
    consumersList: string[] = ["HIE", "ReportEngine"]
  ): GIMTraceabilityRecord {
    const record: GIMTraceabilityRecord = {
      id,
      sourceType,
      sourceName,
      capturedAt: new Date().toISOString(),
      operatorId,
      transformationApplied,
      gimConfidenceAllocated,
      consumersList
    };

    // Registrar en el log local de auditoría histórica
    this.historyLog.push(record);
    return record;
  }

  /**
   * Añade y registra transformaciones adicionales aplicadas sobre un indicio existente.
   */
  public static appendTransformation(id: string, transformation: string): GIMTraceabilityRecord | null {
    const record = this.historyLog.find((r) => r.id === id);
    if (record) {
      record.transformationApplied = record.transformationApplied 
        ? `${record.transformationApplied} | ${transformation}`
        : transformation;
      return record;
    }
    return null;
  }

  /**
   * Recupera el registro e historial de procedencia de un indicio específico por su identificador.
   */
  public static getTraceHistory(id: string): GIMTraceabilityRecord | null {
    return this.historyLog.find((r) => r.id === id) || null;
  }

  /**
   * Obtiene todos los registros persistidos en el log histórico local.
   */
  public static getAllRecords(): GIMTraceabilityRecord[] {
    return [...this.historyLog];
  }

  /**
   * Limpia el registro local de auditoría (para propósitos de pruebas y aislamiento).
   */
  public static clearHistory(): void {
    this.historyLog = [];
  }
}
