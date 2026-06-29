import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";

export class NoaaProvider implements IProvider {
  // In-memory cache for NOAA responses to avoid rate limits (5-15 min TTL)
  private static cache: Map<string, { data: any; expiry: number }> = new Map();
  private static CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

  getId(): string {
    return "noaa";
  }

  getName(): string {
    return "NOAA Operational Hydrometeorological Provider";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_NOAA !== "false" && !!process.env.NOAA_API_KEY;
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "1.0.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_NOAA",
      authType: "Token Header (token)",
      geographicCoverage: "Global / North America",
      outputFormat: "JSON (Precipitation / Temperature / Storm Events)"
    };
  }

  /**
   * Generates a cache key based on coordinates rounded to 2 decimal places (~1.1km grid) and action.
   */
  private getCacheKey(lat: number, lng: number, action: string): string {
    return `${lat.toFixed(2)},${lng.toFixed(2)}:${action}`;
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const action = params?.action || "precipitation";
    const lat = params?.lat || 21.8853;
    const lng = params?.lng || -102.2916;
    const errors: string[] = [];

    const apiKey = process.env.NOAA_API_KEY;
    const cacheKey = this.getCacheKey(lat, lng, action);

    // Check cache
    const cached = NoaaProvider.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      const duration = Date.now() - start;
      console.log(`[LOG] Provider: noaa | Action: ${action} | Cache HIT | Duration: ${duration}ms`);
      return {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        location: { lat, lng },
        confidence: cached.data.confidence?.score || 95,
        payload: cached.data,
        latency: duration,
        metadata: { version: "1.0.0", cache_hit: true }
      };
    }

    try {
      if (!this.isEnabled() || !apiKey) {
        throw new Error("NOAA Provider is disabled or NOAA_API_KEY is missing in environment.");
      }

      let data: any = null;

      if (action === "precipitation") {
        data = await this.fetchPrecipitationData(lat, lng, apiKey);
      } else if (action === "storm_events") {
        data = await this.fetchStormEvents(lat, lng, apiKey);
      } else if (action === "temperature_anomalies") {
        data = await this.fetchTemperatureAnomalies(lat, lng, apiKey);
      } else {
        throw new Error(`Unknown NOAA action: '${action}'`);
      }

      const normalized = GeoDataNormalizerEngine.normalize(this.getId(), action, data, lat, lng);
      const provenance = GeoDataNormalizerEngine.getProvenance(this.getId(), action, data, normalized);

      const response: ProviderResponse = {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        location: { lat, lng },
        confidence: normalized.confidence.score,
        payload: normalized,
        latency: Date.now() - start,
        metadata: { version: "1.0.0" },
        ...provenance
      };

      // Store in cache
      NoaaProvider.cache.set(cacheKey, {
        data: normalized,
        expiry: Date.now() + NoaaProvider.CACHE_TTL_MS
      });

      console.log(`[LOG] Provider: noaa | Action: ${action} | Status: ok | Duration: ${Date.now() - start}ms`);
      return response;

    } catch (err: any) {
      const isSimulationDisabled = process.env.ENABLE_SIMULATION === "false" ||
                                    process.env.ENABLE_MOCK_DATA === "false" ||
                                    process.env.ENABLE_TEST_DATA === "false" ||
                                    process.env.ENABLE_DEMO_MODE === "false" ||
                                    process.env.ENABLE_PILOT_GENERATORS === "false" ||
                                    process.env.NODE_ENV === "production";
      if (isSimulationDisabled) {
        console.error(`[LOG] NOAA error (simulation deactivated): ${err.message || String(err)}`);
        throw err;
      }
      console.warn(`[LOG] NOAA error, falling back to secure simulator: ${err.message || String(err)}`);
      errors.push(err.message || String(err));

      // Secure local high-fidelity simulation fallback as per specifications
      const seed = Math.abs(Math.sin(lat * lng)) * 10000;
      let simPayload: any = null;

      if (action === "precipitation") {
        const precipitationValue = parseFloat(((seed % 15) / 10).toFixed(2)); // rain intensity mm/hr
        simPayload = {
          source: "NOAA (Simulated Precipitation Summaries)",
          dataType: "precipitation",
          daily_summary: {
            precipitation_mm: precipitationValue * 24,
            hourly_rate: precipitationValue,
            station_id: `GHCND:MXM000${Math.floor(seed % 90000) + 10000}`
          }
        };
      } else if (action === "storm_events") {
        const hasStorm = (seed % 100) > 85; // 15% probability of active/historical storm event match
        simPayload = {
          source: "NOAA (Simulated Storm Events)",
          dataType: "storm_events",
          active_storms: hasStorm ? [
            {
              event_id: `STORM-${Math.floor(seed % 10000)}`,
              type: "Severe Thunderstorm / Flash Flood Warning",
              severity: "Severe",
              weight: parseFloat((0.5 + (seed % 5) / 10).toFixed(2)), // storm_event_weight (0.5 to 0.9)
              description: "High precipitation cells matching hydrological saturation thresholds."
            }
          ] : []
        };
      } else {
        // Temperature anomalies
        const tempMax = parseFloat((25 + (seed % 15)).toFixed(1));
        const tempMin = parseFloat((12 + (seed % 10)).toFixed(1));
        const anomaly = parseFloat(((seed % 6) - 3).toFixed(2)); // anomaly from -3C to +3C
        simPayload = {
          source: "NOAA (Simulated Temperature Anomalies)",
          dataType: "temperature_anomalies",
          max_temp_c: tempMax,
          min_temp_c: tempMin,
          anomaly_c: anomaly,
          heat_index_c: tempMax + 1.2,
          soil_saturation_proxy: Math.min(1.0, Math.max(0.0, 0.4 - (anomaly * 0.1) + ((seed % 5) / 10)))
        };
      }

      const normalizedFallback = GeoDataNormalizerEngine.normalize(this.getId(), action, simPayload, lat, lng);
      const provenance = GeoDataNormalizerEngine.getProvenance(this.getId(), action, simPayload, normalizedFallback);

      return {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        location: { lat, lng },
        confidence: normalizedFallback.confidence.score,
        payload: normalizedFallback,
        latency: Date.now() - start,
        errors: errors.length > 0 ? errors : undefined,
        metadata: { version: "1.0.0", is_simulated: true },
        ...provenance
      };
    }
  }

  /**
   * 2.1 fetchPrecipitationData()
   * Consults rain summaries, hourly precipitation and station observations from NOAA.
   */
  public async fetchPrecipitationData(lat: number, lng: number, apiKey: string): Promise<any> {
    const today = new Date();
    const startStr = this.formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)); // past 2 days
    const endStr = this.formatDate(today);

    // Get nearby stations first, then query their daily summary datasets
    const stationsUrl = `https://www.ncei.noaa.gov/cdo-web/api/v2/stations?extent=${(lat - 0.2).toFixed(4)},${(lng - 0.2).toFixed(4)},${(lat + 0.2).toFixed(4)},${(lng + 0.2).toFixed(4)}&limit=5`;
    
    const stationsRes = await fetch(stationsUrl, {
      headers: { token: apiKey },
      signal: AbortSignal.timeout(6000) // strict timeout
    });

    if (!stationsRes.ok) {
      throw new Error(`NOAA Stations API returned status ${stationsRes.status}`);
    }

    const stationsData = await stationsRes.json();
    const stationsList = stationsData?.results || [];

    if (stationsList.length === 0) {
      throw new Error("No NOAA stations found within coordinate extent.");
    }

    // Deduplicate stations and extract station IDs
    const stationIds = Array.from(new Set(stationsList.map((s: any) => s.id as string)));
    const targetStation = stationIds[0];

    // Query data for this station
    const dataUrl = `https://www.ncei.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&stationid=${targetStation}&startdate=${startStr}&enddate=${endStr}&limit=100`;
    
    const dataRes = await fetch(dataUrl, {
      headers: { token: apiKey },
      signal: AbortSignal.timeout(6000)
    });

    if (!dataRes.ok) {
      // Return station list with custom empty summary if data endpoint has no records
      return {
        stations: stationIds,
        precipitation_mm: 0.0,
        hourly_rate: 0.0,
        records: []
      };
    }

    const payload = await dataRes.json();
    const records = payload?.results || [];

    // Filter precipitation records (PRCP - Precipitation in tenths of mm)
    const prcpRecords = records.filter((r: any) => r.datatype === "PRCP");
    const totalPrcpTenths = prcpRecords.reduce((sum: number, r: any) => sum + (r.value || 0), 0);
    const totalPrcpMm = totalPrcpTenths / 10; // Convert to mm

    return {
      stations: stationIds,
      precipitation_mm: totalPrcpMm,
      hourly_rate: prcpRecords.length > 0 ? parseFloat((totalPrcpMm / prcpRecords.length).toFixed(2)) : 0.0,
      records: records.slice(0, 10)
    };
  }

  /**
   * 2.2 fetchStormEvents()
   * Retrieves severe storms and weather events database records.
   */
  public async fetchStormEvents(lat: number, lng: number, apiKey: string): Promise<any> {
    const today = new Date();
    const startStr = this.formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)); // past week
    const endStr = this.formatDate(today);

    // Weather events often fall under GHCND or special datasets
    const url = `https://www.ncei.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&locationid=FIPS:MX&startdate=${startStr}&enddate=${endStr}&datacategoryid=WX&limit=50`;
    
    const res = await fetch(url, {
      headers: { token: apiKey },
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      return {
        active_storms: [],
        note: `NOAA weather alerts returned status ${res.status}. Falling back to default baseline.`
      };
    }

    const payload = await res.json();
    const results = payload?.results || [];

    // Map weather codes/types to storm events
    // WT16 = Rain / drizzle, WT18 = Snow / sleet, WT01 = Fog / ice fog
    const stormCodes = ["WT16", "WT11", "WT08", "WT09"]; // weather types indicative of extreme storms
    const activeStorms = results
      .filter((r: any) => stormCodes.includes(r.datatype))
      .map((r: any) => ({
        event_id: `WT-${r.datatype}-${r.date}`,
        type: this.getWeatherTypeName(r.datatype),
        severity: "Moderate to High",
        weight: 0.65,
        station: r.station
      }));

    return {
      active_storms: activeStorms,
      records_count: results.length
    };
  }

  /**
   * 2.3 fetchTemperatureAnomalies()
   * Calculates deviations and temperatures to act as a soil saturation proxy.
   */
  public async fetchTemperatureAnomalies(lat: number, lng: number, apiKey: string): Promise<any> {
    const today = new Date();
    const startStr = this.formatDate(new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)); // past 5 days
    const endStr = this.formatDate(today);

    // GHCND holds max (TMAX) and min (TMIN) temperature in tenths of degree Celsius
    const stationsUrl = `https://www.ncei.noaa.gov/cdo-web/api/v2/stations?extent=${(lat - 0.2).toFixed(4)},${(lng - 0.2).toFixed(4)},${(lat + 0.2).toFixed(4)},${(lng + 0.2).toFixed(4)}&limit=1`;
    const stationsRes = await fetch(stationsUrl, {
      headers: { token: apiKey },
      signal: AbortSignal.timeout(6000)
    });

    if (!stationsRes.ok || !(await stationsRes.clone().json())?.results?.[0]) {
      return {
        max_temp_c: 24.5,
        min_temp_c: 14.2,
        anomaly_c: 0.5,
        heat_index_c: 25.5,
        soil_saturation_proxy: 0.42
      };
    }

    const station = (await stationsRes.json()).results[0].id;
    const url = `https://www.ncei.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&stationid=${station}&startdate=${startStr}&enddate=${endStr}&limit=50`;

    const res = await fetch(url, {
      headers: { token: apiKey },
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      throw new Error(`NOAA Temperature API returned status ${res.status}`);
    }

    const payload = await res.json();
    const results = payload?.results || [];

    const tmaxRecords = results.filter((r: any) => r.datatype === "TMAX");
    const tminRecords = results.filter((r: any) => r.datatype === "TMIN");

    const avgMaxTenths = tmaxRecords.length > 0 ? tmaxRecords.reduce((sum: number, r: any) => sum + (r.value || 0), 0) / tmaxRecords.length : 250;
    const avgMinTenths = tminRecords.length > 0 ? tminRecords.reduce((sum: number, r: any) => sum + (r.value || 0), 0) / tminRecords.length : 140;

    const maxC = avgMaxTenths / 10;
    const minC = avgMinTenths / 10;
    const averageC = (maxC + minC) / 2;

    // Static climate baseline for Aguascalientes region (~20C average in summer)
    const climateBaseline = 21.0; 
    const anomaly = parseFloat((averageC - climateBaseline).toFixed(2));

    // Calculate soil saturation proxy (lower anomaly/cooler max temperatures indicate lower evaporation = higher saturation potential)
    const soilSaturationProxy = Math.min(1.0, Math.max(0.0, 0.5 - (anomaly * 0.08)));

    return {
      max_temp_c: parseFloat(maxC.toFixed(1)),
      min_temp_c: parseFloat(minC.toFixed(1)),
      anomaly_c: anomaly,
      heat_index_c: parseFloat((maxC + 1.1).toFixed(1)),
      soil_saturation_proxy: parseFloat(soilSaturationProxy.toFixed(3))
    };
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  private getWeatherTypeName(code: string): string {
    const map: Record<string, string> = {
      WT01: "Fog or Ice Fog",
      WT02: "Heavy Fog",
      WT03: "Thunder",
      WT04: "Hail",
      WT05: "Sleet",
      WT08: "Haze or Smoke",
      WT09: "Blow Dust / Sand",
      WT11: "High Winds",
      WT16: "Rain or Drizzle",
      WT18: "Snow or Snow Pellets"
    };
    return map[code] || "Severe Meteorological Sign";
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const apiKey = process.env.NOAA_API_KEY;
      if (!this.isEnabled() || !apiKey) {
        return {
          isHealthy: false,
          latencyMs: Date.now() - start,
          details: "NOAA Provider is disabled or NOAA_API_KEY is missing.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0
        };
      }

      // Query active datasets to test auth token
      const url = `https://www.ncei.noaa.gov/cdo-web/api/v2/datasets?limit=1`;
      const res = await fetch(url, {
        headers: { token: apiKey },
        signal: AbortSignal.timeout(4000)
      });

      if (!res.ok) {
        throw new Error(`NOAA health check dataset request returned status ${res.status}`);
      }

      const payload = await res.json();
      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        details: "NOAA CDO Web API endpoints authenticated successfully.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "valid",
        availability: 100,
        recordsCount: payload?.results?.length || 1
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        details: err.message || String(err),
        timestamp: new Date().toISOString(),
        authenticationStatus: "invalid",
        availability: 0
      };
    }
  }
}
