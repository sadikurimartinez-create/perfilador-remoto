import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import {
  inspectInegiTerritorialReadiness,
  resolveInegiTerritory,
} from "../src/lib/inegiTerritorialResolver";
import { adaptDenueScinceSource } from "../src/services/geoint/denueScinceOrchestrationAdapter";
import { selectAuthoritativeRoute } from "../src/lib/providers/sourceRegistry";

const importerCore = require("../scripts/inegi/importerCore.cjs");
const officialFixture = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/inegi/aguascalientes-cpv2020-minimal.json"),
  "utf8"
));

const dataset = {
  dataset_id: "inegi-cpv2020-01-fixture",
  product_name: "Marco Geoestadistico y Principales resultados por AGEB y manzana urbana, Censo 2020",
  reference_year: 2020,
  version: "CPV2020-cierre",
  imported_at: "2026-09-19T00:00:00.000Z",
  completed_at: "2026-09-19T00:10:00.000Z",
  geography_source_url: "https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/marcogeo/889463807469/01_aguascalientes.zip",
  geography_sha256: "744058229ebe6990140471605633926611b709476c85ba378892a55be0d169b7",
  census_source_url: officialFixture.documentation.sourceUrl,
  census_sha256: officialFixture.documentation.sourceSha256,
  geography_feature_count: 10,
  demographic_record_count: 5,
};

function dbWithRows(...rows: any[][]) {
  const query = jest.fn();
  for (const resultRows of rows) query.mockResolvedValueOnce({ rows: resultRows });
  return { query } as any;
}

describe("SCINCE productivo end-to-end / INEGI territorial", () => {
  test("rechaza lat/lng invalidos sin consultar PostGIS", async () => {
    const db = dbWithRows();
    const result = await resolveInegiTerritory(95, -102.2916, db);

    expect(result.status).toBe("FAILED");
    expect(result.exito).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  test("sin dataset oficial READY devuelve NOT_CONFIGURED y no inventa datos", async () => {
    const db = dbWithRows([]);
    const result = await resolveInegiTerritory(21.8853, -102.2916, db);

    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.exito).toBe(false);
    expect(result.demographics).toBeUndefined();
    expect(result.geometry).toBeUndefined();
    expect(result.epistemicIntegrity.isSimulated).toBe(false);
  });

  test("resuelve jerarquia MANZANA a MUNICIPIO y conserva solo geometria fuente", async () => {
    const polygon = { type: "MultiPolygon", coordinates: [[[[-102.3, 21.8], [-102.2, 21.8], [-102.2, 21.9], [-102.3, 21.8]]]] };
    const db = dbWithRows(
      [dataset],
      [
        { geographic_level: "MANZANA", cve_ent: "01", cve_mun: "001", cve_loc: "0001", cve_ageb: "0017", cve_mza: "001", geographic_name: null, geometry: JSON.stringify(polygon) },
        { geographic_level: "AGEB", cve_ent: "01", cve_mun: "001", cve_loc: "0001", cve_ageb: "0017", cve_mza: null, geographic_name: null, geometry: JSON.stringify(polygon) },
        { geographic_level: "LOCALIDAD", cve_ent: "01", cve_mun: "001", cve_loc: "0001", cve_ageb: null, cve_mza: null, geographic_name: "Aguascalientes", geometry: JSON.stringify(polygon) },
        { geographic_level: "MUNICIPIO", cve_ent: "01", cve_mun: "001", cve_loc: null, cve_ageb: null, cve_mza: null, geographic_name: "Aguascalientes", geometry: JSON.stringify(polygon) },
        { geographic_level: "ESTADO", cve_ent: "01", cve_mun: null, cve_loc: null, cve_ageb: null, cve_mza: null, geographic_name: "Aguascalientes", geometry: JSON.stringify(polygon) },
      ],
      [{ geographic_level: "MANZANA", pobtot: 170, vivtot: 54, vivpar_hab: 54, vivpar_deshab: 0, source_row_key: officialFixture.documentation.officialKey }]
    );

    const result = await resolveInegiTerritory(21.8853, -102.2916, db);

    expect(result.status).toBe("OBSERVED");
    expect(result.geographicLevel).toBe("MANZANA");
    expect(result.geography).toMatchObject({ municipio: { code: "001" }, localidad: { code: "0001" }, ageb: { code: "0017" }, manzana: { code: "001" } });
    expect(result.demographics).toMatchObject({ populationTotal: 170, housingTotal: 54, marginacion: null });
    expect(result.geometry).toEqual(polygon);
    expect(result.provenance).toMatchObject({
      datasetId: dataset.dataset_id,
      referenceYear: 2020,
      sourceRowKey: officialFixture.documentation.officialKey,
      queryCoordinates: { lat: 21.8853, lng: -102.2916 },
      geographicLevel: "MANZANA",
      demographicGeographicLevel: "MANZANA",
    });
    expect(result.epistemicIntegrity).toMatchObject({ acquisitionMode: "OBSERVED", semanticRole: "OBSERVATION", isSimulated: false });
  });

  test("informa MANZANA localizada con fallback demografico AGEB", async () => {
    const polygon = { type: "MultiPolygon", coordinates: [[[[-102.3, 21.8], [-102.2, 21.8], [-102.2, 21.9], [-102.3, 21.8]]]] };
    const db = dbWithRows(
      [dataset],
      [
        { geographic_level: "MANZANA", cve_ent: "01", cve_mun: "001", cve_loc: "0001", cve_ageb: "0017", cve_mza: "001", geographic_name: null, geometry: JSON.stringify(polygon) },
        { geographic_level: "AGEB", cve_ent: "01", cve_mun: "001", cve_loc: "0001", cve_ageb: "0017", cve_mza: null, geographic_name: null, geometry: JSON.stringify(polygon) },
      ],
      [{ geographic_level: "AGEB", pobtot: 800, vivtot: 260, vivpar_hab: 240, vivpar_deshab: 20, source_row_key: "01:001:0001:0017" }]
    );

    const result = await resolveInegiTerritory(21.8853, -102.2916, db);
    expect(result.geographicLevel).toBe("MANZANA");
    expect(result.demographics?.geographicLevel).toBe("AGEB");
    expect(result.provenance).toMatchObject({ geographicLevel: "MANZANA", demographicGeographicLevel: "AGEB" });
  });

  test("preserva ceros oficiales de MANZANA sin convertirlos en ausencia ni fallback AGEB", async () => {
    const polygon = { type: "MultiPolygon", coordinates: [[[[-102.3, 21.8], [-102.2, 21.8], [-102.2, 21.9], [-102.3, 21.8]]]] };
    const db = dbWithRows(
      [dataset],
      [
        { geographic_level: "MANZANA", cve_ent: "01", cve_mun: "001", cve_loc: "0001", cve_ageb: "0515", cve_mza: "043", geographic_name: null, geometry: JSON.stringify(polygon) },
        { geographic_level: "AGEB", cve_ent: "01", cve_mun: "001", cve_loc: "0001", cve_ageb: "0515", cve_mza: null, geographic_name: null, geometry: JSON.stringify(polygon) },
      ],
      [{ geographic_level: "MANZANA", pobtot: 0, vivtot: 0, vivpar_hab: 0, vivpar_deshab: 0, source_row_key: "01:001:0001:0515:043" }]
    );

    const result = await resolveInegiTerritory(21.8853, -102.2916, db);

    expect(result.status).toBe("OBSERVED");
    expect(result.geographicLevel).toBe("MANZANA");
    expect(result.demographics).toEqual({
      geographicLevel: "MANZANA",
      populationTotal: 0,
      housingTotal: 0,
      inhabitedPrivateHousing: 0,
      uninhabitedPrivateHousing: 0,
      marginacion: null,
      marginacionNote: "No disponible: marginacion no forma parte de los productos INEGI importados.",
    });
    expect(result).toMatchObject({
      poblacionTotal: "0",
      viviendasTotales: "0",
      viviendasHabitadas: "0",
      viviendasDeshabitadas: "0",
      geography: { ageb: { code: "0515" }, manzana: { code: "043" } },
      provenance: {
        sourceRowKey: "01:001:0001:0515:043",
        geographicLevel: "MANZANA",
        demographicGeographicLevel: "MANZANA",
      },
    });
  });

  test("valida el contrato reproducible del importador sin requerir GDAL", () => {
    const row = officialFixture.row;
    expect(importerCore.canonicalRowKey(row, "MANZANA")).toBe("01:001:0001:0017:001");
    expect(() => importerCore.validateCensusColumns(Object.keys(row))).not.toThrow();
    expect(() => importerCore.validateCensusColumns(["ENTIDAD", "MUN"])).toThrow(/faltan columnas/i);
    expect(() => importerCore.validateZipEntries(["capas/01m.shp", "../escape.sql"])).toThrow(/ZIP inseguro/i);
    expect(importerCore.toolNotConfiguredMessage("ogr2ogr")).toMatch(/^NOT_CONFIGURED: ogr2ogr/);
    expect(() => importerCore.assertExpectedSha("a".repeat(64), "b".repeat(64), "geografia")).toThrow(/no coincide/i);
    expect(() => importerCore.validateLayerMetadata(
      { fields: ["cvegeo", "cve_ent", "cve_mza"], geometryType: "MultiPolygon", spatialReference: "PROJCRS[...]" },
      ["cvegeo", "cve_ent", "cve_mza"],
      "MANZANA"
    )).not.toThrow();
  });

  test("READY exige cobertura completa y una carga parcial queda rechazada", () => {
    const complete = {
      geography_count: 10, demographic_count: 8, ageb_count: 2, block_count: 5,
      ageb_demographic_count: 2, block_demographic_count: 5,
      invalid_geometry_count: 0, invalid_code_count: 0,
    };
    expect(importerCore.assertCoverage(complete)).toBe("READY");
    expect(() => importerCore.assertCoverage({ ...complete, block_demographic_count: 0 })).toThrow(/DATASET_READY_INCOMPLETO/i);
    expect(() => importerCore.assertCoverage({ ...complete, invalid_geometry_count: 1 })).toThrow(/invalidos/i);
  });

  test("GDAL recibe credenciales por entorno y los errores no revelan DATABASE_URL", () => {
    const url = "postgresql://institutional:secret-value@db.example.test:5432/perfil?sslmode=require";
    const connection = importerCore.buildGdalConnection(url);
    expect(connection.argument).not.toContain("secret-value");
    expect(connection.argument).toContain("dbname='perfil'");
    expect(connection.environment).toEqual({ PGPASSWORD: "secret-value" });
    expect(importerCore.redactError(new Error(`fallo en ${url}`))).not.toContain("secret-value");
    const importer = fs.readFileSync(path.join(process.cwd(), "scripts/inegi/import-aguascalientes-2020.mjs"), "utf8");
    expect(importer).not.toContain("`PG:${databaseUrl}`");
    expect(importer).toContain("delete inheritedEnvironment.DATABASE_URL");
    expect(importer).toContain("delete inheritedEnvironment.PGPASSWORD");
  });

  test("la conexion administrativa local sin password genera un argumento GDAL seguro", () => {
    const connection = importerCore.buildGdalConnection(
      "postgresql://postgres@127.0.0.1:5432/ceipol_perfilador"
    );
    expect(connection.argument).toBe(
      "PG:host='127.0.0.1' port='5432' dbname='ceipol_perfilador' user='postgres'"
    );
    expect(connection.argument).not.toMatch(/password\s*=/i);
    expect(connection.environment).toEqual({});
  });

  test("HASH_DRIFT detiene el artefacto e informa hashes, URL y tamano", () => {
    expect(() => importerCore.assertApprovedArtifact({
      actual: "b".repeat(64),
      expected: "a".repeat(64),
      url: officialFixture.documentation.sourceUrl,
      size: 1234,
      label: "censo",
    })).toThrow(/HASH_DRIFT:.*esperado=.*recibido=.*url=.*bytes=1234/i);
  });

  test("--help funciona sin DATABASE_URL, GDAL ni PostgreSQL", () => {
    const result = spawnSync(process.execPath, [
      path.join(process.cwd(), "scripts/inegi/import-aguascalientes-2020.mjs"),
      "--help",
    ], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: "", PATH: "" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--preflight-only");
    expect(result.stdout).toContain("--retry-failed");
    expect(result.stderr).toBe("");
  });

  test("el runner Linux usa arrays y no contiene secretos ni operaciones de infraestructura", () => {
    const runner = fs.readFileSync(path.join(process.cwd(), "scripts/inegi/run-aguascalientes-2020-vps.sh"), "utf8");
    expect(runner).toContain("set -euo pipefail");
    expect(runner).toContain("COMMON_ARGS=(");
    expect(runner).toContain("--preflight-only");
    expect(runner).not.toMatch(/ceipol_app[^\n]*:|pg_hba|ALTER\s+(?:ROLE|USER)|DROP\s+TABLE|git\s+(?:push|commit)|vercel\s+deploy/i);
  });

  test("la migracion UP es aditiva y define integridad, SRID e indices", () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "database/migrations/inegi-territorial/001_inegi_territorial_dataset_up.sql"), "utf8");
    const executable = migration.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS postgis");
    expect(migration).toContain("geometry(MultiPolygon, 4326)");
    expect(migration).toMatch(/USING gist \(geom\)/i);
    expect(migration).toContain("status IN ('IMPORTING', 'READY', 'FAILED')");
    expect(migration).toContain("UNIQUE (state_code, geography_sha256, census_sha256)");
  });

  test("readiness exige PostGIS y dataset con lineage completo", async () => {
    const ready = await inspectInegiTerritorialReadiness(dbWithRows([{ available: true }], [dataset]));
    const noPostgis = await inspectInegiTerritorialReadiness(dbWithRows([{ available: false }]));

    expect(ready).toEqual({ ready: true, status: "READY", datasetId: dataset.dataset_id });
    expect(noPostgis).toMatchObject({ ready: false, status: "NOT_CONFIGURED" });
    expect(selectAuthoritativeRoute("SCINCE", { scinceReadiness: ready })).toMatchObject({
      routeId: "inegi.territorial.local-postgis",
      authoritative: true,
      selectedForProductiveAcquisition: true,
    });
    expect(selectAuthoritativeRoute("SCINCE")).toBeNull();
  });

  test("adapter admite fuente oficial verificada y mantiene simulador inelegible", () => {
    const official = adaptDenueScinceSource({ integrity: {
      sourceId: "INEGI_CPV2020_LOCAL_POSTGIS", providerId: "INEGI", sourceType: "INEGI_TERRITORIAL_CPV2020",
      acquisitionMode: "OBSERVED", acquisitionStatus: "ACQUIRED", isSimulated: false,
      sourceReference: "dataset:inegi-cpv2020-01", rawSourceReference: `sha256:${"a".repeat(64)}`,
      query: "21.8853,-102.2916", resultCount: 1,
    } });
    const simulated = adaptDenueScinceSource({ integrity: {
      sourceId: "SCINCE_LOCAL_SIMULATOR", providerId: "SCINCE_LOCAL_SIMULATOR", sourceType: "SCINCE",
      acquisitionMode: "SIMULATED", acquisitionStatus: "ACQUIRED", isSimulated: true,
    } });

    expect(official?.source).toMatchObject({ authorityClassification: "AUTHORITATIVE", integrityClassification: "VERIFIED" });
    expect(official?.eligibility).toBe("ELIGIBLE");
    expect(simulated?.eligibility).toBe("INELIGIBLE");
  });

  test("ruta productiva no usa simulador, token embebido ni DDL en runtime", () => {
    const osint = fs.readFileSync(path.join(process.cwd(), "src/lib/osintActions.ts"), "utf8");
    const indicators = fs.readFileSync(path.join(process.cwd(), "src/lib/inegiIndicators.ts"), "utf8");
    const resolver = fs.readFileSync(path.join(process.cwd(), "src/lib/inegiTerritorialResolver.ts"), "utf8");

    expect(osint).toContain("return resolveInegiTerritory(Number(lat), Number(lng))");
    expect(osint).not.toMatch(/Math\.(sin|random).*SCINCE|seed\s*=.*lat.*lng/s);
    expect(indicators).not.toMatch(/INEGI_API_TOKEN\s*\|\|/);
    expect(indicators).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{20,}/i);
    expect(resolver).not.toMatch(/CREATE\s+TABLE|CREATE\s+EXTENSION/i);
  });

  test("UI y reporte persisten producto, nivel, codigos, consulta y checksums", () => {
    const ui = fs.readFileSync(path.join(process.cwd(), "src/components/PhotoAlbum.tsx"), "utf8");
    const report = fs.readFileSync(path.join(process.cwd(), "src/lib/reportEngine.ts"), "utf8");

    expect(ui).toContain("Demografía territorial — INEGI");
    expect(ui).toContain("scinceDemographics: scinceDataConfirm.payload");
    expect(ui).toContain("provenance: scinceDataConfirm.payload?.provenance");
    expect(ui).toContain("queryCoordinates: scinceDataConfirm.payload?.coordenadas");
    expect(ui).not.toContain("SCINCE disponible actualmente corresponde a una simulación diagnóstica");
    expect(report).toContain("editorialPayload as any).scinceDemographics = this.context.scinceDemographics");
  });

  const realIntegrationEnabled =
    process.env.SCINCE_REAL_INTEGRATION === "1" &&
    Boolean(process.env.DATABASE_URL?.trim());
  const integrationTest = realIntegrationEnabled ? test : test.skip;
  integrationTest("integracion PostGIS real en 21.8853,-102.2916", async () => {
    const result = await resolveInegiTerritory(21.8853, -102.2916);

    expect(result.status).toBe("OBSERVED");
    expect(result.exito).toBe(true);
    expect(result.geometry).toBeDefined();
    expect(result.geographicLevel).toBe("MANZANA");
    expect(result.geography).toMatchObject({
      estado: { code: "01" },
      municipio: { code: "001" },
      localidad: { code: "0001" },
      ageb: { code: "0515" },
      manzana: { code: "043" },
    });
    expect(result.demographics).toMatchObject({
      geographicLevel: "MANZANA",
      populationTotal: 0,
      housingTotal: 0,
      inhabitedPrivateHousing: 0,
      uninhabitedPrivateHousing: 0,
      marginacion: null,
    });
    expect(result).toMatchObject({
      poblacionTotal: "0",
      viviendasTotales: "0",
      viviendasHabitadas: "0",
      viviendasDeshabitadas: "0",
    });
    expect(result.provenance).toMatchObject({
      datasetId: "inegi-cpv2020-01-744058229ebe-cac8849a7f67",
      referenceYear: 2020,
      sourceRowKey: "01:001:0001:0515:043",
      queryCoordinates: { lat: 21.8853, lng: -102.2916 },
      geographicLevel: "MANZANA",
      demographicGeographicLevel: "MANZANA",
    });
    expect(result.provenance?.productName).toContain("Censo 2020");
    expect(result.epistemicIntegrity).toMatchObject({
      providerId: "INEGI",
      sourceType: "INEGI_TERRITORIAL_CPV2020",
      acquisitionMode: "OBSERVED",
      acquisitionStatus: "ACQUIRED",
      isSimulated: false,
    });
  });
});
