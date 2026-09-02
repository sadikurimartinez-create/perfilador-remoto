/**
 * Document Engine v1.0.2
 * ADR-013
 *
 * Capa de orquestación documental.
 *
 * Responsabilidad:
 * Transformar payloads certificados de inteligencia
 * en paquetes documentales listos para renderización.
 *
 * No modifica:
 *
 * - HIE Engine
 * - ACE Engine
 * - Evidence Governance Engine
 * - Report Quality Governance
 */

import { buildDocumentChapters } from "@/utils/chapterAssembler";
import { buildDocumentEvidences } from "@/utils/evidenceAssembler";
import { buildDocumentVisuals } from "@/utils/visualAssembler";
import { validateDocumentPackage } from "@/utils/documentPackageValidator";
import { InstitutionalChapterID, INSTITUTIONAL_CHAPTERS_SCHEMA } from "../types/Report";


export interface DocumentPackageMetadata {

  title: string;

  institution: string;

  version: string;

  generatedAt: string;

}



export interface DocumentChapter {

  id: string;

  title: string;

  blocks: unknown[];

}



export interface DocumentPackage {

  metadata: DocumentPackageMetadata;

  editorialPayload: unknown;

  briefing: unknown;

  projectName: string;

  projectId: string;

  user?: unknown;

  chapters: DocumentChapter[];

  evidences: unknown[];

  visuals: unknown[];

  certification?: unknown;

  audit?: unknown;

  canonicalChapters?: Record<InstitutionalChapterID, { title: string; contentText: string }>;

}



export interface DocumentEngineInput {

  editorialPayload: any;

  briefing: unknown;

  projectName: string;

  projectId: string;

  user?: unknown;

  structureAudit?: unknown;

  certification?: unknown;

}



/**
 * Document Engine
 *
 * Primera versión:
 * Construcción y validación del paquete documental.
 *
 * Los renderizadores permanecen desacoplados.
 */

export class DocumentEngine {


  buildDocumentPackage(
    input: DocumentEngineInput
  ): DocumentPackage {


    const documentPackage: DocumentPackage = {


      metadata: {

        title:
          "Informe de Inteligencia Criminal",

        institution:
          "SSPE-CEIPOL",

        version:
          "1.0.2",

        generatedAt:
          new Date().toISOString()

      },


      editorialPayload:
        input.editorialPayload,


      briefing:
        input.briefing,


      projectName:
        input.projectName,


      projectId:
        input.projectId,


      user:
        input.user,


      chapters:
        buildDocumentChapters(
          input.editorialPayload
        ) as DocumentChapter[],


      evidences:
        buildDocumentEvidences(
          input.editorialPayload
        ),


      visuals:
        buildDocumentVisuals(
          input.editorialPayload
        ),


      certification:
        input.certification ?? null,

      canonicalChapters: (() => {
        const payload = input.editorialPayload || {};
        const canonical: Record<InstitutionalChapterID, { title: string; contentText: string }> = {} as any;

        const cap01Text = payload.contextoTerritorial || payload[InstitutionalChapterID.CAP_01_RESUMEN] || payload.resumenEjecutivo || "";
        const cap02Text = payload.fichaTecnica || payload[InstitutionalChapterID.CAP_02_FICHA_TECNICA] || "";
        const cap03Text = payload.marcoGeografico || payload[InstitutionalChapterID.CAP_03_MARCO_GEOGRAFICO] || "";
        const cap04Text = (payload.maps || []).map((m: any) => m.interpretation).join("\n") || payload[InstitutionalChapterID.CAP_04_GEOINT] || "";
        const cap05Text = payload.osintSynthesized || payload[InstitutionalChapterID.CAP_05_OSINT] || "";
        const cap06Text = (payload.intelligenceContext as any)?.narrative || payload.finalHypothesis || payload[InstitutionalChapterID.CAP_06_IAC_NARRATIVA] || "";
        const cap07Text = (payload.photoEvidence || []).map((p: any) => `${p.caption}\n${p.criminologicalInterpretation}\n${p.relation}`).join("\n") || payload[InstitutionalChapterID.CAP_07_EVIDENCIA_VISUAL] || "";
        const cap08Text = payload.recomendaciones || payload[InstitutionalChapterID.CAP_08_RECOMENDACIONES] || "";
        const cap09Text = payload.anexos || payload[InstitutionalChapterID.CAP_09_ANEXOS_TECNICOS] || "";
        
        const conc = payload.conclusiones;
        const cap10Text = conc
          ? [
              ...(conc.hallazgosCriticos || []),
              ...(conc.riesgosInmediatos || []),
              ...(conc.escenariosFuturos || []),
              ...(conc.recomendacionesTacticas || []),
              ...(conc.recomendacionesEstrategicas || [])
            ].join("\n")
          : payload.conclusionesText || payload[InstitutionalChapterID.CAP_10_CERTIFICACION] || "";

        canonical[InstitutionalChapterID.CAP_01_RESUMEN] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_01_RESUMEN].title,
          contentText: cap01Text
        };
        canonical[InstitutionalChapterID.CAP_02_FICHA_TECNICA] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_02_FICHA_TECNICA].title,
          contentText: cap02Text
        };
        canonical[InstitutionalChapterID.CAP_03_MARCO_GEOGRAFICO] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_03_MARCO_GEOGRAFICO].title,
          contentText: cap03Text
        };
        canonical[InstitutionalChapterID.CAP_04_GEOINT] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_04_GEOINT].title,
          contentText: cap04Text
        };
        canonical[InstitutionalChapterID.CAP_05_OSINT] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_05_OSINT].title,
          contentText: cap05Text
        };
        canonical[InstitutionalChapterID.CAP_06_IAC_NARRATIVA] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_06_IAC_NARRATIVA].title,
          contentText: cap06Text
        };
        canonical[InstitutionalChapterID.CAP_07_EVIDENCIA_VISUAL] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_07_EVIDENCIA_VISUAL].title,
          contentText: cap07Text
        };
        canonical[InstitutionalChapterID.CAP_08_RECOMENDACIONES] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_08_RECOMENDACIONES].title,
          contentText: cap08Text
        };
        canonical[InstitutionalChapterID.CAP_09_ANEXOS_TECNICOS] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_09_ANEXOS_TECNICOS].title,
          contentText: cap09Text
        };
        canonical[InstitutionalChapterID.CAP_10_CERTIFICACION] = {
          title: INSTITUTIONAL_CHAPTERS_SCHEMA[InstitutionalChapterID.CAP_10_CERTIFICACION].title,
          contentText: cap10Text
        };

        return canonical;
      })()


    };



    const audit =
      validateDocumentPackage(
        documentPackage
      );



    documentPackage.audit =
      audit;



    console.log(
      "[DOCUMENT PACKAGE AUDIT]",
      audit
    );



    return documentPackage;

  }

}
