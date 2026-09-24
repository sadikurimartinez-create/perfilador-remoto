import { NextRequest, NextResponse } from "next/server";

const GOOGLE_MAPS_HOST = "maps.googleapis.com";
const STATIC_MAP_PATH = "/maps/api/staticmap";
const STREET_VIEW_PATH = "/maps/api/streetview";
const FETCH_TIMEOUT_MS = 10_000;
const ALLOWED_IMAGE_HOSTS = new Set([
  GOOGLE_MAPS_HOST,
  "basemaps.cartocdn.com",
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

class ProxyRequestError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
  }
}

function serverGoogleMapsKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new ProxyRequestError("GOOGLE_MAPS_SERVER_KEY_UNAVAILABLE", 503);
  return key;
}

function parseCoordinate(value: string, label: string): void {
  const parts = value.split(",");
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (parts.length !== 2 || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new ProxyRequestError(`${label}_INVALID`);
  }
}

function validateSize(value: string): string {
  const match = /^(\d{2,4})x(\d{2,4})$/.exec(value);
  if (!match) throw new ProxyRequestError("IMAGE_SIZE_INVALID");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 300 || height < 180 || width > 640 || height > 640) throw new ProxyRequestError("IMAGE_SIZE_OUT_OF_RANGE");
  return value;
}

function validateMarker(value: string): string {
  const tokens = value.split("|");
  parseCoordinate(tokens[tokens.length - 1], "MARKER_COORDINATE");
  for (const token of tokens.slice(0, -1)) {
    if (!/^(color:[a-z0-9]+|label:[A-Z0-9])$/i.test(token)) throw new ProxyRequestError("MARKER_STYLE_INVALID");
  }
  return value;
}

function validatePath(value: string): string {
  let coordinateCount = 0;
  for (const token of value.split("|")) {
    if (/^(color:0x[0-9a-f]{6,8}|weight:\d{1,2}|fillcolor:0x[0-9a-f]{6,8}|geodesic:(true|false))$/i.test(token)) continue;
    parseCoordinate(token, "PATH_COORDINATE");
    coordinateCount += 1;
  }
  if (coordinateCount < 2) throw new ProxyRequestError("PATH_COORDINATES_REQUIRED");
  return value;
}

function buildGoogleStaticMapUpstream(searchParams: URLSearchParams): URL {
  if (searchParams.has("key")) throw new ProxyRequestError("CLIENT_API_KEY_FORBIDDEN");
  const upstream = new URL(`https://${GOOGLE_MAPS_HOST}${STATIC_MAP_PATH}`);
  const size = validateSize(searchParams.get("size") || "640x480");
  const scale = searchParams.get("scale") || "2";
  const maptype = searchParams.get("maptype") || "roadmap";
  if (!/^[12]$/.test(scale)) throw new ProxyRequestError("MAP_SCALE_INVALID");
  if (!["roadmap", "satellite", "hybrid", "terrain"].includes(maptype)) throw new ProxyRequestError("MAP_TYPE_INVALID");
  upstream.searchParams.set("size", size);
  upstream.searchParams.set("scale", scale);
  upstream.searchParams.set("maptype", maptype);

  const center = searchParams.get("center");
  if (center) {
    parseCoordinate(center, "MAP_CENTER");
    upstream.searchParams.set("center", center);
  }
  const zoom = searchParams.get("zoom");
  if (zoom) {
    const parsedZoom = Number(zoom);
    if (!Number.isInteger(parsedZoom) || parsedZoom < 0 || parsedZoom > 21) throw new ProxyRequestError("MAP_ZOOM_INVALID");
    upstream.searchParams.set("zoom", zoom);
  }
  const visibleCoordinates = searchParams.getAll("visible");
  if (visibleCoordinates.length) {
    visibleCoordinates.forEach((coordinate) => parseCoordinate(coordinate, "VISIBLE_COORDINATE"));
    visibleCoordinates.forEach((coordinate) => upstream.searchParams.append("visible", coordinate));
  }
  for (const marker of searchParams.getAll("markers")) upstream.searchParams.append("markers", validateMarker(marker));
  for (const path of searchParams.getAll("path")) upstream.searchParams.append("path", validatePath(path));
  if (!center && !visibleCoordinates.length && !upstream.searchParams.has("markers") && !upstream.searchParams.has("path")) {
    throw new ProxyRequestError("CANONICAL_MAP_GEOMETRY_REQUIRED");
  }
  upstream.searchParams.set("key", serverGoogleMapsKey());
  if (upstream.toString().length > 16_384) throw new ProxyRequestError("GOOGLE_MAP_URL_TOO_LONG");
  return upstream;
}

function buildStreetViewUpstream(searchParams: URLSearchParams): URL {
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng) throw new ProxyRequestError("STREET_VIEW_COORDINATES_REQUIRED");
  parseCoordinate(`${lat},${lng}`, "STREET_VIEW_COORDINATE");
  const upstream = new URL(`https://${GOOGLE_MAPS_HOST}${STREET_VIEW_PATH}`);
  upstream.searchParams.set("size", validateSize(searchParams.get("size") || "640x480"));
  upstream.searchParams.set("location", `${lat},${lng}`);
  const numericParams: Record<string, [number, number, string]> = {
    heading: [0, 360, "0"], pitch: [-90, 90, "0"], fov: [10, 120, "90"],
  };
  for (const [name, [minimum, maximum, fallback]] of Object.entries(numericParams)) {
    const value = searchParams.get(name) || fallback;
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) throw new ProxyRequestError(`STREET_VIEW_${name.toUpperCase()}_INVALID`);
    upstream.searchParams.set(name, value);
  }
  upstream.searchParams.set("key", serverGoogleMapsKey());
  return upstream;
}

function validateLegacyUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ProxyRequestError("REMOTE_IMAGE_URL_INVALID");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !ALLOWED_IMAGE_HOSTS.has(url.hostname)) {
    throw new ProxyRequestError("REMOTE_IMAGE_URL_FORBIDDEN");
  }
  if (url.hostname === GOOGLE_MAPS_HOST) {
    if (url.pathname !== STATIC_MAP_PATH && url.pathname !== STREET_VIEW_PATH) throw new ProxyRequestError("REMOTE_IMAGE_PATH_FORBIDDEN");
    url.searchParams.set("key", serverGoogleMapsKey());
  }
  return url;
}

function resolveUpstream(searchParams: URLSearchParams): { provider: string; url: URL } {
  if (searchParams.get("provider") === "google-static-map") {
    return { provider: "GOOGLE_STATIC_MAP", url: buildGoogleStaticMapUpstream(searchParams) };
  }
  if (searchParams.has("lat") || searchParams.has("lng")) {
    return { provider: "GOOGLE_STREET_VIEW", url: buildStreetViewUpstream(searchParams) };
  }
  const rawUrl = searchParams.get("url");
  if (!rawUrl) throw new ProxyRequestError("IMAGE_SOURCE_REQUIRED");
  const url = validateLegacyUrl(rawUrl);
  return { provider: url.hostname === GOOGLE_MAPS_HOST ? "GOOGLE_MAPS_LEGACY" : "APPROVED_IMAGE_HOST", url };
}

export async function GET(request: NextRequest) {
  let provider = "UNRESOLVED";
  try {
    const resolved = resolveUpstream(new URL(request.url).searchParams);
    provider = resolved.provider;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(resolved.url, { signal: controller.signal, redirect: "error", cache: "no-store" });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      console.warn("[PROXY IMAGE]", { provider, status: response.status, code: "REMOTE_IMAGE_HTTP_ERROR" });
      return new NextResponse("REMOTE_IMAGE_HTTP_ERROR", { status: 502 });
    }
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      console.warn("[PROXY IMAGE]", { provider, status: response.status, code: "REMOTE_CONTENT_TYPE_INVALID" });
      return new NextResponse("REMOTE_CONTENT_TYPE_INVALID", { status: 502 });
    }
    const arrayBuffer = await response.arrayBuffer();
    console.info("[PROXY IMAGE]", { provider, status: response.status, code: "IMAGE_FETCH_OK", contentType, bytes: arrayBuffer.byteLength });
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof ProxyRequestError) {
      console.warn("[PROXY IMAGE]", { provider, status: error.status, code: error.code });
      return new NextResponse(error.code, { status: error.status });
    }
    const timedOut = error instanceof Error && error.name === "AbortError";
    const code = timedOut ? "REMOTE_IMAGE_TIMEOUT" : "REMOTE_IMAGE_FETCH_FAILED";
    console.error("[PROXY IMAGE]", { provider, status: timedOut ? 504 : 502, code });
    return new NextResponse(code, { status: timedOut ? 504 : 502 });
  }
}
