import axios from 'axios';
import { classifyExternalFailure, invalidProviderResponse } from './externalProviderError';

const GOOGLE_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.PGP_GOOGLE_BROWSER_KEY || process.env.PGP_GOOGLE_SERVER_KEY || "";

const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const ALTERNATE_OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter';

export function getOverpassEndpoints(): [string, string] {
  const configured = process.env.PGP_OVERPASS_URL ||
    process.env.PGP_OVERPASS_API_URL ||
    process.env.NEXT_PUBLIC_OVERPASS_API_URL;
  const primary = configured || DEFAULT_OVERPASS_URL;
  const alternate = primary === DEFAULT_OVERPASS_URL ? ALTERNATE_OVERPASS_URL : DEFAULT_OVERPASS_URL;
  return [primary, alternate];
}

export function getOverpassSourceReference(): string {
  try {
    const parsed = new URL(getOverpassEndpoints()[0]);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return DEFAULT_OVERPASS_URL;
  }
}

export const searchGooglePlaces =
  async (
    lat: number,
    lng: number
  ) => {

    if (!GOOGLE_KEY) {
      console.warn("GOOGLE_KEY no configurada. Omitiendo búsqueda en Google Places.");
      return [];
    }

    try {

      const types = [

        'bar',
        'night_club',
        'casino',
        'liquor_store',
        'hotel',
        'motel',
        'gas_station',

      ];

      const results: any[] = [];

      for (const type of types) {

        const response =
          await axios.get(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
            {
              params: {
                location:
                  `${lat},${lng}`,
                radius: 500,
                type,
                key: GOOGLE_KEY,
              },
            }
          );

        const places =
          response.data?.results || [];

        results.push(...places);

      }

      return results;

    } catch {
      console.error("[Google Places] Provider request failed.");

      throw new Error("GOOGLE_PLACES_REQUEST_FAILED");

    }

  };

export const searchOverpass =
  async (
    lat: number,
    lng: number
  ) => {

    const query = `[out:json][timeout:12];
(
  node[amenity](around:500,${lat},${lng});
  way[amenity](around:500,${lat},${lng});
  relation[amenity](around:500,${lat},${lng});
    );
out center;`;
    const body = new URLSearchParams({ data: query }).toString();
    const endpoints = getOverpassEndpoints();

    for (let index = 0; index < endpoints.length; index += 1) {
      try {
        const response = await axios.post(endpoints[index], body, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'PERFILADOR-REMOTO-SSPE-CEIPOL/1.0',
          },
          timeout: 15_000,
        });
        if (!Array.isArray(response.data?.elements)) throw invalidProviderResponse();
        return response.data.elements;
      } catch (error) {
        const classified = classifyExternalFailure(error);
        const retryable = ["RATE_LIMITED", "PROVIDER_UNAVAILABLE", "NETWORK_ERROR", "TLS_CERTIFICATE_ERROR", "TIMEOUT"]
          .includes(classified.failure.reason);
        const hasAlternate = index === 0 && endpoints.length > 1;
        if (retryable && hasAlternate) {
          console.warn(`[Overpass] Primary endpoint failed (${classified.failure.reason}); trying one alternate endpoint.`);
          continue;
        }
        console.error(`[Overpass] Provider request failed (${classified.failure.reason}).`);
        throw classified;
      }
    }
    throw classifyExternalFailure(new Error("OVERPASS_UNREACHABLE"));
  };
