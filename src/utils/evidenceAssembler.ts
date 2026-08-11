/**
 * Evidence Assembler v1.0
 * ADR-013
 *
 * Responsabilidad:
 * Transformar evidencia certificada del
 * IntelligenceReportPayload en evidencias
 * documentales trazables.
 *
 * Regla:
 * Ninguna evidencia entra al documento
 * sin trazabilidad mínima.
 */


export interface DocumentEvidence {

  id: string;

  type:
    | "PHOTO"
    | "STREET_VIEW"
    | "MAP"
    | "GRAPH";

  source: string;

  dataUrl: string;

  title?: string;

  description?: string;

  analyticalRelation?: string;

  location?: string;

}



function isValidDataUrl(
  value: unknown
): boolean {

  return (
    typeof value === "string" &&
    value.length > 20
  );

}



export function buildDocumentEvidences(
  payload: any
): DocumentEvidence[] {


  const evidences: DocumentEvidence[] = [];


  /*
   * Evidencia fotográfica de campo
   */
  if (
    Array.isArray(payload.photoEvidence)
  ) {

    payload.photoEvidence.forEach(
      (photo: any) => {

        if (
          !isValidDataUrl(photo.dataUrl)
        ) {
          return;
        }


        evidences.push({

          id:
            photo.id ||
            `photo-${Date.now()}`,

          type:
            "PHOTO",

          source:
            "Evidencia fotográfica de campo",

          dataUrl:
            photo.dataUrl,

          title:
            photo.caption ||
            "Fotografía de evidencia",

          description:
            photo.factor ||
            photo.criminologicalInterpretation ||
            "",

          analyticalRelation:
            photo.relation ||
            photo.criminologicalInterpretation ||
            "",

          location:
            photo.location ||
            ""

        });

      }
    );

  }



  /*
   * Street View
   */
  if (
    Array.isArray(payload.streetViewAnalysis)
  ) {

    payload.streetViewAnalysis.forEach(
      (street: any) => {

        if (
          !isValidDataUrl(street.dataUrl)
        ) {
          return;
        }


        evidences.push({

          id:
            street.id ||
            `street-${Date.now()}`,

          type:
            "STREET_VIEW",

          source:
            street.fuentePrimaria ||
            "Google Street View",

          dataUrl:
            street.dataUrl,

          title:
            street.title ||
            "Análisis Street View",

          description:
            street.observed ||
            "",

          analyticalRelation:
            street.inferenciaAnalitica ||
            street.impactoHipotesis ||
            street.criminologicalAnalysis ||
            "",

          location:
            street.location ||
            ""

        });

      }
    );

  }



  /*
   * Mapas
   */
  if (
    Array.isArray(payload.maps)
  ) {

    payload.maps.forEach(
      (map: any) => {

        if (
          !isValidDataUrl(map.dataUrl)
        ) {
          return;
        }


        evidences.push({

          id:
            `map-${Date.now()}`,

          type:
            "MAP",

          source:
            "Cartografía analítica",

          dataUrl:
            map.dataUrl,

          title:
            map.title,

          description:
            map.interpretation,

          analyticalRelation:
            map.interpretation

        });

      }
    );

  }



  /*
   * Gráficos
   */
  if (
    Array.isArray(payload.graphs)
  ) {

    payload.graphs.forEach(
      (graph: any) => {

        if (
          !isValidDataUrl(graph.dataUrl)
        ) {
          return;
        }


        evidences.push({

          id:
            `graph-${Date.now()}`,

          type:
            "GRAPH",

          source:
            "Análisis estadístico",

          dataUrl:
            graph.dataUrl,

          title:
            graph.title,

          description:
            graph.explanation,

          analyticalRelation:
            graph.finding ||
            graph.relation

        });

      }
    );

  }



  return evidences;

}