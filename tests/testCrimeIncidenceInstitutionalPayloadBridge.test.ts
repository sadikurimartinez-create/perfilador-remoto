jest.mock(
  "../src/utils/crimeIncidenceInstitutionalChartMaterializer",
  () => ({
    materializeCrimeIncidenceInstitutionalCharts:
      jest.fn(async (specifications: any[]) =>
        specifications.map((specification) => ({
          assetVersion: "1.0",
          visualId: specification.metadata.visualId,
          kind: specification.kind,
          visualType: "CHART",
          mimeType: "image/png",
          width: 1200,
          height: 700,
          dataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
          title: specification.title,
          caption: `TEST:${specification.kind}`,
          metadata: specification.metadata,
        }))
      ),
  })
);

import {
  enrichInstitutionalPayloadWithCrimeIncidenceVisuals,
} from "../src/utils/crimeIncidenceInstitutionalPayloadBridge";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";

function snapshot() {
  return {
    exportId: "export-001",
    expedienteId: "EXP-001",
    productClassification:
      "DESCRIPTIVE_ANALYTICAL_PRODUCT",
    analyticalLevel: "DESCRIPTIVE",
    createdAtReference: "2026-09-29T12:00:00.000Z",
    limitations: [
      "Cobertura limitada al dataset consultado.",
    ],
    lineage: {
      dataset: "dataset-incidencia-001",
      source: "TEST",
      generatedAt: "2026-09-29T12:00:00.000Z",
    },
    datasetReference: {
      datasetId: "dataset-incidencia-001",
    },
    queryReference: {
      status: "EXECUTED",
      admission: {
        accepted: true,
      },
    },
    projectionReference: {
      metrics: {
        frequency: {
          totalRecords: 10,
          byIncidentType: [
            { value: "ROBO", count: 6 },
            { value: "DAÑO", count: 4 },
          ],
        },
        percentage: {
          byIncidentType: [
            {
              value: "ROBO",
              count: 6,
              percentage: 60,
            },
            {
              value: "DAÑO",
              count: 4,
              percentage: 40,
            },
          ],
        },
        distribution: {
          byOccurredDate: [
            {
              value: "2026-09-27",
              count: 2,
            },
            {
              value: "2026-09-28",
              count: 3,
            },
            {
              value: "2026-09-29",
              count: 5,
            },
          ],
        },
      },
    },
  };
}

function historicalSnapshot() {
  const value = snapshot() as any;

  value.datasetReference = {
    datasetId: "incidencia_estadistica",
    coverage: {
      temporal: {
        start: null,
        end: null,
        status: "TEMPORAL_COVERAGE_UNKNOWN",
      },
    },
  };
  value.projectionReference.metrics = {
    frequency: {
      totalRecords: 5,
    },
  };
  delete value.lineage;

  return value;
}

function recoveredApiResult() {
  const lineage = {
    dataset: "incidencia_estadistica",
    querySource: "POSTGIS",
    filters: { radiusMeters: 1000 },
    timeRange: {
      start: "2026-09-27",
      end: "2026-09-28",
      status: "KNOWN",
    },
    geographicFilter: {
      center: { lat: 21.88, lng: -102.29 },
      radiusMeters: 1000,
      coverageStatus: "IN_COVERAGE",
    },
    recordSubset: {
      totalScanned: 5,
      matched: 5,
      excluded: 0,
      duplicates: 0,
      returnedRecords: 5,
    },
  };

  return {
    success: true,
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    data: [
      { id: "inc-1", INCIDENTE: "ROBO", FECHA: "2026-09-27", lat: 21.881, lng: -102.291, fuente: "incidencia_estadistica" },
      { id: "inc-2", INCIDENTE: "ROBO", FECHA: "2026-09-27", lat: 21.882, lng: -102.292, fuente: "incidencia_estadistica" },
      { id: "inc-3", INCIDENTE: "ROBO", FECHA: "2026-09-28", lat: 21.883, lng: -102.293, fuente: "incidencia_estadistica" },
      { id: "inc-4", INCIDENTE: "DAÑO", FECHA: "2026-09-28", lat: 21.884, lng: -102.294, fuente: "incidencia_estadistica" },
      { id: "inc-5", INCIDENTE: "DAÑO", FECHA: "2026-09-28", lat: 21.885, lng: -102.295, fuente: "incidencia_estadistica" },
    ],
    bibliografia: "C5i SSPE Aguascalientes",
    lineage,
    datasetIdentity: {
      datasetId: "incidencia_estadistica",
      datasetName: "Incidencia delictiva SSPE",
      datasetVersion: "2026.1",
      sourceType: "POSTGIS",
      sourceName: "incidencia_estadistica",
      sourceOrganization: "C5i SSPE Aguascalientes",
      temporalCoverage: lineage.timeRange,
      geographicCoverage: {
        status: "IN_COVERAGE",
        scopeCompatibility: "IN_SCOPE",
      },
      validationSummary: {
        status: "SCHEMA_VALID",
        schemaValid: true,
        recordCount: 5,
      },
      lineage,
    },
  };
}

describe(
  "crimeIncidenceInstitutionalPayloadBridge",
  () => {

    test(
      "sin snapshot ADR-022 conserva payload intacto",
      async () => {
        const payload = {
          projectId: "EXP-001",
          visualProducts: [],
        };

        const result =
          await enrichInstitutionalPayloadWithCrimeIncidenceVisuals(
            payload
          );

        expect(result).toBe(payload);
      }
    );

    test(
      "reconstruye BAR + LINE desde snapshot persistido",
      async () => {
        const result =
          await enrichInstitutionalPayloadWithCrimeIncidenceVisuals(
            {
              projectId: "EXP-001",
              crimeIncidenceExportContract: snapshot(),
              visualProducts: [],
            }
          );

        const ids = result.visualProducts.map(
          (item: any) => item.visualId
        );

        expect(ids).toContain(
          "crime-incidence-type-distribution:dataset-incidencia-001"
        );

        expect(ids).toContain(
          "crime-incidence-temporal-evolution:dataset-incidencia-001"
        );

        expect(result.visualProducts).toHaveLength(2);
      }
    );

    test(
      "recupera snapshot historico de 5 registros en memoria antes de crear BAR + LINE",
      async () => {
        const fetcher = jest.fn(async () =>
          new Response(
            JSON.stringify(recoveredApiResult()),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        ) as unknown as typeof fetch;

        const result =
          await enrichInstitutionalPayloadWithCrimeIncidenceVisuals(
            {
              projectId: "ormB9enaK4oVFjnLNtPj",
              crimeIncidenceExportContract:
                historicalSnapshot(),
              visualProducts: [],
            },
            {
              recoverIncompleteSnapshot: {
                expedienteId:
                  "ormB9enaK4oVFjnLNtPj",
                canonicalGeography: {
                  geographyId: "geo-real-case",
                  type: "INDIVIDUAL",
                  geometry: {
                    type: "Point",
                    coordinates: [-102.29, 21.88],
                  },
                  source: "PROJECT_CREATION",
                  validationStatus: "VALID",
                  createdAt: 1,
                  updatedAt: 1,
                },
                radiusMeters: 1000,
                requestedBy: "analyst-1",
                fetcher,
              },
            }
          );

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(
          result.crimeIncidenceExportContract
            .projectionReference.metrics.frequency
            .totalRecords
        ).toBe(5);
        expect(
          result.crimeIncidenceExportContract
            .projectionReference.metrics.frequency
            .byIncidentType
        ).toEqual([
          { value: "DAÑO", count: 2 },
          { value: "ROBO", count: 3 },
        ]);
        expect(
          result.crimeIncidenceExportContract
            .projectionReference.metrics.distribution
            .byOccurredDate
        ).toEqual([
          { value: "2026-09-27", count: 2 },
          { value: "2026-09-28", count: 3 },
        ]);
        expect(result.visualProducts).toHaveLength(2);
      }
    );

    test(
      "recupera ADR-022 para 28092026-0066-BRPD conservando POLYGON y radiusMeters null",
      async () => {
        const polygonCoordinates: [number, number][][] = [[
          [-102.3, 21.87],
          [-102.28, 21.87],
          [-102.28, 21.89],
          [-102.3, 21.89],
          [-102.3, 21.87],
        ]];
        const canonicalGeography: CanonicalProjectGeography = {
          geographyId: "geo-28092026-0066-BRPD",
          type: "POLYGON",
          geometry: {
            type: "Polygon",
            coordinates: polygonCoordinates,
          },
          source: "PROJECT_CREATION",
          validationStatus: "VALID",
          createdAt: 1,
          updatedAt: 1,
        };
        let observedUrl = "";
        let observedMethod = "";
        let observedRequest: Record<string, any> = {};
        const fetcher = jest.fn(
          async (input: RequestInfo | URL, init?: RequestInit) => {
            observedUrl = String(input);
            observedMethod = String(init?.method);
            observedRequest = JSON.parse(String(init?.body));
            return new Response(
              JSON.stringify(recoveredApiResult()),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        ) as unknown as typeof fetch;

        const result =
          await enrichInstitutionalPayloadWithCrimeIncidenceVisuals(
            {
              projectId: "28092026-0066-BRPD",
              crimeIncidenceExportContract:
                historicalSnapshot(),
              visualProducts: [],
            },
            {
              recoverIncompleteSnapshot: {
                expedienteId: "28092026-0066-BRPD",
                canonicalGeography,
                radiusMeters: null,
                requestedBy: "analyst-1",
                fetcher,
              },
            }
          );

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(observedUrl).toBe("/api/incidencia");
        expect(observedMethod).toBe("POST");
        expect(observedRequest).toEqual({
          canonicalSpatialQuery: {
            geometry: {
              type: "Polygon",
              coordinates: polygonCoordinates,
            },
            mode: "POLYGON_BOUNDARY",
            source: "EXPEDIENT",
            metadata: {
              queryId:
                "crime-incidence-production:28092026-0066-BRPD",
              expedienteId: "28092026-0066-BRPD",
              sourceReference:
                "expedient:28092026-0066-BRPD",
              territoryType: "POLYGON_BOUNDARY",
              radiusMeters: null,
              corridorWidthMeters: null,
            },
          },
          startDate: null,
          endDate: null,
          incidentTypes: [],
          requestedCoverage: null,
        });
        expect(JSON.stringify(observedRequest)).not.toContain(
          '"Point"'
        );
        expect(JSON.stringify(observedRequest).toLowerCase()).not.toContain(
          "centroid"
        );

        const recovered =
          result.crimeIncidenceExportContract;
        expect(recovered.lineage).toBeDefined();
        expect(recovered.projectionReference.metrics.frequency).toEqual({
          totalRecords: 5,
          byIncidentType: [
            { value: "DAÑO", count: 2 },
            { value: "ROBO", count: 3 },
          ],
        });
        expect(
          recovered.projectionReference.metrics.percentage
            .byIncidentType
        ).toEqual([
          { value: "DAÑO", count: 2, percentage: 40 },
          { value: "ROBO", count: 3, percentage: 60 },
        ]);
        expect(
          recovered.projectionReference.metrics.distribution
            .byOccurredDate
        ).toEqual([
          { value: "2026-09-27", count: 2 },
          { value: "2026-09-28", count: 3 },
        ]);

        const ids = result.visualProducts.map(
          (item: any) => item.visualId
        );
        expect(ids).toContain(
          "crime-incidence-type-distribution:incidencia_estadistica"
        );
        expect(ids).toContain(
          "crime-incidence-temporal-evolution:incidencia_estadistica"
        );
        expect(result.visualProducts).toHaveLength(2);
      }
    );

    test(
      "productos reconstruidos conservan PNG, dataset y variables",
      async () => {
        const result =
          await enrichInstitutionalPayloadWithCrimeIncidenceVisuals(
            {
              crimeIncidenceExportContract: snapshot(),
            }
          );

        for (const product of result.visualProducts) {
          expect(product.visualType).toBe("CHART");

          expect(product.assetRef).toMatch(
            /^data:image\/png;base64,/
          );

          expect(product.datasetSourceRefs).toContain(
            "dataset-incidencia-001"
          );

          expect(product.variables.length).toBeGreaterThan(0);

          expect(product.certified).toBe(false);
        }
      }
    );

    test(
      "preserva visuales previos y reemplaza duplicados ADR-022",
      async () => {
        const result =
          await enrichInstitutionalPayloadWithCrimeIncidenceVisuals(
            {
              crimeIncidenceExportContract: snapshot(),
              visualProducts: [
                {
                  id: "visual-previo",
                  visualId: "visual-previo",
                },
                {
                  id:
                    "crime-incidence-type-distribution:dataset-incidencia-001",
                  visualId:
                    "crime-incidence-type-distribution:dataset-incidencia-001",
                  assetRef: "OLD",
                },
              ],
            }
          );

        const ids = result.visualProducts.map(
          (item: any) => item.visualId
        );

        expect(
          ids.filter(
            (id: string) =>
              id ===
              "crime-incidence-type-distribution:dataset-incidencia-001"
          )
        ).toHaveLength(1);

        expect(ids).toContain("visual-previo");

        const replaced = result.visualProducts.find(
          (item: any) =>
            item.visualId ===
            "crime-incidence-type-distribution:dataset-incidencia-001"
        );

        expect(replaced.assetRef).not.toBe("OLD");
      }
    );

    test(
      "no fabrica visuales cuando ADR-022 no tiene registros",
      async () => {
        const emptySnapshot = snapshot();

        emptySnapshot.projectionReference.metrics.frequency.totalRecords =
          0;

        emptySnapshot.projectionReference.metrics.frequency.byIncidentType =
          [];

        emptySnapshot.projectionReference.metrics.percentage.byIncidentType =
          [];

        emptySnapshot.projectionReference.metrics.distribution.byOccurredDate =
          [];

        const payload = {
          crimeIncidenceExportContract: emptySnapshot,
          visualProducts: [],
        };

        const result =
          await enrichInstitutionalPayloadWithCrimeIncidenceVisuals(
            payload
          );

        expect(result).toBe(payload);
        expect(result.visualProducts).toEqual([]);
      }
    );
  }
);
