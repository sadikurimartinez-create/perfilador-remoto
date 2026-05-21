import axios from 'axios';

const GOOGLE_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.PGP_GOOGLE_BROWSER_KEY || process.env.PGP_GOOGLE_SERVER_KEY || "";

const OVERPASS_URL =
  process.env.NEXT_PUBLIC_OVERPASS_API_URL || process.env.PGP_OVERPASS_API_URL ||
  'https://overpass-api.de/api/interpreter';

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

    } catch (error) {

      console.error(
        'GOOGLE PLACES ERROR',
        error
      );

      return [];

    }

  };

export const searchOverpass =
  async (
    lat: number,
    lng: number
  ) => {

    try {

      const query = `

[out:json];

(

node
  [amenity]
  (around:500,${lat},${lng});

way
  [amenity]
  (around:500,${lat},${lng});

relation
  [amenity]
  (around:500,${lat},${lng});

);

out center;

`;

      const response =
        await axios.post(
          OVERPASS_URL,
          query,
          {
            headers: {
              'Content-Type':
                'text/plain',
            },
          }
        );

      return (
        response.data?.elements || []
      );

    } catch (error) {

      console.error(
        'OVERPASS ERROR',
        error
      );

      return [];

    }

  };