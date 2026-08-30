import { NextResponse } from "next/server";
import { GeoIntAnalyticsEngine } from "@/lib/geoint/geoIntAnalyticsEngine";
import { CriminalIntelligenceCorrelationEngine } from "@/lib/criminal/correlation/criminalCorrelationEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GISMemberNode {
  member_id: string;
  alias: string;
  gang: string;
  location: { lat: number; lng: number };
  confidence: number;
  source: string;
}

interface InfluenceZone {
  zone_id: string;
  gang: string;
  points: { lat: number; lng: number }[];
  influence_score: number;
  intensity: "bajo" | "medio" | "alto";
  memberCount: number;
  density: number;
}

interface ManualDrawing {
  geometry_type: "polygon" | "corridor" | "buffer";
  coordinates: { lat: number; lng: number }[];
  radio?: number;
  risk_level: "low" | "medium" | "high";
  label: string;
  timestamp: string;
}

interface AnalyzeGisRequest {
  selectedGangs: string[];
  activeLayers: string[];
  domiciles: GISMemberNode[];
  influenceZones: InfluenceZone[];
  manualDrawings: ManualDrawing[];
  allGangs: any[];
  providerTelemetry?: {
    rssCount?: number;
    hasGoogleMaps?: boolean;
    hasScince?: boolean;
    hasDenue?: boolean;
    socialMediaSignals?: Partial<Record<"telegram" | "facebook" | "instagram" | "x" | "reddit" | "search", boolean>>;
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeGisRequest;
    const {
      selectedGangs = [],
      activeLayers = [],
      domiciles = [],
      influenceZones = [],
      manualDrawings = [],
      allGangs = [],
      providerTelemetry = {}
    } = body;

    if (selectedGangs.length === 0) {
      return NextResponse.json(
        { error: "Debe seleccionar al menos una pandilla para realizar el análisis." },
        { status: 400 }
      );
    }

    // 1. Run the GeoIntAnalyticsEngine
    const engineResult = await GeoIntAnalyticsEngine.analyze({
      selectedGangs,
      activeLayers,
      domiciles: domiciles.map(d => ({
        member_id: d.member_id,
        alias: d.alias,
        gang: d.gang,
        location: d.location,
        confidence: d.confidence,
        source: d.source,
        rol: (d as any).rol || "Integrante",
        domicilioExacto: (d as any).domicilioExacto || ""
      })),
      influenceZones: influenceZones.map(z => ({
        zone_id: z.zone_id,
        gang: z.gang,
        points: z.points,
        influence_score: z.influence_score,
        intensity: z.intensity,
        memberCount: z.memberCount,
        density: z.density
      })),
      manualDrawings: manualDrawings.map(d => ({
        geometry_type: d.geometry_type,
        coordinates: d.coordinates,
        radio: d.radio,
        risk_level: d.risk_level,
        label: d.label,
        timestamp: d.timestamp
      })),
      allGangs
    });

    // 2. Generate backward-compatible CICE report metadata for UI telemetry
    const ciceReport = CriminalIntelligenceCorrelationEngine.correlate({
      selectedGangs,
      incidentsCount: 0,
      domicilesCount: domiciles.length,
      zonesCount: influenceZones.length,
      rssCount: providerTelemetry.rssCount || 0,
      hasGoogleMaps: providerTelemetry.hasGoogleMaps === true,
      hasScince: providerTelemetry.hasScince === true,
      hasDenue: providerTelemetry.hasDenue === true,
      socialMediaSignals: {
        telegram: providerTelemetry.socialMediaSignals?.telegram === true,
        facebook: providerTelemetry.socialMediaSignals?.facebook === true,
        instagram: providerTelemetry.socialMediaSignals?.instagram === true,
        x: providerTelemetry.socialMediaSignals?.x === true,
        reddit: providerTelemetry.socialMediaSignals?.reddit === true,
        search: providerTelemetry.socialMediaSignals?.search === true,
      }
    });

    // Merge CICE telemetry directly into structuredOutput to preserve UI component state
    const structuredOutput = {
      ...engineResult.structuredOutput,
      cice_report: ciceReport
    };

    return NextResponse.json({
      report: engineResult.report,
      structuredOutput,
      isAiGenerated: engineResult.isAiGenerated
    });

  } catch (error: any) {
    console.error("[API GIS Analysis] Error during analysis pipeline:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el análisis de geointeligencia.", details: error.message },
      { status: 500 }
    );
  }
}
