import { NextResponse } from "next/server";
import { HydroFusionProvider } from "@/lib/providers/hydroFusionProvider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");

  const lat = latStr ? parseFloat(latStr) : 21.8853;
  const lng = lngStr ? parseFloat(lngStr) : -102.2916;

  try {
    const provider = new HydroFusionProvider();
    const response = await provider.fetchData({ lat, lng });

    if (response.status !== "ok" || !response.payload) {
      return NextResponse.json({
        error: "HydroFusion computation failed",
        details: response.errors || []
      }, { status: 500 });
    }

    // response.payload is the output of GeoDataNormalizerEngine, which wraps the dataset inside normalizer payload
    const dataset = response.payload.payload; 

    if (!dataset || !dataset.semantic_analysis) {
      return NextResponse.json({
        error: "Semantic Analysis failed",
        details: "No semantic analysis data found in dataset."
      }, { status: 500 });
    }

    const semanticAnalysis = dataset.semantic_analysis;

    const responsePayload = {
      hydro_truth_score: semanticAnalysis.hydro_truth_score,
      confidence: semanticAnalysis.confidence,
      redundancy_penalty: semanticAnalysis.redundancy_penalty,
      independence_score: semanticAnalysis.independence_score,
      sources: semanticAnalysis.sources,
      // Compatibility fields for hydro_009 schema
      iri_hydrology: dataset.fused_metrics.combined_physical_risk,
      river_risk: dataset.fused_metrics.river_risk_factor,
      storm_risk: parseFloat(Math.min(1.0, (dataset.fused_metrics.precipitation_mm_hr || 0) / 15).toFixed(3)),
      fused_risk: semanticAnalysis.hydro_truth_score,
      sources_list: dataset.sources_used
    };

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    return NextResponse.json({
      error: "Internal Server Error",
      message: err.message || String(err)
    }, { status: 500 });
  }
}
