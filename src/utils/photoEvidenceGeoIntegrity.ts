import { validateGeoIntegrity, type GeoIntegritySource } from "./geoIntegrityEngine";

function inferPhotoGeoSource(photo: any): GeoIntegritySource {
  if (photo?.geolocationSource) return photo.geolocationSource;
  if (photo?.streetViewMetadata?.panoramaLat != null && photo?.streetViewMetadata?.panoramaLng != null) {
    return "STREET_VIEW_PANORAMA";
  }
  if (photo?.gpsSource === "EXIF" || photo?.exifLat != null || photo?.exifLng != null) return "EXIF_GPS";
  if (photo?.gpsSource === "DEVICE" || photo?.gpsLat != null || photo?.gpsLng != null) return "DEVICE_GPS";
  if (photo?.lat != null && photo?.lng != null) return "LEGACY_UNCLASSIFIED";
  return "NONE";
}

export function normalizePhotoEvidenceGeolocation(photo: any) {
  const source = inferPhotoGeoSource(photo);
  const latitude =
    source === "STREET_VIEW_PANORAMA"
      ? photo?.streetViewMetadata?.panoramaLat
      : photo?.lat ?? photo?.gpsLat ?? photo?.exifLat ?? null;
  const longitude =
    source === "STREET_VIEW_PANORAMA"
      ? photo?.streetViewMetadata?.panoramaLng
      : photo?.lng ?? photo?.gpsLng ?? photo?.exifLng ?? null;

  const geoIntegrity = validateGeoIntegrity({
    latitude,
    longitude,
    source,
    precision: photo?.gpsAccuracy ?? null,
    observedAt: photo?.gpsTimestamp ?? photo?.captureDate ?? photo?.fecha ?? null,
    sourceReference: photo?.id ? `photo:${photo.id}` : "photo:evidence",
  });

  return {
    latitude: geoIntegrity.latitude,
    longitude: geoIntegrity.longitude,
    source,
    geoIntegrity,
  };
}

export function buildPhotoEvidenceGeoFields(photo: any) {
  const normalized = normalizePhotoEvidenceGeolocation(photo);
  return {
    lat: normalized.latitude,
    lng: normalized.longitude,
    gpsLat: normalized.source === "DEVICE_GPS" || normalized.source === "EXIF_GPS" ? normalized.latitude : photo?.gpsLat ?? null,
    gpsLng: normalized.source === "DEVICE_GPS" || normalized.source === "EXIF_GPS" ? normalized.longitude : photo?.gpsLng ?? null,
    geolocationIntegrity: normalized.geoIntegrity,
    geolocationSource: normalized.source,
  };
}
