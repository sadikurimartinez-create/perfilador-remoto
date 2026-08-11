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
        input.certification ?? null


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
