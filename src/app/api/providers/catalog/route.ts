import { NextResponse } from "next/server";
import { ApiOrchestrator } from "@/lib/providers/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orchestrator = new ApiOrchestrator();
    const providers = orchestrator.getProviders();

    const catalog = providers.map((provider) => {
      const details = provider.getCatalogDetails();
      return {
        id: provider.getId(),
        ...details
      };
    });

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        totalProviders: catalog.length,
        catalog
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Failed to retrieve provider catalog"
      },
      { status: 500 }
    );
  }
}
