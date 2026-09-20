import "server-only";

import { inspectInegiTerritorialReadiness } from "@/lib/inegiTerritorialResolver";
import {
  selectAuthoritativeRoute,
  type SourceFamily,
  type SourceRouteDescriptor,
} from "@/lib/providers/sourceRegistry";

export async function selectVerifiedAuthoritativeRoute(
  sourceFamily: SourceFamily
): Promise<SourceRouteDescriptor | null> {
  if (sourceFamily !== "SCINCE") return selectAuthoritativeRoute(sourceFamily);

  const readiness = await inspectInegiTerritorialReadiness();
  return selectAuthoritativeRoute("SCINCE", {
    scinceReadiness: {
      ready: readiness.ready,
      datasetId: readiness.datasetId,
    },
  });
}
