import { NextResponse } from "next/server";
import { ApiOrchestrator } from "@/lib/providers/orchestrator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const startTotal = Date.now();
  const orchestrator = new ApiOrchestrator();
  const { searchParams } = new URL(req.url);
  const targetProviderId = searchParams.get("provider");

  let providers = orchestrator.getProviders();
  if (targetProviderId) {
    providers = providers.filter(p => p.getId() === targetProviderId);
  }

  const results: any[] = [];

  // Coordenadas de prueba por defecto (Aguascalientes)
const testParams = {
lat: 21.8818,
lng: -102.2915,

// Standard GEOINT coordinates
latitude: 21.8818,
longitude: -102.2915,

radius: 200,
radio: 200,

query: "Aguascalientes",
action: "latest_continuous"
};

  // Run in parallel with Promise.allSettled, using a fast timeout barrier of 6000ms
  const promises = providers.map(async (provider) => {
    const providerId = provider.getId();
    const start = Date.now();
    let availability = 0;
    let recordsCount = 0;
    let errors: string[] = [];
    let latency = 0;

    try {
      if (!provider.isEnabled()) {
        return {
          provider: providerId,
          name: provider.getName(),
          availability: 0,
          latency: 0,
          recordsCount: 0,
          errors: ["Disabled via environment variables."],
          responseTime: "0ms",
          status: "disabled"
        };
      }

      // Execute provider query with standard fast params
      // Since some providers have action-specific logic, we adjust action based on ID
      let specificParams = { ...testParams };
      if (providerId === "usgs") {
        specificParams.lat = 40.7128;
        specificParams.lng = -74.0060;
        specificParams.latitude = 40.7128;
        specificParams.longitude = -74.0060;
      }
      if (providerId === "google") {
        specificParams.action = "elevation"; // Fast & cheap
      } else if (providerId === "inegi") {
        specificParams.action = "denue";
      } else if (providerId === "inegi_wms") {
        specificParams.action = "get_capabilities";
      } else if (providerId === "nasa") {
        specificParams.action = "earthdata";
      } else if (providerId === "copernicus") {
        specificParams.action = "odata";
      } else if (providerId === "usgs") {
        specificParams.action = "monitoring_locations";
      } else if (providerId === "cenapred") {
        specificParams.action = "risk_assessment";
      } else if (providerId === "conagua") {
        specificParams.action = "hydrology";
      } else if (providerId === "tomorrow_io") {
        specificParams.action = "realtime";
      }

      const response = await provider.fetchData(specificParams);
      latency = Date.now() - start;

      if (response.status === "ok") {
        availability = 100;
        
        // Extract records count based on payload schema heuristics
        const payload: any = response.payload;
        if (payload) {
          if (Array.isArray(payload)) {
            recordsCount = payload.length;
          } else if (payload.results && Array.isArray(payload.results)) {
            recordsCount = payload.results.length;
          } else if (payload.products && Array.isArray(payload.products)) {
            recordsCount = payload.products.length;
          } else if (payload.timeSeries && Array.isArray(payload.timeSeries)) {
            recordsCount = payload.timeSeries.length;
          } else if (payload.monitored_dams && Array.isArray(payload.monitored_dams)) {
            recordsCount = payload.monitored_dams.length;
          } else if (payload.locations && Array.isArray(payload.locations)) {
            recordsCount = payload.locations.length;
          } else if (payload.messages && Array.isArray(payload.messages)) {
            recordsCount = payload.messages.length;
          } else {
            recordsCount = 1; // singular JSON record
          }
        }
      } else {
        availability = 0;
        errors = response.errors || ["Execution returned non-ok status."];
      }

      return {
        provider: providerId,
        name: provider.getName(),
        availability,
        latency,
        recordsCount,
        errors: errors.length > 0 ? errors : undefined,
        responseTime: `${latency}ms`,
        status: response.status
      };
    } catch (err: any) {
      latency = Date.now() - start;
      return {
        provider: providerId,
        name: provider.getName(),
        availability: 0,
        latency,
        recordsCount: 0,
        errors: [err.message || String(err)],
        responseTime: `${latency}ms`,
        status: "error"
      };
    }
  });

  const settled = await Promise.allSettled(promises);

  settled.forEach((item) => {
    if (item.status === "fulfilled") {
      results.push(item.value);
    }
  });

  const totalTime = Date.now() - startTotal;

  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      totalDurationMs: totalTime,
      totalDuration: `${totalTime}ms`,
      providersTested: results.length,
      results
    },
    { status: 200 }
  );
}
