/**
 * ORGANIZATIONAL LEARNING ENGINE v1.0
 * FASE 11 — Institutional Intelligence Management Engine
 *
 * Motor de aprendizaje institucional acumulativo.
 *
 * Integra:
 * - Lecciones aprendidas.
 * - Buenas prácticas.
 * - Evolución metodológica.
 *
 * Gobernanza:
 * - No evalúa personas.
 * - No sustituye decisiones humanas.
 * - No genera sanciones ni recomendaciones obligatorias.
 */


export interface LearningCycle {

  id: string;

  sourceLessons: number;

  sourcePractices: number;

  improvementArea: string;

  maturityBefore:
    | "INITIAL"
    | "DEVELOPING"
    | "MATURE";


  maturityAfter:
    | "INITIAL"
    | "DEVELOPING"
    | "MATURE";


  evidenceReference: string;

  createdAt: string;

}



export interface OrganizationalLearningResult {

  cyclesAnalyzed: number;

  improvementsDetected: number;

  maturityEvolution: string;

  cycles: LearningCycle[];

  governanceMessage: string;

}



export class OrganizationalLearningEngine {


  public analyze(
    cycles: LearningCycle[]
  ): OrganizationalLearningResult {


    const improvements =
      cycles.filter(
        cycle =>
          cycle.maturityBefore !==
          cycle.maturityAfter
      ).length;



    return {

      cyclesAnalyzed:
        cycles.length,


      improvementsDetected:
        improvements,


      maturityEvolution:
        this.calculateEvolution(cycles),


      cycles,


      governanceMessage:
        "El aprendizaje organizacional representa evolución metodológica institucional basada en evidencia histórica y requiere validación humana."

    };

  }



  private calculateEvolution(
    cycles: LearningCycle[]
  ): string {


    if (cycles.length === 0) {

      return "SIN_DATOS";

    }


    const improvements =
      cycles.filter(
        cycle =>
          cycle.maturityAfter !==
          cycle.maturityBefore
      ).length;



    if (improvements > 0) {

      return "EVOLUCION_POSITIVA";

    }


    return "ESTABILIDAD_METODOLOGICA";

  }


}