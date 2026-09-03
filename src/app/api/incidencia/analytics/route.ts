import { NextResponse } from "next/server";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import {
  buildCrimeQueryLineage,
  normalizeCrimeRecord,
  type RawCrimeRecord,
} from "@/utils/crimeIncidenceCanonicalPipeline";
import {
  buildCrimeIncidenceDatasetIdentity,
  missingCrimeIncidenceProvenanceConfiguration,
  readCrimeIncidenceDatasetProvenanceConfig,
} from "@/utils/crimeIncidenceDatasetProvenance";
import { evaluateCrimeDatasetAdmission } from "@/utils/crimeDatasetAdmissionGate";
import { buildCrimeSourceFingerprint } from "@/utils/crimeIncidenceSourceFingerprint.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(record: RawCrimeRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export async function GET() {
  try {
    const root = process.cwd();
    const candidates = [
      process.env.CRIME_INCIDENCE_CSV_DIR || "",
      path.join(root, "Historial SHAPES", "SELECCION PERFILADOR - INCIDENCIA DELICTIVA"),
      path.join(root, "Incidencia Delictiva"),
    ].filter(Boolean);

    const dir = candidates.find((candidate) => {
      try {
        return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    });

    if (!dir) {
      return NextResponse.json(
        { success: false, error: "CRIME_INCIDENCE_DATASET_NOT_FOUND" },
        { status: 503 }
      );
    }

    const files = fs.readdirSync(dir)
      .filter((name) => name.toLowerCase().endsWith(".csv"))
      .sort();

    const datasetHasher = createHash("sha256");
    const seenDedupKeys = new Set<string>();
    const records: Array<{
      incidentType: string | null;
      date: string | null;
      time: string | null;
      municipality: string | null;
      neighborhood: string | null;
      street: string | null;
      lat: number | null;
      lng: number | null;
      sourceFile: string;
    }> = [];

    let received = 0;
    let rejected = 0;
    let duplicates = 0;

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const csv = fs.readFileSync(fullPath, "utf8");
      const parsed = Papa.parse<RawCrimeRecord>(csv, {
        header: true,
        skipEmptyLines: true,
      });

      for (const row of parsed.data) {
        received += 1;
        datasetHasher.update(buildCrimeSourceFingerprint(row));

        const canonical = normalizeCrimeRecord(row, file);

        if (!canonical.isValid) {
          rejected += 1;
          continue;
        }

        if (seenDedupKeys.has(canonical.dedupKey)) {
          duplicates += 1;
          continue;
        }

        seenDedupKeys.add(canonical.dedupKey);

        records.push({
          incidentType: canonical.incident || null,
          date: canonical.date,
          time: canonical.time,
          municipality: text(row, ["MUNICIPIO", "municipio", "MUN_INC"]),
          neighborhood: text(row, ["NOM_ASEN", "nom_asen", "COLONIA", "colonia"]),
          street: text(row, ["NOM_VIAL", "calle", "street"]),
          lat: canonical.lat,
          lng: canonical.lng,
          sourceFile: file,
        });
      }
    }

    const datasetFingerprint = datasetHasher.digest("hex");
    const datasetReference = `INCIDENCIA_DELICTIVA:${datasetFingerprint}`;

    const geoRecords = records.filter(
      (record): record is typeof record & { lat: number; lng: number } =>
        record.lat !== null && record.lng !== null
    );

    const center = geoRecords.length > 0
      ? {
          lat: geoRecords.reduce((sum, record) => sum + record.lat, 0) / geoRecords.length,
          lng: geoRecords.reduce((sum, record) => sum + record.lng, 0) / geoRecords.length,
        }
      : { lat: 0, lng: 0 };

    const radiusMeters = geoRecords.length > 0
      ? Math.ceil(Math.max(...geoRecords.map((record) => haversineMeters(center, record))))
      : 0;

    const dates = records
      .map((record) => record.date)
      .filter((value): value is string => Boolean(value))
      .sort();

    const temporalStart = dates.length > 0 ? dates[0] : null;
    const temporalEnd = dates.length > 0 ? dates[dates.length - 1] : null;

    const lineage = buildCrimeQueryLineage({
      dataset: datasetReference,
      querySource: "CSV_LEGACY_FALLBACK",
      centerLat: center.lat,
      centerLng: center.lng,
      radiusMeters,
      coverageStatus: geoRecords.length > 0 ? "IN_COVERAGE" : "UNKNOWN_COVERAGE",
      totalScanned: received,
      matched: records.length,
      excluded: rejected + duplicates,
      duplicates,
      returnedRecords: records.length,
      startDate: temporalStart,
      endDate: temporalEnd,
    });

    const provenanceConfig = readCrimeIncidenceDatasetProvenanceConfig();
    const missingProvenance = missingCrimeIncidenceProvenanceConfiguration(provenanceConfig);

    const datasetIdentity = buildCrimeIncidenceDatasetIdentity({
      config: provenanceConfig,
      datasetReference,
      querySource: "CSV_LEGACY_FALLBACK",
      sourceStatus: "CSV_LEGACY_FALLBACK",
      coverageStatus: geoRecords.length > 0 ? "IN_COVERAGE" : "UNKNOWN_COVERAGE",
      recordCount: records.length,
      lineage,
    });

    const admission = evaluateCrimeDatasetAdmission(datasetIdentity);

    const unique = (values: Array<string | null>) =>
      Array.from(new Set(values.filter((value): value is string => Boolean(value))))
        .sort((a, b) => a.localeCompare(b, "es"));

    return NextResponse.json({
      success: true,
      dataset: "INCIDENCIA_DELICTIVA",
      files: files.length,
      totalRecords: records.length,
      governance: {
        datasetReference,
        fingerprint: datasetFingerprint,
        canonical: {
          received,
          accepted: records.length,
          rejected,
          duplicates,
        },
        provenance: {
          datasetName: provenanceConfig.datasetName,
          datasetVersion: provenanceConfig.datasetVersion,
          sourceOrganization: provenanceConfig.sourceOrganization,
          temporalStart: provenanceConfig.temporalStart,
          temporalEnd: provenanceConfig.temporalEnd,
          missing: missingProvenance,
        },
        admission: {
          status: admission.status,
          accepted: admission.accepted,
          reasons: admission.reasons,
          warnings: admission.warnings,
        },
        lineage,
      },
      filters: {
        municipalities: unique(records.map((record) => record.municipality)),
        neighborhoods: unique(records.map((record) => record.neighborhood)),
        streets: unique(records.map((record) => record.street)),
        incidentTypes: unique(records.map((record) => record.incidentType)),
      },
      records,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
