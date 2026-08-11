/**
 * Visual Assembler v1.0
 * ADR-013
 *
 * Responsabilidad:
 * Transformar elementos visuales certificados
 * del IntelligenceReportPayload en recursos
 * preparados para composición documental.
 *
 * No modifica:
 * - Evidence Governance Engine
 * - Report Quality Governance
 * - Exportadores documentales
 */


export interface DocumentVisual {

  id: string;

  type:
    | "MAP"
    | "GRAPH"
    | "PHOTO"
    | "STREET_VIEW";

  title: string;

  dataUrl: string;

  interpretation?: string;

  priority?: 
    | "HIGH"
    | "MEDIUM"
    | "LOW";

}



function isValidVisual(
  item: any
): boolean {

  return (
    item &&
    typeof item.dataUrl === "string" &&
    item.dataUrl.length > 20
  );

}



export function buildDocumentVisuals(
  payload: any
): DocumentVisual[] {


  const visuals: DocumentVisual[] = [];


  /*
   * Mapas analíticos
   */
  if (
    Array.isArray(payload.maps)
  ) {

    payload.maps.forEach(
      (map: any, index: number) => {

        if (!isValidVisual(map)) {
          return;
        }


        visuals.push({

          id:
            `map-${index + 1}`,

          type:
            "MAP",

          title:
            map.title ||
            "Mapa analítico",

          dataUrl:
            map.dataUrl,

          interpretation:
            map.interpretation,

          priority:
            "HIGH"

        });

      }
    );

  }



  /*
   * Gráficos estadísticos
   */
  if (
    Array.isArray(payload.graphs)
  ) {

    payload.graphs.forEach(
      (graph: any, index: number) => {

        if (!isValidVisual(graph)) {
          return;
        }


        visuals.push({

          id:
            `graph-${index + 1}`,

          type:
            "GRAPH",

          title:
            graph.title ||
            "Gráfico estadístico",

          dataUrl:
            graph.dataUrl,

          interpretation:
            graph.finding ||
            graph.explanation,

          priority:
            "MEDIUM"

        });

      }
    );

  }



  /*
   * Fotografías destacadas
   */
  if (
    Array.isArray(payload.photoEvidence)
  ) {

    payload.photoEvidence.forEach(
      (photo: any, index: number) => {

        if (!isValidVisual(photo)) {
          return;
        }


        visuals.push({

          id:
            `photo-${index + 1}`,

          type:
            "PHOTO",

          title:
            photo.caption ||
            "Evidencia fotográfica",

          dataUrl:
            photo.dataUrl,

          interpretation:
            photo.criminologicalInterpretation ||
            photo.relation,

          priority:
            "MEDIUM"

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
      (street: any, index: number) => {

        if (!isValidVisual(street)) {
          return;
        }


        visuals.push({

          id:
            `street-view-${index + 1}`,

          type:
            "STREET_VIEW",

          title:
            street.title ||
            "Vista territorial Street View",

          dataUrl:
            street.dataUrl,

          interpretation:
            street.inferenciaAnalitica ||
            street.impactoHipotesis ||
            street.observed,

          priority:
            "HIGH"

        });

      }
    );

  }



  return visuals;

}