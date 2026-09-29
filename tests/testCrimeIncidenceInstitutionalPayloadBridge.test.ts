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