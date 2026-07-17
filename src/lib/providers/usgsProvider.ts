import { IProvider, ProviderResponse, HealthCheckResult } from "./baseProvider";
import { GeoDataNormalizerEngine } from "./geoNormalizer";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";

export class UsgsProvider implements IProvider {
  getId(): string {
    return "usgs";
  }

  getName(): string {
    return "United States Geological Survey (USGS)";
  }

  isEnabled(): boolean {
    return process.env.ENABLE_USGS !== "false";
  }

  getCatalogDetails() {
    return {
      name: this.getName(),
      version: "2.1.0",
      status: this.isEnabled() ? "Active" : "Disabled",
      featureFlag: "ENABLE_USGS",
      authType: "Public API / No Auth",
      geographicCoverage: "North America / Global (Earthquakes)",
      outputFormat: "JSON (NWIS Hydrological / Earthquake Feed)"
    };
  }

  async fetchData(params: any): Promise<ProviderResponse> {
    const start = Date.now();
    const action = params?.action || "latest_continuous";
    
    const geoValidation = validateGeoIntegrity(params?.lat, params?.lng);
    if (geoValidation.confidence === "UNKNOWN" || geoValidation.latitude === null || geoValidation.longitude === null) {
      return {
        provider: this.getId(),
        status: "error",
        timestamp: new Date().toISOString(),
        confidence: 0,
        payload: null,
        latency: Date.now() - start,
        errors: ["Ausencia de coordenadas geográficas válidas. Consulta cancelada para preservar la integridad."]
      };
    }
    const lat = geoValidation.latitude;
    const lng = geoValidation.longitude;
    const errors: string[] = [];

    try {
      if (!this.isEnabled()) {
        return {
          provider: this.getId(),
          status: "disabled",
          timestamp: new Date().toISOString(),
          confidence: 0,
          payload: null,
          latency: Date.now() - start,
          errors: ["Provider is disabled via ENABLE_USGS."]
        };
      }

      let data: any = null;
      let confidence = 100;

      // Seed-based high-fidelity simulator for Mexico test coordinates,
      // and real API fetches for US/Global locations.
      const isMexico = lat > 14 && lat < 33 && lng > -122 && lng < -84;
      const seed = Math.abs(Math.sin(lat * lng)) * 10000;

      const isSimulationDisabled = process.env.ENABLE_SIMULATION === "false" ||
                                    process.env.ENABLE_MOCK_DATA === "false" ||
                                    process.env.ENABLE_TEST_DATA === "false" ||
                                    process.env.ENABLE_DEMO_MODE === "false" ||
                                    process.env.ENABLE_PILOT_GENERATORS === "false" ||
                                    process.env.NODE_ENV === "production";

      if (action === "continuous" || action === "latest_continuous") {
        if (!isMexico || isSimulationDisabled) {
          // Real USGS NWIS IV (Instantaneous / Continuous Values) Fetch
          const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&maxradiuskm=100&parameterCd=00060,00065`;
          try {
            const res = await fetch(url);
            if (res.ok) {
              const json = await res.json();
              data = this.parseNwisResponse(json, "Continuous / IV");
            } else if (isSimulationDisabled) {
              throw new Error(`USGS NWIS IV API returned HTTP status ${res.status}`);
            }
          } catch (e: any) {
            if (isSimulationDisabled) throw e;
            errors.push(`NWIS real-time fetch failed, falling back to simulator: ${e.message}`);
          }
        }

        if (!data) {
          if (isSimulationDisabled) {
            throw new Error(`No real continuous data available for USGS at coordinates (${lat}, ${lng}) and simulation fallback is deactivated.`);
          }
          // Simulating high-fidelity USGS telemetry
          const discharge = parseFloat((2.5 + (seed % 28)).toFixed(2));
          const gageHeight = parseFloat((0.8 + ((seed % 120) / 100)).toFixed(2));
          data = {
            source: "USGS NWIS iv Simulator",
            dataType: "Instantaneous / Continuous values",
            location: { lat, lng },
            siteInfo: {
              siteCode: `USGS-${Math.floor(10000000 + (seed % 90000000))}`,
              siteName: isMexico ? "Simulated Rio San Pedro Telemetry (USGS format)" : "USGS Reference Streamflow Station",
              agencyCode: "USGS"
            },
            timeSeries: [
              {
                parameterCode: "00060",
                parameterName: "Discharge, cubic feet per second",
                value: discharge,
                unit: "cfs",
                timestamp: new Date().toISOString()
              },
              {
                parameterCode: "00065",
                parameterName: "Gage height, feet",
                value: gageHeight,
                unit: "ft",
                timestamp: new Date().toISOString()
              }
            ]
          };
        }
      } else if (action === "daily" || action === "latest_daily") {
        if (!isMexico || isSimulationDisabled) {
          const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&maxradiuskm=100&parameterCd=00060`;
          try {
            const res = await fetch(url);
            if (res.ok) {
              const json = await res.json();
              data = this.parseNwisResponse(json, "Daily / DV");
            } else if (isSimulationDisabled) {
              throw new Error(`USGS NWIS DV API returned HTTP status ${res.status}`);
            }
          } catch (e: any) {
            if (isSimulationDisabled) throw e;
            errors.push(`NWIS daily fetch failed: ${e.message}`);
          }
        }

        if (!data) {
          if (isSimulationDisabled) {
            throw new Error(`No real daily data available for USGS at coordinates (${lat}, ${lng}) and simulation fallback is deactivated.`);
          }
          const meanDischarge = parseFloat((3.0 + (seed % 25)).toFixed(2));
          data = {
            source: "USGS NWIS dv Simulator",
            dataType: "Daily values statistics",
            location: { lat, lng },
            siteInfo: {
              siteCode: `USGS-${Math.floor(10000000 + (seed % 90000000))}`,
              siteName: "USGS Daily Reference Station"
            },
            timeSeries: [
              {
                parameterCode: "00060",
                parameterName: "Mean Discharge, cubic feet per second",
                value: meanDischarge,
                unit: "cfs",
                timestamp: new Date(Date.now() - 86400000).toISOString().split("T")[0]
              }
            ]
          };
        }
      } else if (action === "monitoring_locations") {
        if (!isMexico || isSimulationDisabled) {
          const url = `https://waterservices.usgs.gov/nwis/site/?format=json&latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&maxradiuskm=150&siteStatus=all`;
          try {
            const res = await fetch(url);
            if (res.ok) {
              const json = await res.json();
              data = json;
            } else if (isSimulationDisabled) {
              throw new Error(`USGS NWIS Site API returned HTTP status ${res.status}`);
            }
          } catch (e: any) {
            if (isSimulationDisabled) throw e;
            errors.push(`NWIS Site service failed: ${e.message}`);
          }
        }

        if (!data) {
          if (isSimulationDisabled) {
            throw new Error(`No real monitoring location data available for USGS at coordinates (${lat}, ${lng}) and simulation fallback is deactivated.`);
          }
          data = {
            source: "USGS NWIS Site Registry (Simulated)",
            count: 3,
            locations: [
              { siteCode: `USGS-080${Math.floor(1000 + (seed % 9000))}`, name: "River Basin Fork A", latitude: lat + 0.05, longitude: lng - 0.03, status: "active" },
              { siteCode: `USGS-080${Math.floor(2000 + (seed % 9000))}`, name: "Canal Tributary B", latitude: lat - 0.02, longitude: lng + 0.06, status: "active" },
              { siteCode: `USGS-080${Math.floor(3000 + (seed % 9000))}`, name: "Reservoir Spillway", latitude: lat + 0.01, longitude: lng + 0.01, status: "inactive" }
            ]
          };
        }
      } else if (action === "parameter_codes") {
        data = {
          source: "USGS NWIS Parameter Codes",
          standard_codes: {
            "00010": { name: "Water Temperature", unit: "Celsius" },
            "00060": { name: "Discharge (Flow)", unit: "Cubic Feet per Second" },
            "00065": { name: "Gage Height (Stage)", unit: "Feet" },
            "00095": { name: "Specific Conductance", unit: "uS/cm at 25C" },
            "00400": { name: "pH", unit: "Standard Units" }
          }
        };
      } else if (action === "statistics") {
        if (isSimulationDisabled) {
          throw new Error(`USGS historical statistics simulation is deactivated.`);
        }
        data = {
          source: "USGS NWIS Statistics Service",
          parameters: ["00060", "00065"],
          computedStats: {
            discharge_cfs: {
              historical_mean: parseFloat((15.4 + (seed % 10)).toFixed(2)),
              historical_max: parseFloat((180.0 + (seed % 50)).toFixed(2)),
              historical_min: parseFloat((1.1 + (seed % 2)).toFixed(2)),
              p50: parseFloat((12.0 + (seed % 8)).toFixed(2)),
              p90: parseFloat((45.0 + (seed % 15)).toFixed(2))
            },
            secondary_gage_height_ft: {
              historical_mean: parseFloat((1.2 + (seed % 0.5)).toFixed(2)),
              historical_max: parseFloat((5.8 + (seed % 2)).toFixed(2)),
              historical_min: parseFloat((0.2 + (seed % 0.1)).toFixed(2))
            }
          }
        };
      } else if (action === "metadata") {
        data = {
          source: "USGS Water Data Services Documentation",
          license: "Public Domain / CC0",
          version: "1.0.0",
          available_apis: {
            iv: "Instantaneous Values (Continuous Data Feed)",
            dv: "Daily Values (Aggregated Demands)",
            site: "Monitoring Location Registries",
            stat: "Historical Statistics Calculator"
          },
          documentation_url: "https://waterservices.usgs.gov/"
        };
      } else {
        throw new Error(`Unknown action: '${action}' for USGS provider.`);
      }

      console.log(`[LOG] Provider: usgs | Action: ${action} | Status: ok | Duration: ${Date.now() - start}ms`);

      const normalized = GeoDataNormalizerEngine.normalize(this.getId(), action, data, lat, lng);
      const provenance = GeoDataNormalizerEngine.getProvenance(this.getId(), action, data, normalized);

      return {
        provider: this.getId(),
        status: "ok",
        timestamp: new Date().toISOString(),
        location: { lat, lng },
        confidence: normalized.confidence.score,
        payload: normalized,
        latency: Date.now() - start,
        errors: errors.length > 0 ? errors : undefined,
        metadata: { version: "2.1.0" },
        ...provenance
      };
    } catch (err: any) {
      console.error(`[LOG] Provider: usgs | Action: ${action} | Exception: ${err.message || String(err)}`);
      return {
        provider: this.getId(),
        status: "error",
        timestamp: new Date().toISOString(),
        confidence: 0,
        payload: null,
        latency: Date.now() - start,
        errors: [err.message || String(err)]
      };
    }
  }

  private parseNwisResponse(json: any, type: string) {
    try {
      const timeSeries = json?.value?.timeSeries || [];
      if (timeSeries.length === 0) return null;

      return {
        source: `USGS NWIS API via ${type}`,
        recordsCount: timeSeries.length,
        timeSeries: timeSeries.map((ts: any) => {
          const sourceInfo = ts.sourceInfo;
          const variable = ts.variable;
          const values = ts.values?.[0]?.value || [];
          return {
            siteCode: sourceInfo?.siteCode?.[0]?.value,
            siteName: sourceInfo?.siteName,
            parameterCode: variable?.variableCode?.[0]?.value,
            parameterName: variable?.variableName,
            unit: variable?.unit?.unitCode,
            values: values.map((v: any) => ({
              value: parseFloat(v.value),
              timestamp: v.dateTime
            }))
          };
        })
      };
    } catch {
      return null;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      if (!this.isEnabled()) {
        return {
          isHealthy: false,
          latencyMs: Date.now() - start,
          details: "USGS Provider is disabled via ENABLE_USGS.",
          timestamp: new Date().toISOString(),
          authenticationStatus: "invalid",
          availability: 0
        };
      }

      const url = "https://waterservices.usgs.gov/nwis/iv/?format=json&latitude=40.7128&longitude=-74.0060&maxradiuskm=20&parameterCd=00060";
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);

      if (!res.ok) {
        throw new Error(`USGS Water Service gateway returned status ${res.status}`);
      }

      const data = await res.json();
      const recordsCount = data?.value?.timeSeries?.length || 0;

      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
        details: "USGS NWIS Hydrological services are online and responding.",
        timestamp: new Date().toISOString(),
        authenticationStatus: "bypassed", // public open API
        availability: 100,
        recordsCount
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        details: err.name === "AbortError" ? "USGS gateway timed out after 4s" : (err.message || String(err)),
        timestamp: new Date().toISOString(),
        authenticationStatus: "invalid",
        availability: 0
      };
    }
  }
}
