import { jsPDF } from "jspdf";
import { exportToWord } from "@/lib/exportToWord";
import { buildIntelligenceBriefing, loadPublicImageAsDataUrl, IntelligenceBriefing } from "@/utils/intelligenceLayoutEngine";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

type FinalizeOptions = {
  project: any;
  content: string;
  album?: any[];
  riskLevel?: "bajo" | "medio" | "alto";
  mapSnapshots?: { title: string; dataUrl: string }[];
  scinceDemographics?: any;
  reportNumber?: string;
  reportSummary?: string;
  user?: { id: string; username: string; role: string };
  markAsPrinted?: () => Promise<void> | void;
  sweeps?: any[];
  powerups?: any[];
};

async function generatePdfProgrammatic(briefing: IntelligenceBriefing) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoSsp = await loadPublicImageAsDataUrl('/logos/logo-ssp.png');
  const logoCeipol = await loadPublicImageAsDataUrl('/logos/logo-ceipol.png');

  const PAGE = {
    width: 297,
    height: 210,
    margin: 16,
  };

  const COLORS = {
    navy: '#0b1f3a',
    blue: '#1d4f91',
    line: '#d7dee8',
    text: '#172033',
    muted: '#5d6b7c',
  };

  const addHeader = (title: string) => {
    doc.setFillColor(COLORS.navy);
    doc.rect(0, 0, PAGE.width, 13, 'F');
    doc.setTextColor('#ffffff');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('SSPE-CEIPOL | Intelligence Briefing', PAGE.margin, 8.5);
    doc.text(title, PAGE.width - PAGE.margin, 8.5, { align: 'right' });
    doc.setTextColor(COLORS.text);
  };

  const addSectionTitle = (title: string, y: number) => {
    doc.setFillColor(COLORS.blue);
    doc.rect(PAGE.margin, y - 5, 3, 8, 'F');
    doc.setFontSize(13);
    doc.setTextColor(COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.text(title, PAGE.margin + 6, y);
    doc.setTextColor(COLORS.text);
  };

  const addBullets = (
    bullets: string[],
    x: number,
    y: number,
    width: number,
    lineHeight = 5.2
  ) => {
    doc.setFontSize(8.8);
    doc.setFont('helvetica', 'normal');
    let cursor = y;
    bullets.forEach((bullet) => {
      const lines = doc.splitTextToSize(`- ${bullet}`, width);
      lines.forEach((line: string) => {
        doc.text(line, x, cursor);
        cursor += lineHeight;
      });
    });
    return cursor;
  };

  const addVisualFrame = (
    visual: any,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    doc.setDrawColor(COLORS.line);
    doc.setLineWidth(0.4);
    doc.rect(x, y, width, height);
    
    try {
      doc.addImage(
        visual.dataUrl, 
        visual.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG', 
        x + 1, 
        y + 1, 
        width - 2, 
        height - 16
      );
    } catch (e) {
      console.warn("No se pudo renderizar la imagen en PDF:", visual.title, e);
    }

    doc.setFillColor('#f4f7fb');
    doc.rect(x, y + height - 15, width, 15, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.text);
    doc.setFont('helvetica', 'normal');
    const caption = doc.splitTextToSize(visual.caption, width - 6).slice(0, 2);
    doc.text(caption, x + 3, y + height - 10);
  };

  briefing.pages.forEach((page, idx) => {
    if (idx > 0) doc.addPage();

    if (page.mode === 'cover') {
      doc.setFillColor('#f7f9fc');
      doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
      doc.setFillColor(COLORS.navy);
      doc.rect(0, 0, PAGE.width, 32, 'F');

      if (logoSsp) {
        try { doc.addImage(logoSsp, 'PNG', PAGE.margin, 7, 22, 18); } catch(e){}
      }
      if (logoCeipol) {
        try { doc.addImage(logoCeipol, 'PNG', PAGE.width - PAGE.margin - 22, 7, 22, 18); } catch(e){}
      }

      doc.setTextColor('#ffffff');
      doc.setFontSize(23);
      doc.setFont('helvetica', 'bold');
      doc.text(briefing.title, PAGE.width / 2, 18, { align: 'center' });
      doc.setFontSize(9);
      doc.text('INFORME DE GEOINTELIGENCIA OPERATIVA', PAGE.width / 2, 27, { align: 'center' });

      doc.setTextColor(COLORS.text);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Expediente: ${briefing.fileNumber}`, PAGE.margin, 47);
      doc.text(`Fecha de generacion: ${new Date(briefing.generatedAt).toLocaleString()}`, PAGE.margin, 54);
      doc.text(`Clasificacion: ${briefing.classification}`, PAGE.margin, 61);

      addSectionTitle('Resumen Ejecutivo', 78);
      
      doc.setFillColor('#ffffff');
      doc.roundedRect(PAGE.margin, 85, 128, 72, 2, 2, 'F');
      doc.setDrawColor(COLORS.line);
      doc.roundedRect(PAGE.margin, 85, 128, 72, 2, 2);
      
      doc.setFontSize(21);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(page.riskLevel === 'ALTO' ? '#b91c1c' : COLORS.blue);
      doc.text(`RIESGO ${page.riskLevel}`, PAGE.margin + 8, 102);
      
      doc.setTextColor(COLORS.text);
      if (page.bullets) {
        addBullets(page.bullets, PAGE.margin + 8, 114, 112);
      }

      doc.setFillColor('#ffffff');
      doc.roundedRect(158, 85, 123, 72, 2, 2, 'F');
      doc.setDrawColor(COLORS.line);
      doc.roundedRect(158, 85, 123, 72, 2, 2);
      
      doc.setFontSize(10);
      doc.setTextColor(COLORS.navy);
      doc.setFont('helvetica', 'bold');
      doc.text('Síntesis del Dictamen', 166, 99);
      
      doc.setTextColor(COLORS.text);
      doc.setFontSize(8.8);
      doc.setFont('helvetica', 'normal');
      if (page.summary) {
        const summaryLines = doc.splitTextToSize(page.summary, 108);
        doc.text(summaryLines.slice(0, 9), 166, 110);
      }

    } else if (page.mode === 'hypothesis') {
      addHeader('Hipótesis Final');
      addSectionTitle('Hipótesis Final Única', 29);
      if (page.hypothesis) {
        addBullets(page.hypothesis, PAGE.margin, 43, 260, 7);
      }

    } else if (page.mode === 'single') {
      addHeader(page.title);
      addSectionTitle(page.title, 29);
      if (page.visuals?.[0]) {
        addVisualFrame(page.visuals[0], 32, 40, 232, 126);
        doc.setTextColor(COLORS.muted);
        doc.setFontSize(9);
        if (page.interpretation) {
          doc.text(doc.splitTextToSize(page.interpretation, 232), 32, 178);
        }
      }

    } else if (page.mode === 'double') {
      addHeader(page.title);
      addSectionTitle(page.title, 29);
      if (page.visuals?.[0]) {
        addVisualFrame(page.visuals[0], PAGE.margin, 42, 128, 112);
      }
      if (page.visuals?.[1]) {
        addVisualFrame(page.visuals[1], 153, 42, 128, 112);
      }
      doc.setTextColor(COLORS.muted);
      doc.setFontSize(8.8);
      if (page.visuals?.[0]) {
        doc.text(doc.splitTextToSize(page.visuals[0].caption, 120).slice(0, 2), PAGE.margin, 166);
      }
      if (page.visuals?.[1]) {
        doc.text(doc.splitTextToSize(page.visuals[1].caption, 120).slice(0, 2), 153, 166);
      }
      if (page.interpretation) {
        doc.setTextColor(COLORS.text);
        doc.setFontSize(9);
        doc.text(doc.splitTextToSize(page.interpretation, 260), PAGE.margin, 185);
      }

    } else if (page.mode === 'sweeps') {
      addHeader('Anexos de Inteligencia');
      addSectionTitle('Barridos Realizados', 29);
      let currentY = 38;
      page.sweeps?.forEach((sweep: any) => {
        doc.setFillColor('#f4f7fb');
        doc.roundedRect(PAGE.margin, currentY, PAGE.width - PAGE.margin * 2, 65, 1, 1, 'F');
        doc.setDrawColor(COLORS.line);
        doc.roundedRect(PAGE.margin, currentY, PAGE.width - PAGE.margin * 2, 65, 1, 1);
        
        doc.setFontSize(9.5);
        doc.setTextColor(COLORS.navy);
        doc.setFont('helvetica', 'bold');
        doc.text(sweep.engine.toUpperCase(), PAGE.margin + 6, currentY + 8);
        
        doc.setFontSize(7.5);
        doc.setTextColor(COLORS.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fuente: ${sweep.source} | Relevancia: ${sweep.relevance}`, PAGE.width - PAGE.margin - 6, currentY + 8, { align: 'right' });
        
        doc.setDrawColor(COLORS.line);
        doc.line(PAGE.margin + 6, currentY + 12, PAGE.width - PAGE.margin - 6, currentY + 12);
        
        doc.setTextColor(COLORS.text);
        doc.setFontSize(8);
        const dataLines = doc.splitTextToSize(sweep.data, PAGE.width - PAGE.margin * 2 - 12);
        doc.text(dataLines.slice(0, 6), PAGE.margin + 6, currentY + 18);
        
        if (sweep.context) {
          doc.setTextColor(COLORS.blue);
          doc.setFont('helvetica', 'bold');
          doc.text(`Contexto de integración: ${sweep.context}`, PAGE.margin + 6, currentY + 58);
        }
        
        currentY += 72;
      });

    } else if (page.mode === 'conclusions') {
      addHeader('Conclusiones Operativas');
      addSectionTitle('Conclusiones Operativas', 29);
      if (page.conclusions) {
        addBullets(page.conclusions, PAGE.margin, 45, 250, 8);
      }
    }

    // Pie de página fijo de una sola línea
    doc.setDrawColor(COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, PAGE.height - 10, PAGE.width - PAGE.margin, PAGE.height - 10);
    
    doc.setFontSize(7);
    doc.setTextColor(COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el ${new Date(briefing.generatedAt).toLocaleDateString()} | SSPE-CEIPOL Inteligencia Táctica`, PAGE.margin, PAGE.height - 6);
    doc.text(`Página ${idx + 1} de ${briefing.pages.length}`, PAGE.width - PAGE.margin, PAGE.height - 6, { align: 'right' });
  });

  doc.save(`Dictamen_Oficial_${briefing.fileNumber}.pdf`);
}

export type ReportState =
  | "IDLE"
  | "INPUT_COLLECTED"
  | "PAYLOAD_LOCKED"
  | "POWERUPS_DEDUPED"
  | "LAYOUT_COMPUTED"
  | "VALIDATED"
  | "EXPORTING"
  | "COMPLETE";

export type ReportEvent =
  | "INIT"
  | "COLLECT_DATA"
  | "LOCK_PAYLOAD"
  | "APPLY_POWERUPS"
  | "BUILD_LAYOUT"
  | "VALIDATE"
  | "EXPORT_PDF"
  | "EXPORT_WORD";

export type PowerUp = {
  id: string;
  type: "OCR" | "ST_DWITHIN" | "GROUNDING" | "SEMANTIC";
  metadata: Record<string, any>;
  appliedAt: number;
};

function deepFreeze(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = obj[prop];
    if (value !== null && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}

export class ReportEngineStateMachine {
  private state: ReportState = "IDLE";
  private context: any = {};

  getState(): ReportState {
    return this.state;
  }

  transition(event: ReportEvent, payload?: any) {
    switch (this.state) {
      case "IDLE":
        if (event === "INIT") {
          this.state = "IDLE";
          this.context = {};
          return;
        }
        if (event === "COLLECT_DATA") {
          this.context.project = payload.project;
          this.context.content = payload.content;
          this.context.album = payload.album || [];
          this.context.mapSnapshots = payload.mapSnapshots || [];
          this.context.riskLevel = payload.riskLevel;
          this.context.reportSummary = payload.reportSummary;
          this.context.user = payload.user;
          this.context.markAsPrinted = payload.markAsPrinted;
          this.context.sweeps = payload.sweeps || [];
          this.context.powerups = payload.powerups || [];
          this.state = "INPUT_COLLECTED";
          return;
        }
        break;

      case "INPUT_COLLECTED":
        if (event === "INIT") {
          this.state = "IDLE";
          this.context = {};
          return;
        }
        if (event === "LOCK_PAYLOAD") {
          const content = this.context.content || "";
          
          // Limits check (max sections = 8, max chars = 14400)
          const sectionsCount = (content.match(/^#+\s+/gm) || []).length;
          if (sectionsCount > 8 || content.length > 14400) {
            throw new Error("STATE_MACHINE_OVERFLOW_BLOCKED");
          }

          // Sub-section character limit check (max 1800 per section)
          const lines = content.split("\n");
          let currentSectionTitle = "General";
          const sectionsMap = new Map<string, string[]>();
          sectionsMap.set(currentSectionTitle, []);
          for (const line of lines) {
            if (line.trim().startsWith("#")) {
              currentSectionTitle = line.trim();
              if (!sectionsMap.has(currentSectionTitle)) {
                sectionsMap.set(currentSectionTitle, []);
              }
            }
            sectionsMap.get(currentSectionTitle)!.push(line);
          }
          const activeSections = Array.from(sectionsMap.entries()).filter(([_, contentLines]) => {
            return contentLines.join("").trim().length > 0;
          });
          for (const [title, contentLines] of activeSections) {
            const sectionLength = contentLines.join("\n").length;
            if (sectionLength > 1800) {
              throw new Error("STATE_MACHINE_OVERFLOW_BLOCKED");
            }
          }

          // Normalize/sanitize duplicate lines
          const cleanLines: string[] = [];
          const seen = new Set<string>();
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && (trimmed.startsWith("#") || trimmed.length > 20)) {
              if (seen.has(trimmed)) {
                continue;
              }
              seen.add(trimmed);
            }
            cleanLines.push(line);
          }
          let cleanContent = cleanLines.join("\n");

          // Purgar texto técnico de PowerUps
          const technicalTexts = [
            "Ejecuta OCR Avanzado y Extracción de Atributos Visuales.",
            "Aplica Análisis de Diarización y Sentimiento.",
            "Consulta de Proximidad ST_DWithin y Grounding Dinámico.",
            "Activa Extracción de Entidades Salientes.",
            "Despliega Búsqueda Semántica en Discovery Engine.",
            "Ejecuta OCR Avanzado y Extracción de Atributos Visuales",
            "Aplica Análisis de Diarización y Sentimiento",
            "Consulta de Proximidad ST_DWithin y Grounding Dinámico",
            "Activa Extracción de Entidades Salientes",
            "Despliega Búsqueda Semántica en Discovery Engine"
          ];
          for (const tech of technicalTexts) {
            cleanContent = cleanContent.split(tech).join("");
          }

          // Clean up "Resultados Puente Contextual" or "POWERUP APLICADO"
          const finalLines = cleanContent.split("\n").filter(line => {
            const lower = line.toLowerCase();
            if (lower.includes("resultados puente contextual")) return false;
            if (lower.includes("powerup aplicado")) return false;
            if (lower.includes("puente contextual combinado")) return false;
            return true;
          });
          cleanContent = finalLines.join("\n");

          this.context.content = cleanContent;
          
          // Deep freeze to avoid UI mutations
          deepFreeze(this.context);
          
          this.state = "PAYLOAD_LOCKED";
          return;
        }
        break;

      case "PAYLOAD_LOCKED":
        if (event === "INIT") {
          this.state = "IDLE";
          this.context = {};
          return;
        }
        if (event === "APPLY_POWERUPS") {
          const rawPowerups = this.context.powerups || [];
          const deduplicated = rawPowerups.filter((item: any, index: number, self: any[]) =>
            self.findIndex((t: any) => (t.powerUpId || t.id) === (item.powerUpId || item.id)) === index
          );
          
          // Map to structured PowerUp object
          this.context.powerups = deduplicated.map((p: any) => {
            let pType: "OCR" | "ST_DWITHIN" | "GROUNDING" | "SEMANTIC" = "SEMANTIC";
            const pid = p.powerUpId || p.id || "";
            if (pid.toLowerCase().includes("imagen") || pid.toLowerCase().includes("ocr")) pType = "OCR";
            else if (pid.toLowerCase().includes("ubicacion") || pid.toLowerCase().includes("dwithin")) pType = "ST_DWITHIN";
            else if (pid.toLowerCase().includes("entidades") || pid.toLowerCase().includes("grounding")) pType = "GROUNDING";
            
            return {
              id: pid,
              type: pType,
              metadata: p.metadata || p,
              appliedAt: p.appliedAt || Date.now()
            };
          });

          this.state = "POWERUPS_DEDUPED";
          return;
        }
        break;

      case "POWERUPS_DEDUPED":
        if (event === "INIT") {
          this.state = "IDLE";
          this.context = {};
          return;
        }
        if (event === "BUILD_LAYOUT") {
          const visuals: any[] = [];
          if (this.context.mapSnapshots) {
            this.context.mapSnapshots.forEach((snap: any, idx: number) => {
              const isChart = snap.title.toLowerCase().includes("gráfica") || snap.title.toLowerCase().includes("grafica");
              visuals.push({
                id: `map-${idx}`,
                type: isChart ? 'chart' : 'map',
                title: snap.title,
                dataUrl: snap.dataUrl,
                caption: isChart 
                  ? 'Modelado analítico y frecuencia delictiva registrada.'
                  : 'Simbología geoespacial operativa sobre el polígono delimitado.'
              });
            });
          }

          if (this.context.album) {
            this.context.album.forEach((photo: any, idx: number) => {
              visuals.push({
                id: photo.id,
                type: 'photo',
                title: photo.tipo || `Evidencia fotográfica ${idx + 1}`,
                dataUrl: photo.previewUrl,
                caption: photo.comentario || 'Evidencia de inspección de campo.',
                riskLevel: photo.riskLevel || 'medio'
              });
            });
          }

          const briefing = buildIntelligenceBriefing(
            {
              projectId: this.context.project.id,
              projectName: this.context.project.nombre || this.context.project.name || 'Expediente',
              createdAt: new Date().toISOString(),
              geometryType: this.context.project.geometryType || 'polygon',
              objectives: [],
              textNotes: [],
              voiceNotes: [],
              findings: this.context.project.findings || [],
              conclusions: [],
              recommendations: []
            } as any,
            visuals,
            {
              sweeps: this.context.sweeps || [],
              reportSummary: this.context.reportSummary
            }
          );

          this.context.briefing = briefing;
          this.state = "LAYOUT_COMPUTED";
          return;
        }
        break;

      case "LAYOUT_COMPUTED":
        if (event === "INIT") {
          this.state = "IDLE";
          this.context = {};
          return;
        }
        if (event === "VALIDATE") {
          // Assertions validation gate
          const previewLayer = typeof document !== 'undefined' && document.getElementById("official-pdf-content");
          if (previewLayer) {
            throw new Error("ASSERT_FAILED: Preview layer exists");
          }

          const allStructured = this.context.powerups.every((p: any) =>
            p.id && ["OCR", "ST_DWITHIN", "GROUNDING", "SEMANTIC"].includes(p.type)
          );
          if (!allStructured) {
            throw new Error("ASSERT_FAILED: PowerUps are not properly structured");
          }

          if (this.context.briefing.pages.length > 12) {
            throw new Error("STATE_MACHINE_OVERFLOW_BLOCKED");
          }

          const wordButton = typeof document !== 'undefined' && document.getElementById("export-word-btn-ui");
          if (wordButton) {
            throw new Error("ASSERT_FAILED: UI export layer exists");
          }

          this.state = "VALIDATED";
          return;
        }
        break;

      case "VALIDATED":
        if (event === "INIT") {
          this.state = "IDLE";
          this.context = {};
          return;
        }
        if (event === "EXPORT_PDF" || event === "EXPORT_WORD") {
          this.state = "EXPORTING";
          return;
        }
        break;

      case "EXPORTING":
        if (event === "INIT") {
          this.state = "IDLE";
          this.context = {};
          return;
        }
        this.state = "COMPLETE";
        return;
        break;

      case "COMPLETE":
        if (event === "INIT") {
          this.state = "IDLE";
          this.context = {};
          return;
        }
        break;
    }

    throw new Error(`INVALID_TRANSITION: Cannot transition from ${this.state} using event ${event}`);
  }

  async finalizeExport(format: "PDF" | "WORD") {
    if (this.state !== "VALIDATED") {
      throw new Error(`ASSERT_FAILED: Cannot export in state ${this.state}. Must be VALIDATED.`);
    }

    this.transition(format === "PDF" ? "EXPORT_PDF" : "EXPORT_WORD");

    try {
      if (format === "PDF") {
        await generatePdfProgrammatic(this.context.briefing);

        if (this.context.user && this.context.project.id) {
          const db = getDb();
          await addDoc(collection(db, "analyses"), {
            projectId: this.context.project.id,
            content: this.context.content,
            createdAt: Date.now(),
            reportEngineOutput: true,
            source: "ReportEngine.finalize",
            title: "Dictamen Criminológico Ambiental Generado",
            summary: this.context.reportSummary || "Dictamen oficial generado.",
            createdBy: this.context.user.username,
            createdById: this.context.user.id,
            createdByRole: this.context.user.role,
            attachedPhotos: this.context.album ? this.context.album.map((p: any) => p.previewUrl).filter(Boolean) : [],
            powerups: this.context.powerups,
          });

          const projectRef = doc(db, "projects", this.context.project.id);
          await updateDoc(projectRef, {
            photoCount: this.context.album?.length || 0,
          });
        }
      } else {
        await exportToWord(
          this.context.content,
          this.context.project.nombre || this.context.project.name || 'Expediente',
          this.context.album ? this.context.album.map((p: any) => ({ url: p.previewUrl, tipo: p.tipo, comentario: p.comentario })) : [],
          this.context.riskLevel,
          this.context.mapSnapshots,
          this.context.scinceDemographics,
          this.context.project.id,
          this.context.reportSummary
        );
      }

      this.transition("EXPORT_PDF"); // Transitions EXPORTING -> COMPLETE
    } catch (err) {
      this.state = "IDLE";
      throw err;
    }
  }

  getContext() {
    return this.context;
  }
}

export const ReportEngine = {
  collect(
    project: any, 
    content: string, 
    album: any[], 
    mapSnapshots: any[], 
    riskLevel: string | null, 
    reportSummary: string
  ) {
    return {
      project,
      content,
      album,
      mapSnapshots,
      riskLevel,
      reportSummary
    };
  },

  normalize(
    content: string,
    options: {
      removeDuplicates?: boolean;
      removeRawPowerUps?: boolean;
      enforceSectionLimits?: boolean;
    }
  ): string {
    const machine = new ReportEngineStateMachine();
    machine.transition("COLLECT_DATA", { content });
    machine.transition("LOCK_PAYLOAD");
    return machine.getContext().content;
  },

  async finalize(options: FinalizeOptions) {
    const machine = new ReportEngineStateMachine();
    machine.transition("COLLECT_DATA", options);
    machine.transition("LOCK_PAYLOAD");
    machine.transition("APPLY_POWERUPS");
    machine.transition("BUILD_LAYOUT");
    machine.transition("VALIDATE");
    
    await machine.finalizeExport("WORD");
    await machine.finalizeExport("PDF");

    if (options.markAsPrinted) {
      options.markAsPrinted();
    }

    return {
      output: true,
      source: "ReportEngine.finalize"
    };
  }
};
