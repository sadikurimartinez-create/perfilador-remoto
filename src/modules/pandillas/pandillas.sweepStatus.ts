export type PandillasSweepStatus =
  | "SUCCESS"
  | "EMPTY"
  | "NOT_CONFIGURED"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "VALIDATION_ERROR";

export const PANDILLAS_SWEEP_CLIENT_TIMEOUT_MS = 55000;
export const PANDILLAS_PROVIDER_TIMEOUT_MS = 55000;

export class PandillasSweepError extends Error {
  constructor(
    public readonly sweepStatus: Exclude<PandillasSweepStatus, "SUCCESS" | "EMPTY">,
    message: string,
    public readonly httpStatus?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "PandillasSweepError";
  }
}

export function classifyPandillasHttpStatus(status: number): Exclude<PandillasSweepStatus, "SUCCESS" | "EMPTY"> {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 503) return "NOT_CONFIGURED";
  if (status === 504) return "TIMEOUT";
  return "PROVIDER_ERROR";
}

export function classifyPandillasResult(result: any): PandillasSweepStatus {
  if (result?.sweepStatus) return result.sweepStatus;
  const nodes = result?.grafo?.nodos;
  const geolocations = result?.mapa?.geolocalizacion;
  const alerts = result?.alertas;
  if (
    Array.isArray(nodes) &&
    nodes.length === 0 &&
    Array.isArray(geolocations) &&
    geolocations.length === 0 &&
    Array.isArray(alerts) &&
    alerts.length === 0
  ) {
    return "EMPTY";
  }
  return "SUCCESS";
}
