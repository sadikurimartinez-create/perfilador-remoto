/**
 * LESSONS LEARNED ENGINE v1.0
 * FASE 11 — Institutional Intelligence Management Engine
 *
 * Motor de extracción de conocimiento
 * derivado de experiencias institucionales.
 *
 * Gobernanza:
 * - Analiza evidencia histórica.
 * - Conserva procedencia.
 * - No genera decisiones operativas.
 */

export interface LessonLearned {

  id: string;

  sourcePhase: string;

  sourceModule: string;

  title: string;

  description: string;

  impact:
    | "LOW"
    | "MEDIUM"
    | "HIGH";

  evidenceReference: string;

  createdAt: string;
}


export interface LessonAnalysisResult {

  totalLessons: number;

  highImpactLessons: number;

  lessons: LessonLearned[];

  governanceMessage: string;
}


export class LessonsLearnedEngine {


  public extract(
    lessons: LessonLearned[]
  ): LessonAnalysisResult {


    const highImpact =
      lessons.filter(
        lesson =>
          lesson.impact === "HIGH"
      ).length;


    return {

      totalLessons:
        lessons.length,


      highImpactLessons:
        highImpact,


      lessons:
        lessons,


      governanceMessage:
        "Las lecciones aprendidas representan conocimiento institucional derivado de evidencia previa y requieren validación humana antes de cualquier aplicación metodológica."
    };

  }


  public classifyImpact(
    frequency: number
  ):
    | "LOW"
    | "MEDIUM"
    | "HIGH" {


    if (frequency >= 10) {

      return "HIGH";

    }


    if (frequency >= 5) {

      return "MEDIUM";

    }


    return "LOW";

  }

}