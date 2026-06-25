import { NextResponse } from "next/server";
import { ProviderResponse } from "@/lib/providers/baseProvider";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  
  const samples: Record<string, ProviderResponse> = {
    google: {
      provider: "google",
      status: "ok",
      timestamp,
      location: { lat: 21.8853, lng: -102.2916, address: "Plaza de la Patria, Aguascalientes, Mexico" },
      confidence: 100,
      payload: {
        source: "Google Places",
        results: [
          { name: "Catedral de Aguascalientes", types: ["place_of_worship", "tourist_attraction"], rating: 4.8 }
        ]
      },
      metadata: { version: "2.1.0" },
      license: "Google Maps Platform Terms of Service",
      latency: 120
    },
    inegi: {
      provider: "inegi",
      status: "ok",
      timestamp,
      location: { lat: 21.8853, lng: -102.2916 },
      confidence: 100,
      payload: {
        source: "INEGI DENUE / SCINCE",
        demographics: { total_population: 948902, age_median: 27.4 },
        denue_establishments_count: 45
      },
      metadata: { version: "2.1.0" },
      license: "Licencia de Uso de Información INEGI (Libre)",
      latency: 240
    },
    nasa: {
      provider: "nasa",
      status: "ok",
      timestamp,
      location: { lat: 21.8853, lng: -102.2916 },
      confidence: 100,
      payload: {
        source: "NASA Common Metadata Repository (CMR)",
        total_found: 3,
        collections: [
          { id: "C1239243452-NASA_GESDISC", title: "GPM Ground Validation Autonomous Precipitation Station" }
        ]
      },
      metadata: { version: "2.1.0" },
      license: "NASA Earth Science Data Policy (Public Domain)",
      latency: 350
    },
    copernicus: {
      provider: "copernicus",
      status: "ok",
      timestamp,
      location: { lat: 21.8853, lng: -102.2916 },
      confidence: 100,
      payload: {
        source: "Copernicus Space / Sentinel Catalog",
        products: [
          { id: "SENTINEL-2A-TILE-X", name: "S2A_MSIL2A_20260624T175901", online: true }
        ]
      },
      metadata: { version: "2.1.0" },
      license: "Copernicus Sentinel Data Terms & Conditions",
      latency: 410
    },
    usgs: {
      provider: "usgs",
      status: "ok",
      timestamp,
      location: { lat: 21.8853, lng: -102.2916 },
      confidence: 100,
      payload: {
        source: "USGS NWIS Hydrological Station",
        siteInfo: { siteCode: "USGS-08012300", siteName: "Río San Pedro Station (USGS format)" },
        timeSeries: [
          { parameterCode: "00060", parameterName: "Discharge", value: 12.4, unit: "cfs" }
        ]
      },
      metadata: { version: "2.1.0" },
      license: "USGS Creative Commons CC0 1.0 (Public Domain)",
      latency: 180
    },
    cenapred: {
      provider: "cenapred",
      status: "ok",
      timestamp,
      location: { lat: 21.8853, lng: -102.2916 },
      confidence: 100,
      payload: {
        source: "CENAPRED - Atlas Nacional de Riesgos",
        assessment: { flood_susceptibility: "Media", slope_instability: "Baja" }
      },
      metadata: { version: "2.1.0" },
      license: "Datos Abiertos Gobierno de México (CENAPRED)",
      latency: 90
    },
    conagua: {
      provider: "conagua",
      status: "ok",
      timestamp,
      location: { lat: 21.8853, lng: -102.2916 },
      confidence: 100,
      payload: {
        source: "CONAGUA Dam Levels & River Channels",
        state: "Aguascalientes",
        monitored_dams: [
          { name: "Presa Plutarco Elías Calles", percentage_capacity: 52.4, status: "Normal" }
        ]
      },
      metadata: { version: "2.1.0" },
      license: "Servicio Meteorológico Nacional / CONAGUA Libre",
      latency: 130
    },
    tomorrow_io: {
      provider: "tomorrow_io",
      status: "ok",
      timestamp,
      location: { lat: 21.8853, lng: -102.2916 },
      confidence: 100,
      payload: {
        source: "Tomorrow.io Realtime Weather",
        values: { temperature: 24.5, humidity: 62, precipitationIntensity: 0.1 }
      },
      metadata: { version: "2.1.0" },
      license: "Tomorrow.io API License Terms",
      latency: 110
    },
    telegram: {
      provider: "telegram",
      status: "ok",
      timestamp,
      confidence: 90,
      payload: {
        source: "Telegram OSINT Scraper",
        channels: ["@seguridad_ags"],
        messages: [
          { text: "Accidente menor en Blvd. a Zacatecas, paso lento.", date: "2026-06-25T08:15:00Z" }
        ]
      },
      metadata: { version: "2.1.0" },
      license: "OSINT Public Scraped Data",
      latency: 150
    },
    x: {
      provider: "x",
      status: "ok",
      timestamp,
      confidence: 90,
      payload: {
        source: "X / Twitter API",
        posts: [
          { text: "Fuerte aguacero en la zona norte de Aguascalientes.", user: "clima_ags" }
        ]
      },
      metadata: { version: "2.1.0" },
      license: "X Developer API Terms",
      latency: 220
    },
    facebook: {
      provider: "facebook",
      status: "ok",
      timestamp,
      confidence: 70,
      payload: {
        source: "Facebook OSINT Simulation",
        posts: [
          { content: "[Vecinos Vigilantes] Reportan calle anegada tras tormenta.", url: "https://facebook.com/groups/vecinos_ags" }
        ]
      },
      metadata: { version: "2.1.0", is_simulated: true },
      license: "Simulated OSINT Data",
      latency: 10
    },
    instagram: {
      provider: "instagram",
      status: "ok",
      timestamp,
      confidence: 70,
      payload: {
        source: "Instagram Geotag Simulation",
        posts: [
          { content: "Encharcamiento considerable en Av. Convención.", hashtags: ["#Aguascalientes", "#Lluvias"] }
        ]
      },
      metadata: { version: "2.1.0", is_simulated: true },
      license: "Simulated OSINT Data",
      latency: 5
    },
    reddit: {
      provider: "reddit",
      status: "ok",
      timestamp,
      confidence: 90,
      payload: {
        source: "Reddit Search API",
        threads: [
          { title: "Zonas inundables en Aguascalientes que recomienden evitar", subreddit: "r/aguascalientes" }
        ]
      },
      metadata: { version: "2.1.0" },
      license: "Reddit API Terms of Service",
      latency: 170
    }
  };

  return NextResponse.json(
    {
      status: "ok",
      timestamp,
      schema: "ProviderResponse { provider, status, timestamp, geometry, location, confidence, payload, metadata, license, latency, errors }",
      totalSamples: Object.keys(samples).length,
      samples
    },
    { status: 200 }
  );
}
