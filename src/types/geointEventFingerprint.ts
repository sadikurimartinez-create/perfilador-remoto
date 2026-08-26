import { GeointEventType } from "./geointEventLog";

export interface EventFingerprintRecord {
  fingerprint: string;
  eventId: string;
  expedienteId: string;
  traceabilityId: string;
  eventType: GeointEventType | string;
  entityId: string;
  status: string;
  createdAt: string;
}
