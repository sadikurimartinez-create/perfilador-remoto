import { NextResponse } from "next/server";
import { CrimeDatasetValidationEngine } from "@/utils/crimeDatasetValidationEngine";

export const runtime = "nodejs";

export async function GET() {
  try {
    const report = CrimeDatasetValidationEngine.validate();
    return NextResponse.json({
      success: true,
      report
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
