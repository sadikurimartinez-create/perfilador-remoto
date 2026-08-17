export interface UnifiedGeoDataset {
  provider: string;
  dataType: "hydrology" | "meteorology" | "infrastructure" | "osint" | "demographic" | "satellite";
  observed_at: string; // ISO date of actual real-world occurrence
  ingested_at: string; // ISO date of system collection
  geometry: {
    type: "Point" | "LineString" | "Polygon" | "MultiPolygon" | "RasterFootprint" | "Unknown";
    coordinates: any;
  };
  spatialResolution: {
    value: number | null; // numeric resolution if available
    unit: "meters/pixel" | "meters" | "kilometer_grid" | "administrative" | "neighborhood" | "global";
    description: string; // human-readable explanation
  };
  confidence: {
    score: number; // calculated 0 to 100
    factors: {
      source_authority: number; // out of 40 (institutional vs social vs public)
      temporal_freshness: number; // out of 30 (how old is the observation vs now)
      geospatial_precision: number; // out of 30 (precise GPS coordinates vs country-level)
    };
    notes: string;
  };
  payload: any; // Semantically cleaned payload matching the dataType
  metadata: {
    source_name: string;
    source_url?: string;
    license?: string;
    is_simulated?: boolean;
    origin_type?: "REAL" | "SIMULATED" | "UNAVAILABLE";
    [key: string]: any;
  };
}

export class GeoDataNormalizerEngine {
  /**
   * Centralized engine to normalize heterogenous provider raw data into a UnifiedGeoDataset.
   */
  public static normalize(
    providerId: string,
    action: string,
    rawData: any,
    lat: number,
    lng: number
  ): UnifiedGeoDataset {
    const ingested_at = new Date().toISOString();
    let dataType: UnifiedGeoDataset["dataType"] = "infrastructure";
    let observed_at = ingested_at;
    let geomType: UnifiedGeoDataset["geometry"]["type"] = "Point";
    let geomCoords: any = [lng, lat];
    let spatialVal: number | null = null;
    let spatialUnit: UnifiedGeoDataset["spatialResolution"]["unit"] = "meters";
    let spatialDesc = "High-precision coordinate reference";
    
    // Confidence calculation factors (weights: authority 40%, freshness 30%, spatial precision 30%)
    let sourceAuthority = 30; // default medium authority
    let temporalFreshness = 30; // default real-time/fresh
    let geospatialPrecision = 30; // default precise Point
    let confidenceNotes = "Standard baseline confidence parameters applied.";

    let payload: any = {};
    let sourceName = "Unknown Source";
    let license = "Proprietary / Unknown";
    let sourceUrl: string | undefined = undefined;
    let isSimulated = false;

    switch (providerId) {
      case "google":
        sourceName = "Google Maps Platform";
        license = "Google Maps Terms of Service";
        sourceAuthority = 38; // high authority
        geospatialPrecision = 28; // precise GPS point
        spatialVal = 5;
        spatialUnit = "meters";
        spatialDesc = "GPS coordinate match within 5m radius";

        if (action === "places") {
          dataType = "infrastructure";
          payload = {
            places: rawData?.results?.map((p: any) => ({
              id: p.place_id || p.id,
              name: p.name,
              rating: p.rating,
              types: p.types || [],
              address: p.vicinity || p.formatted_address
            })) || []
          };
        } else if (action === "routes") {
          dataType = "infrastructure";
          geomType = "LineString";
          geomCoords = rawData?.routes?.[0]?.legs?.[0]?.polyline || [[lng, lat]];
          payload = rawData;
        } else if (action === "elevation") {
          dataType = "hydrology"; // terrain-related for water run-off calculations
          payload = rawData;
        } else {
          dataType = "infrastructure";
          payload = rawData;
        }
        break;

      case "inegi":
        sourceName = "Instituto Nacional de Estadística y Geografía (INEGI)";
        license = "Licencia de Información Abierta INEGI";
        sourceAuthority = 39; // government authority

        if (action === "scince") {
          dataType = "demographic";
          observed_at = "2020-03-15T00:00:00.000Z"; // Mexican Census 2020
          temporalFreshness = 15; // older demographic dataset
          geomType = "Polygon"; // AGEB or Neighborhood polygons
          geomCoords = rawData?.geometry?.coordinates || [[lng - 0.01, lat - 0.01], [lng + 0.01, lat - 0.01], [lng + 0.01, lat + 0.01], [lng - 0.01, lat + 0.01]];
          spatialVal = 100;
          spatialUnit = "neighborhood";
          spatialDesc = "AGEB (Área Geoestadística Básica) demographic aggregation boundary";
          payload = rawData;
          confidenceNotes = "Demographic baseline verified under federal decennial census records.";
        } else {
          // DENUE
          dataType = "infrastructure";
          spatialVal = 50;
          spatialUnit = "meters";
          spatialDesc = "Commercial establishment georeference boundary";
          payload = rawData;
        }
        break;

      case "nasa":
        sourceName = "NASA Earth Science Data Portal";
        license = "NASA Open Earth Science Data Policy";
        sourceAuthority = 40; // absolute scientific authority
        dataType = "satellite";
        geomType = "RasterFootprint";
        
        // Define standard footprint bounding polygon for satellite granule
        geomCoords = [
          [lng - 0.5, lat - 0.5],
          [lng + 0.5, lat - 0.5],
          [lng + 0.5, lat + 0.5],
          [lng - 0.5, lat + 0.5],
          [lng - 0.5, lat - 0.5]
        ];

        if (action === "aster" || action === "gdem") {
          spatialVal = 30;
          spatialUnit = "meters/pixel";
          spatialDesc = "30-meter resolution GDEM raster tile footprint";
          observed_at = "2020-01-01T00:00:00.000Z"; // global static dataset
          temporalFreshness = 20;
          payload = rawData;
        } else {
          spatialVal = 10;
          spatialUnit = "kilometer_grid";
          spatialDesc = "Coarse orbital meteorological/climatological observation grid";
          observed_at = rawData?.collections?.[0]?.publication_date || ingested_at;
          payload = rawData;
        }
        break;

      case "copernicus":
        sourceName = "Copernicus CDSE / Sentinel Hub";
        license = "Copernicus Sentinel Data License";
        sourceAuthority = 40; // absolute scientific authority
        dataType = "satellite";
        geomType = "RasterFootprint";
        geomCoords = [
          [lng - 1.0, lat - 1.0],
          [lng + 1.0, lat - 1.0],
          [lng + 1.0, lat + 1.0],
          [lng - 1.0, lat + 1.0],
          [lng - 1.0, lat - 1.0]
        ];
        spatialVal = 10; // Sentinel 2 bands resolution is 10m
        spatialUnit = "meters/pixel";
        spatialDesc = "10-meter resolution multispectral satellite scene footprint";
        observed_at = rawData?.products?.[0]?.publication_date || ingested_at;
        payload = rawData;
        break;

      case "usgs":
        sourceName = "United States Geological Survey (USGS)";
        license = "USGS CC0 Public Domain Reference";
        sourceAuthority = 40; // high scientific authority
        
        if (action === "earthquakes") {
          dataType = "meteorology"; // seismic/meteorology geological events
          spatialVal = 500;
          spatialUnit = "meters";
          spatialDesc = "Seismic epicenter calculation boundary";
          payload = rawData;
        } else {
          // NWIS stream telemetry
          dataType = "hydrology";
          spatialVal = 1;
          spatialUnit = "meters";
          spatialDesc = "Physical hydrological sensor telemetry";
          payload = rawData;
        }
        break;

      case "cenapred":
        sourceName = "CENAPRED - Atlas Nacional de Riesgos";
        license = "Datos Abiertos Gobierno de México (CENAPRED)";
        sourceAuthority = 39; // official hazard authority
        dataType = action === "risk_assessment" ? "infrastructure" : "hydrology";
        spatialVal = 100;
        spatialUnit = "neighborhood";
        spatialDesc = "Risk zoning boundary aggregate";
        payload = rawData;
        break;

      case "conagua":
        sourceName = "CONAGUA / Servicio Meteorológico Nacional";
        license = "Servicio Meteorológico Nacional Open Portal License";
        sourceAuthority = 39;
        
        if (action === "meteorological_feed" || action === "alerts") {
          dataType = "meteorology";
          spatialVal = 5000;
          spatialUnit = "kilometer_grid";
          spatialDesc = "Municipal meteorological forecast grid cell";
          payload = rawData;
        } else {
          dataType = "hydrology"; // dam and channel levels
          spatialVal = 10;
          spatialUnit = "meters";
          spatialDesc = "Physical dam telemetry sensor station";
          payload = rawData;
        }
        break;

      case "tomorrow_io":
        sourceName = "Tomorrow.io Meteorological Service";
        license = "Tomorrow.io Private API License";
        sourceAuthority = 32; // premium private meteorological service
        dataType = "meteorology";
        spatialVal = 2000; // 2km grid
        spatialUnit = "kilometer_grid";
        spatialDesc = "Tomorrow.io high-resolution weather grid cell (2km)";
        
        if (action === "historical") {
          observed_at = new Date(Date.now() - 3600000 * 12).toISOString(); // 12h ago
        }
        payload = rawData;
        break;

      case "noaa":
        sourceName = "National Oceanic and Atmospheric Administration (NOAA)";
        license = "NOAA CDO Public Domain Reference";
        sourceAuthority = 39; // high official meteorological authority
        dataType = action === "storm_events" ? "meteorology" : "hydrology";
        spatialVal = 5000;
        spatialUnit = "kilometer_grid";
        spatialDesc = "NOAA high-fidelity meteorological station grid cell";

        if (action === "precipitation") {
          payload = {
            source: "NOAA",
            geometry: { type: "Point" as const, coordinates: [lng, lat] },
            hydrology: Math.min(1.0, (rawData?.precipitation_mm || 0) / 50), // 50mm as severe precipitation saturation limit
            meteorology: 0.0,
            confidence: 0.95,
            timestamp: ingested_at
          };
        } else if (action === "storm_events") {
          const stormWeight = rawData?.active_storms?.[0]?.weight || (rawData?.active_storms?.length > 0 ? 0.65 : 0.0);
          payload = {
            source: "NOAA",
            geometry: { type: "Point" as const, coordinates: [lng, lat] },
            hydrology: 0.0,
            meteorology: stormWeight, // maps storm events directly to meteorology scoring factor
            confidence: 0.95,
            timestamp: ingested_at
          };
        } else if (action === "temperature_anomalies") {
          payload = {
            source: "NOAA",
            geometry: { type: "Point" as const, coordinates: [lng, lat] },
            hydrology: rawData?.soil_saturation_proxy || 0.0, // maps temperature anomalies directly to soil saturation proxy
            meteorology: 0.0,
            confidence: 0.95,
            timestamp: ingested_at
          };
        } else {
          payload = rawData;
        }
        break;

      case "hydro_fusion":
        sourceName = "GEOINT HydroFusion Operational Layer";
        license = "Coordinated Multi-Source Hydrometeorological Consortium (NOAA + CONAGUA + CENAPRED)";
        sourceAuthority = 40; // absolute fused physical authority
        dataType = "hydrology";
        spatialVal = 250;
        spatialUnit = "meters";
        spatialDesc = "GEOINT Coordinated Hydrological Core Grid";
        payload = rawData;
        break;


      case "telegram":
      case "x":
      case "reddit":
        sourceName = `${providerId.toUpperCase()} Public Feed`;
        license = "OSINT Scraped Data";
        sourceAuthority = 15; // low authority (unverified social post)
        dataType = "osint";
        spatialVal = null;
        spatialUnit = "neighborhood";
        spatialDesc = "Geographically referenced post locality";
        
        // Social media observations are timestamped when posted, not when ingested
        const postTimestamp = rawData?.messages?.[0]?.date || rawData?.posts?.[0]?.timestamp || ingested_at;
        observed_at = postTimestamp;
        
        // Freshness decay penalty for OSINT
        const hoursAgo = (Date.now() - new Date(observed_at).getTime()) / 3600000;
        temporalFreshness = Math.max(5, Math.round(30 - Math.min(25, hoursAgo * 2))); // drops 2 pts per hour, max penalty of 25

        // Spatial precision penalty if no precise GPS coordinates exist
        if (rawData?.posts?.[0]?.lat && rawData?.posts?.[0]?.lng) {
          geospatialPrecision = 25;
          geomCoords = [rawData.posts[0].lng, rawData.posts[0].lat];
        } else {
          geospatialPrecision = 10; // coarse boundary
          geomCoords = [lng, lat];
        }

        payload = rawData;
        confidenceNotes = "OSINT observations suffer from citizen report noise and require cross-validation.";
        break;

      case "facebook":
      case "instagram":
        sourceName = `${providerId.toUpperCase()} Simulated OSINT Feed`;
        license = "Simulated Geotag OSINT";
        sourceAuthority = 12; // simulated/heuristic
        dataType = "osint";
        spatialVal = null;
        spatialUnit = "neighborhood";
        spatialDesc = "Simulated localized hotspot";
        observed_at = rawData?.[0]?.timestamp || ingested_at;
        isSimulated = true;
        
        payload = rawData;
        confidenceNotes = "Synthetic OSINT telemetry utilized for boundary testing.";
        break;

      default:
        payload = rawData;
        break;
    }

    // Dynamic calculation of total confidence score:
    // score = sourceAuthority (max 40) + temporalFreshness (max 30) + geospatialPrecision (max 30)
    const finalScore = Math.min(100, Math.max(10, sourceAuthority + temporalFreshness + geospatialPrecision));

    return {
      provider: providerId,
      dataType,
      observed_at,
      ingested_at,
      geometry: {
        type: geomType,
        coordinates: geomCoords
      },
      spatialResolution: {
        value: spatialVal,
        unit: spatialUnit,
        description: spatialDesc
      },
      confidence: {
        score: finalScore,
        factors: {
          source_authority: sourceAuthority,
          temporal_freshness: temporalFreshness,
          geospatial_precision: geospatialPrecision
        },
        notes: confidenceNotes
      },
      payload,
      metadata: {
        source_name: sourceName,
        source_url: sourceUrl,
        license,
        is_simulated: isSimulated || undefined
      }
    };
  }

  /**
   * Generates technical provenance tracking metadata for a given normalized dataset (Fase 2B.2).
   */
  public static getProvenance(
    providerId: string,
    action: string,
    rawData: any,
    normalized: UnifiedGeoDataset
  ): {
    raw_payload: any;
    normalized_payload: any;
    transformations: string[];
    confidence_path: string[];
    source_chain: string[];
  } {
    const transformations: string[] = [
      "Ingestion from API/Source Gateway",
      `Action router execution: '${action}'`,
    ];
    const sourceChain: string[] = [];
    
    // Default fallback chains
    let primarySource = "Remote Database / Social Post";
    let intermediary = "API Endpoints / Scraper Gateway";
    
    switch (providerId) {
      case "google":
        primarySource = "Google Maps GIS and Geolocation Infrastructure";
        intermediary = action === "places" ? "Google Places API" 
                     : action === "routes" ? "Google Directions API" 
                     : action === "elevation" ? "Google Elevation API"
                     : "Google Maps Platform";
        transformations.push(
          "Filter elements by geo-radius or bounding box",
          "Map spatial coordinates to standard Point/LineString geometry",
          "Compute localized confidence factor from Google API authority"
        );
        break;

      case "inegi":
        primarySource = "Instituto Nacional de Estadística y Geografía (INEGI) - Federal Repositories";
        intermediary = action === "scince" ? "INEGI SCINCE Censal API" : "INEGI DENUE Registry API";
        transformations.push(
          "Resolve municipal boundaries and demographic/AGEB aggregation",
          "Standardize demographic properties / establishment coordinates",
          "Apply decennial baseline decay weights to confidence scoring"
        );
        break;

      case "nasa":
        primarySource = "NASA Earth Observing System (EOS) Satellites";
        intermediary = "NASA EOSDIS / SEDAC Common Metadata Repository (CMR) V2 API";
        transformations.push(
          "Identify orbital pass times and ingest satellite granule bounds",
          "Project 2D geodetic coordinates to high-precision RasterFootprint polygon",
          "Apply NASA EarthData open-access data licensing header mapping"
        );
        break;

      case "copernicus":
        primarySource = "ESA Sentinel-2 Earth Observation Constellation";
        intermediary = "Copernicus CDSE Sentinel Hub / OData Catalog REST API";
        transformations.push(
          "Retrieve multispectral band scenes and cloud cover statistics",
          "Render spatial overlap bounding footprint on target coordinate",
          "Map Copernicus CDSE terms of service as licensing header"
        );
        break;

      case "usgs":
        primarySource = "US Geological Survey (USGS) Hydrological telemetry stations";
        intermediary = action === "earthquakes" ? "USGS Earthquake Hazards Feed" : "USGS National Water Information System (NWIS)";
        transformations.push(
          "Parse streamflow discharge values or seismic intensity records",
          "Map exact USGS station gauge Point coordinate",
          "Calibrate USGS absolute scientific authority scoring (40/40)"
        );
        break;

      case "cenapred":
        primarySource = "CENAPRED - Centro Nacional de Prevención de Desastres";
        intermediary = "Atlas Nacional de Riesgos Web Map Server / WFS API";
        transformations.push(
          "Extract geological and hydrological susceptibility hazard bands",
          "Associate regional risk zoning metadata with geographic point",
          "Map Mexican Federal open data license policy"
        );
        break;

      case "conagua":
        primarySource = "Comisión Nacional del Agua (CONAGUA) - Red de Monitoreo";
        intermediary = action === "hydrology" ? "CONAGUA Dam Monitoring Feed" : "SMN Meteorological Alert Feed";
        transformations.push(
          "Parse real-time telemetry from physical water-level station sensors",
          "Standardize weather alarm parameters and municipal grid boundaries",
          "Ponder institutional SMN data reliability under CONAGUA authority"
        );
        break;

      case "tomorrow_io":
        primarySource = "Tomorrow.io Proprietary Weather Models & Global Radar Networks";
        intermediary = "Tomorrow.io REST Weather API V4";
        transformations.push(
          "Ingest high-resolution atmospheric and precipitation datasets",
          "Map local weather grid matching (2km cell precision)",
          "Assign private commercial license permissions"
        );
        break;

      case "noaa":
        primarySource = "NOAA Integrated National Climate Observing Systems";
        intermediary = "NOAA CDO Web Services API V2";
        transformations.push(
          "Ingest precipitation, temperature, and storm event metrics",
          "Deduplicate stations and query nearest daily summaries",
          "Convert temperature anomalies to high-fidelity soil saturation proxy",
          "Standardize outputs to UnifiedGeoDataset hydrology and meteorology weights"
        );
        break;

      case "hydro_fusion":
        primarySource = "Consolidated NOAA + CONAGUA + CENAPRED Physical Observations";
        intermediary = "GEOINT HydroFusion Provider Pipeline";
        transformations.push(
          "Aggregate NOAA (precipitation, storm alerts, and temperature anomalies)",
          "Integrate CONAGUA (real-time dam storages and monitored river flow capacity)",
          "Superimpose CENAPRED (national landslide and flood risk susceptibility metrics)",
          "Fuse multiple physical indicators into a unified physical truth flood risk coefficient"
        );
        break;


      case "telegram":
      case "x":
      case "reddit":
        primarySource = `${providerId.toUpperCase()} Social Media Platform / Citizen Witness Reports`;
        intermediary = `${providerId.toUpperCase()} Developer API & Scraper Core`;
        transformations.push(
          "Ingest real-time social streams using textual flood/disaster keyword matching",
          "Apply temporal freshness decay penalty (-2 pts per hour of post age)",
          "Perform geospatial precision penalty fallback mapping (Point neighborhood resolution)"
        );
        break;

      case "facebook":
      case "instagram":
        primarySource = `Simulated ${providerId.toUpperCase()} Geotagged Media Hotspots`;
        intermediary = `Local Geointelligence OSINT Mocking Engine`;
        transformations.push(
          "Generate synthetic OSINT reports with randomized timestamps and mock comments",
          "Apply low-authority simulation confidence score penalty (12 pts authority)",
          "Set metadata simulation flag to true for downstream boundary testing"
        );
        break;

      default:
        transformations.push("Default structural mapping to UnifiedGeoDataset payload");
        break;
    }

    sourceChain.push(primarySource);
    sourceChain.push(intermediary);
    sourceChain.push(`${providerId.toUpperCase()} Provider Adapter [v2.1.0]`);
    sourceChain.push("GeoDataNormalizerEngine [v2.2.0]");

    const authority = normalized.confidence.factors?.source_authority ?? 0;
    const freshness = normalized.confidence.factors?.temporal_freshness ?? 0;
    const precision = normalized.confidence.factors?.geospatial_precision ?? 0;
    const total = normalized.confidence.score ?? 0;

    const confidencePath: string[] = [
      `Source Authority: ${authority}/40 (Weight based on institutional scientific validation)`,
      `Temporal Freshness: ${freshness}/30 (Degradation penalty based on observation age)`,
      `Geospatial Precision: ${precision}/30 (Precision rating based on point-vs-grid geo-reference)`,
      `Final Aggregated Confidence: ${total}/100`
    ];

    return {
      raw_payload: rawData,
      normalized_payload: normalized,
      transformations,
      confidence_path: confidencePath,
      source_chain: sourceChain
    };
  }
}

