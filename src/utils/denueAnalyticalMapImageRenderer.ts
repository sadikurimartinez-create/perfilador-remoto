import { getCanonicalGeographyCoordinates, getCanonicalMapViewport, type LatLngPoint } from "@/utils/canonicalProjectGeography";
import {
  buildGovernedCartographicDecision,
  CARTOGRAPHIC_LOGICAL_HEIGHT,
  CARTOGRAPHIC_LOGICAL_WIDTH,
  CARTOGRAPHIC_STATIC_MAP_SCALE,
  projectWebMercator,
  wrappedWorldDeltaX,
} from "@/utils/governedCartographicScale";
import type { DenueAnalyticalMapRenderModel } from "@/utils/denueAnalyticalMapRendering";

const STATIC_MAP_URL_MAX_LENGTH = 16384;
const ATTRIBUTION_SAFE_BOTTOM_LOGICAL_PX = 32;

export interface DenueAnalyticalOverlayMarker {
  displayLabel: string;
  displayId: string;
  denueLayerId: string;
  x: number;
  y: number;
}

export interface DenueAnalyticalMapImagePlan {
  baseMapUrl: string;
  provider: "GOOGLE_STATIC_MAPS";
  width: typeof CARTOGRAPHIC_LOGICAL_WIDTH;
  height: typeof CARTOGRAPHIC_LOGICAL_HEIGHT;
  scale: typeof CARTOGRAPHIC_STATIC_MAP_SCALE;
  center: LatLngPoint;
  zoom: number;
  geometryType: DenueAnalyticalMapRenderModel["canonicalGeography"]["geometry"]["type"];
  overlayMarkers: DenueAnalyticalOverlayMarker[];
  attributionSafeBottomLogicalPx: typeof ATTRIBUTION_SAFE_BOTTOM_LOGICAL_PX;
}

export interface DenueAnalyticalBitmapBackend {
  loadBaseMap(url: string): Promise<{ source: unknown; width: number; height: number; release?: () => void }>;
  createCanvas(width: number, height: number): {
    context: {
      drawImage(source: unknown, x: number, y: number, width: number, height: number): void;
      beginPath(): void;
      arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
      fill(): void;
      stroke(): void;
      fillText(text: string, x: number, y: number): void;
      fillStyle: string | CanvasGradient | CanvasPattern;
      strokeStyle: string | CanvasGradient | CanvasPattern;
      lineWidth: number;
      font: string;
      textAlign: CanvasTextAlign;
      textBaseline: CanvasTextBaseline;
    };
    toPngArrayBuffer(): Promise<ArrayBuffer>;
  };
}

function pointParam(point: LatLngPoint): string {
  return `${point.lat},${point.lng}`;
}

function geometryPaths(model: DenueAnalyticalMapRenderModel): LatLngPoint[][] {
  const geometry = model.canonicalGeography.geometry;
  const position = (value: [number, number]): LatLngPoint => ({ lat: value[1], lng: value[0] });
  if (geometry.type === "Point") return [];
  if (geometry.type === "LineString") return [geometry.coordinates.map(position)];
  if (geometry.type === "Polygon") return geometry.coordinates.map((ring) => ring.map(position));
  return geometry.coordinates.flatMap((polygon) => polygon.map((ring) => ring.map(position)));
}

function appendCanonicalGeometry(params: URLSearchParams, model: DenueAnalyticalMapRenderModel): void {
  const geometry = model.canonicalGeography.geometry;
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates;
    params.append("markers", `size:tiny|color:0x0D2B52|${lat},${lng}`);
    return;
  }
  const paths = geometryPaths(model);
  const outlineOnly = geometry.type === "LineString" || paths.length > 1;
  for (const path of paths) {
    const style = outlineOnly ? "color:0x0D2B52ff|weight:4" : "color:0x0D2B52ff|weight:4|fillcolor:0x0D2B5233";
    params.append("path", `${style}|${path.map(pointParam).join("|")}`);
  }
}

export function projectDenueAnalyticalMarker(
  point: LatLngPoint,
  center: LatLngPoint,
  zoom: number,
  width = CARTOGRAPHIC_LOGICAL_WIDTH,
  height = CARTOGRAPHIC_LOGICAL_HEIGHT
): { x: number; y: number } {
  const projected = projectWebMercator(point);
  const projectedCenter = projectWebMercator(center);
  const zoomScale = 2 ** zoom;
  return {
    x: width / 2 + wrappedWorldDeltaX(projected.x, projectedCenter.x) * zoomScale,
    y: height / 2 + (projected.y - projectedCenter.y) * zoomScale,
  };
}

export function buildDenueAnalyticalMapImagePlan(model: DenueAnalyticalMapRenderModel): DenueAnalyticalMapImagePlan {
  const canonicalViewport = getCanonicalMapViewport(model.canonicalGeography);
  if (!canonicalViewport.center) throw new Error("DENUE_ANALYTICAL_MAP_CENTER_REQUIRED");
  const allPoints = [
    ...getCanonicalGeographyCoordinates(model.canonicalGeography),
    ...model.markers.map((marker) => marker.coordinates),
  ];
  const governed = buildGovernedCartographicDecision({
    center: canonicalViewport.center,
    points: allPoints,
    fitMode: "BOUNDS",
  });
  const overlayMarkers = model.markers.map((marker) => ({
    displayLabel: marker.displayLabel,
    displayId: marker.displayId,
    denueLayerId: marker.denueLayerId,
    ...projectDenueAnalyticalMarker(marker.coordinates, governed.viewport.center, governed.viewport.zoom),
  }));
  const outsideSafeViewport = overlayMarkers.some((marker) =>
    marker.x < governed.viewport.paddingLogicalPx ||
    marker.x > CARTOGRAPHIC_LOGICAL_WIDTH - governed.viewport.paddingLogicalPx ||
    marker.y < governed.viewport.paddingLogicalPx ||
    marker.y > CARTOGRAPHIC_LOGICAL_HEIGHT - Math.max(governed.viewport.paddingLogicalPx, ATTRIBUTION_SAFE_BOTTOM_LOGICAL_PX)
  );
  if (outsideSafeViewport) throw new Error("DENUE_ANALYTICAL_MARKER_OUTSIDE_ATTRIBUTION_SAFE_VIEWPORT");

  const params = new URLSearchParams({
    provider: "google-static-map",
    size: `${CARTOGRAPHIC_LOGICAL_WIDTH}x${CARTOGRAPHIC_LOGICAL_HEIGHT}`,
    scale: String(CARTOGRAPHIC_STATIC_MAP_SCALE),
    maptype: "roadmap",
    center: pointParam(governed.viewport.center),
    zoom: String(governed.viewport.zoom),
  });
  appendCanonicalGeometry(params, model);
  const baseMapUrl = `/api/proxy-image?${params.toString()}`;
  const modeledProviderUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&key=SERVER_SIDE`;
  if (modeledProviderUrl.length > STATIC_MAP_URL_MAX_LENGTH) throw new Error("DENUE_ANALYTICAL_MAP_URL_TOO_LONG");
  return {
    baseMapUrl,
    provider: "GOOGLE_STATIC_MAPS",
    width: CARTOGRAPHIC_LOGICAL_WIDTH,
    height: CARTOGRAPHIC_LOGICAL_HEIGHT,
    scale: CARTOGRAPHIC_STATIC_MAP_SCALE,
    center: governed.viewport.center,
    zoom: governed.viewport.zoom,
    geometryType: model.canonicalGeography.geometry.type,
    overlayMarkers,
    attributionSafeBottomLogicalPx: ATTRIBUTION_SAFE_BOTTOM_LOGICAL_PX,
  };
}

function browserBitmapBackend(): DenueAnalyticalBitmapBackend {
  return {
    async loadBaseMap(url) {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) throw new Error(`DENUE_ANALYTICAL_BASE_MAP_FETCH_FAILED:${response.status}`);
      const bitmap = await createImageBitmap(await response.blob());
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    },
    createCanvas(width, height) {
      if (typeof document === "undefined") throw new Error("DENUE_ANALYTICAL_CANVAS_UNAVAILABLE");
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("DENUE_ANALYTICAL_CANVAS_CONTEXT_UNAVAILABLE");
      return {
        context: context as unknown as ReturnType<DenueAnalyticalBitmapBackend["createCanvas"]>["context"],
        toPngArrayBuffer: () => new Promise<ArrayBuffer>((resolve, reject) => {
          canvas.toBlob(async (blob) => blob ? resolve(await blob.arrayBuffer()) : reject(new Error("DENUE_ANALYTICAL_PNG_ENCODING_FAILED")), "image/png");
        }),
      };
    },
  };
}

export async function renderDenueAnalyticalMapBitmap(
  plan: DenueAnalyticalMapImagePlan,
  backend: DenueAnalyticalBitmapBackend = browserBitmapBackend()
): Promise<{ data: ArrayBuffer; width: number; height: number; type: "png" }> {
  const base = await backend.loadBaseMap(plan.baseMapUrl);
  try {
    if (base.width < plan.width || base.height < plan.height) throw new Error("DENUE_ANALYTICAL_BASE_MAP_DIMENSIONS_INVALID");
    const canvas = backend.createCanvas(base.width, base.height);
    const scaleX = base.width / plan.width;
    const scaleY = base.height / plan.height;
    canvas.context.drawImage(base.source, 0, 0, base.width, base.height);
    for (const marker of plan.overlayMarkers) {
      const x = marker.x * scaleX;
      const y = marker.y * scaleY;
      const radius = 12 * Math.min(scaleX, scaleY);
      canvas.context.beginPath();
      canvas.context.arc(x, y, radius, 0, Math.PI * 2);
      canvas.context.fillStyle = "#0D2B52";
      canvas.context.fill();
      canvas.context.strokeStyle = "#FFFFFF";
      canvas.context.lineWidth = 2 * Math.min(scaleX, scaleY);
      canvas.context.stroke();
      canvas.context.fillStyle = "#FFFFFF";
      canvas.context.font = `bold ${Math.round(12 * Math.min(scaleX, scaleY))}px Arial`;
      canvas.context.textAlign = "center";
      canvas.context.textBaseline = "middle";
      canvas.context.fillText(marker.displayLabel, x, y);
    }
    const data = await canvas.toPngArrayBuffer();
    if (data.byteLength === 0) throw new Error("DENUE_ANALYTICAL_BITMAP_EMPTY");
    return { data, width: 420, height: Math.round(420 * base.height / base.width), type: "png" };
  } finally {
    base.release?.();
  }
}
