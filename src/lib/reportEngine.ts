import { jsPDF } from "jspdf";
import { exportToWord } from "@/lib/exportToWord";
import { buildIntelligenceBriefing, loadPublicImageAsDataUrl, IntelligenceBriefing, buildIntelligenceEditorialPayload, IntelligenceReportPayload } from "@/utils/intelligenceLayoutEngine";
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

    } else if (page.mode === 'text') {
      addHeader(page.title);
      addSectionTitle(page.title, 29);
      if (page.interpretation) {
        doc.setTextColor(COLORS.text);
        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'normal');
        const textLines = doc.splitTextToSize(page.interpretation, 260);
        doc.text(textLines, PAGE.margin, 45);
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

export type KernelState =
  | "IDLE"
  | "INITIALIZED"
  | "INPUT_LOCKED"
  | "POWERUPS_DEDUPED"
  | "LAYOUT_DERIVED"
  | "VALIDATED"
  | "EXPORT_EXECUTED"
  | "COMPLETE";

export type KernelEvent =
  | "INIT_KERNEL"
  | "LOCK_INPUT"
  | "APPLY_POWERUPS"
  | "DERIVE_LAYOUT"
  | "VALIDATE_KERNEL"
  | "EXECUTE_EXPORT"
  | "TERMINATE_KERNEL";

export type PowerUp = {
  id: string;
  type: "OCR" | "ST_DWITHIN" | "GROUNDING" | "SEMANTIC";
  metadata: Record<string, any>;
  appliedAt: number;
};

export type ExecutionSnapshot = {
  state: KernelState;
  payloadHash: string;
  powerupsHash: string;
  layoutHash: string;
  timestamp: number;
};

export type ExecutionTrace = {
  executionId: string;
  transitions: string[];
  snapshots: ExecutionSnapshot[];
  exportStatus: string;
  validationResults: any;
};

export type TraceEntry = {
  event: KernelEvent;
  kernelState: KernelState;
  executionId: string;
  timestamp: number;
};

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

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

function isValidTransition(state: KernelState, eventType: string): boolean {
  switch (state) {
    case "IDLE":
      return eventType === "INIT_KERNEL";
    case "INITIALIZED":
      return eventType === "INIT_KERNEL" || eventType === "LOCK_INPUT";
    case "INPUT_LOCKED":
      return eventType === "INIT_KERNEL" || eventType === "APPLY_POWERUPS";
    case "POWERUPS_DEDUPED":
      return eventType === "INIT_KERNEL" || eventType === "DERIVE_LAYOUT";
    case "LAYOUT_DERIVED":
      return eventType === "INIT_KERNEL" || eventType === "VALIDATE_KERNEL";
    case "VALIDATED":
      return eventType === "INIT_KERNEL" || eventType === "EXECUTE_EXPORT";
    case "EXPORT_EXECUTED":
      return eventType === "INIT_KERNEL" || eventType === "TERMINATE_KERNEL";
    case "COMPLETE":
      return eventType === "INIT_KERNEL";
  }
  return false;
}

function gate(eventType: string, state: KernelState) {
  if (!isValidTransition(state, eventType)) {
    throw new Error("INVALID_STATE_TRANSITION_BLOCKED");
  }
}

export type KernelSubscriber = (state: KernelState) => void;

export class ReportEngineKernelClass {
  private executionId: string | null = null;
  private locked: boolean = false;
  private state: KernelState = "IDLE";
  private context: any = {};
  private snapshots: ExecutionSnapshot[] = [];
  private transitionsList: string[] = [];
  private exportStatus: string = "NOT_STARTED";
  private validationResults: any = null;
  private subscribers: KernelSubscriber[] = [];
  private traceLog: TraceEntry[] = [];

  getExecutionId() {
    return this.executionId;
  }

  isActive() {
    return this.locked;
  }

  isLocked() {
    return this.locked;
  }

  getState(): KernelState {
    return this.state;
  }

  getTrace(): ExecutionTrace {
    return deepFreeze({
      executionId: this.executionId || "",
      transitions: [...this.transitionsList],
      snapshots: [...this.snapshots],
      exportStatus: this.exportStatus,
      validationResults: this.validationResults
    });
  }

  getContext() {
    return this.context;
  }

  subscribe(sub: KernelSubscriber) {
    this.subscribers.push(sub);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== sub);
    };
  }

  private notify() {
    this.subscribers.forEach(sub => sub(this.state));
  }

  private takeSnapshot() {
    const payloadStr = this.context.content || "";
    const powerupsStr = JSON.stringify(this.context.powerups || []);
    const layoutStr = JSON.stringify(this.context.briefing || {});

    const snap = {
      state: this.state,
      payloadHash: simpleHash(payloadStr),
      powerupsHash: simpleHash(powerupsStr),
      layoutHash: simpleHash(layoutStr),
      timestamp: Date.now()
    };
    this.snapshots.push(deepFreeze(snap));
  }

  async dispatch(event: KernelEvent, payload?: any): Promise<void> {
    console.log("[REPORT ENGINE KERNEL] ENTER dispatch:", event);
    console.log("[STATE BEFORE]", this.state);
    console.log("[EXECUTION ID]", this.executionId);

    // 🔒 1. SINGLE EXECUTION GUARANTEE
    if (this.locked && event !== "INIT_KERNEL" && payload?.executionId && this.executionId !== payload.executionId) {
      console.error("[REPORT ENGINE KERNEL] MULTI_EXECUTION_BLOCKED. Current Active:", this.executionId, "Requested:", payload.executionId);
      throw new Error("MULTI_EXECUTION_BLOCKED");
    }

    const valid = isValidTransition(this.state, event);
    if (!valid) {
      console.error("[REPORT ENGINE KERNEL] INVALID_STATE_TRANSITION_BLOCKED. Current:", this.state, "Event:", event);
      throw new Error("INVALID_STATE_TRANSITION_BLOCKED");
    }

    this.transitionsList.push(`${this.state} -> ${event}`);

    // UI event tracing log
    this.traceLog.push({
      event,
      kernelState: this.state,
      executionId: this.executionId || "",
      timestamp: Date.now()
    });

    switch (event) {
      case "INIT_KERNEL":
        this.executionId = payload?.executionId || `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.locked = true;
        this.state = "INITIALIZED";
        this.context = {};
        this.snapshots = [];
        this.transitionsList = ["INIT_KERNEL"];
        this.exportStatus = "NOT_STARTED";
        this.validationResults = null;
        this.takeSnapshot();
        this.notify();
        break;

      case "LOCK_INPUT":
        const content = payload.content || "";
        
        // Limits check (max headers = 200, max chars = 250000)
        const sectionsCount = (content.match(/^#+/gm) || []).length;
        if (sectionsCount > 200 || content.length > 250000) {
          throw new Error("STATE_MACHINE_OVERFLOW_BLOCKED");
        }

        // Sub-section character limit check (max 50000 per section)
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
          if (sectionLength > 50000) {
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

        this.context.project = payload.project;
        this.context.content = cleanContent;
        this.context.album = payload.album || [];
        this.context.mapSnapshots = payload.mapSnapshots || [];
        this.context.riskLevel = payload.riskLevel;
        this.context.reportSummary = payload.reportSummary;
        this.context.user = payload.user;
        this.context.markAsPrinted = payload.markAsPrinted;
        this.context.sweeps = payload.sweeps || [];
        this.context.powerups = payload.powerups || [];
        this.context.scinceDemographics = payload.scinceDemographics;
        this.context.reportNumber = payload.reportNumber;

        deepFreeze(this.context);

        this.state = "INPUT_LOCKED";
        this.takeSnapshot();
        this.notify();
        break;

      case "APPLY_POWERUPS":
        const rawPowerups = this.context.powerups || [];
        rawPowerups.forEach((pu: any) => {
          if (typeof pu === "string") {
            throw new Error("POWERUP_TYPE_VIOLATION");
          }
        });

        const deduplicated = rawPowerups.filter((item: any, index: number, self: any[]) =>
          self.findIndex((t: any) => (t.powerUpId || t.id) === (item.powerUpId || item.id)) === index
        );

        const structuredPowerups = deduplicated.map((p: any) => {
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

        this.context = deepFreeze({
          ...this.context,
          powerups: structuredPowerups
        });

        this.state = "POWERUPS_DEDUPED";
        this.takeSnapshot();
        this.notify();
        break;

      case "DERIVE_LAYOUT": {
        gate("DERIVE_LAYOUT", this.state);
        if (this.executionId !== payload?.executionId) {
          throw new Error("DERIVE_LAYOUT_EXECUTION_ID_MISMATCH");
        }

        // FASE OBLIGATORIA PREVIA AL RENDER: Intelligence Editorial Layer
        const editorialPayload = buildIntelligenceEditorialPayload(
          this.context.content || "",
          this.context.album || [],
          this.context.mapSnapshots || [],
          this.context.sweeps || [],
          this.context.project
        );

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
          editorialPayload
        );

        this.context = deepFreeze({
          ...this.context,
          briefing,
          editorialPayload: editorialPayload
        });

        this.state = "LAYOUT_DERIVED";
        this.takeSnapshot();
        this.notify();
        break;
      }
      case "VALIDATE_KERNEL":
        const previewLayer = typeof document !== 'undefined' && document.getElementById("official-pdf-content");
        if (previewLayer) {
          throw new Error("ASSERT_FAILED: Preview layer exists");
        }

        const payloadObj = this.context.editorialPayload;
        if (!payloadObj) {
          throw new Error("VALIDATION_FAILED_CRITERIA: Missing editorial payload");
        }

        // Rule 15 strict validations
        const hasExecutiveSummary = !!payloadObj.executiveSummary && payloadObj.executiveSummary.trim().length > 10;
        const hasFinalHypothesis = !!payloadObj.finalHypothesis && payloadObj.finalHypothesis.trim().length > 10;
        const hasMaps = !!payloadObj.maps && payloadObj.maps.length > 0;
        const hasGraphs = !!payloadObj.graphs && payloadObj.graphs.length > 0;
        const hasEvidence = !!payloadObj.photoEvidence && payloadObj.photoEvidence.length > 0;
        const hasHIGGraph = !!payloadObj.hypothesisGraph && !!payloadObj.hypothesisGraph.dataUrl;
        
        const textToAudit = JSON.stringify(payloadObj);
        const forbiddenPatterns = [
          /\bst_dwithin\b/i,
          /\bdiscovery\s+engine\b/i,
          /\bgrounding\b/i,
          /\bpowerup[s]?\b/i,
          /\binstruction[s]?\b/i,
          /\bocr\b/i,
          /\bdiarización\b/i,
          /\bsentiment\b/i
        ];
        const hasForbidden = forbiddenPatterns.some(pattern => pattern.test(textToAudit));
        const noInternalMetadata = !hasForbidden;

        const pageCount = this.context.briefing?.pages?.length || 0;
        const isPageCountValid = pageCount <= 12;

        if (!hasExecutiveSummary || !hasFinalHypothesis || !hasMaps || !hasGraphs || !hasEvidence || !hasHIGGraph || !noInternalMetadata || !isPageCountValid) {
          const errMsg = `VALIDATION_FAILED_CRITERIA: hasExecutiveSummary=${hasExecutiveSummary}, hasFinalHypothesis=${hasFinalHypothesis}, hasMaps=${hasMaps}, hasGraphs=${hasGraphs}, hasEvidence=${hasEvidence}, hasHIGGraph=${hasHIGGraph}, noInternalMetadata=${noInternalMetadata}, pageCount=${pageCount}`;
          console.error("[REPORT ENGINE KERNEL] VALIDATION ERROR:", errMsg);
          throw new Error(errMsg);
        }

        this.validationResults = {
          noPreviewLayer: true,
          powerupsAreStructured: true,
          totalPages: pageCount,
          noUIExportLayer: true,
        };
        this.state = "VALIDATED";
        this.takeSnapshot();
        this.notify();
        break;

      case "EXECUTE_EXPORT":
        const activeId = payload?.activeId;
        const format = payload?.format || "ALL";

        console.log("[REPORT ENGINE KERNEL] EXPORT TRIGGERED. Format:", format, "activeId:", activeId);

        // 🔒 Triple Lock checks inside dispatch for EXECUTE_EXPORT
        if (this.state !== "VALIDATED") {
          console.error("[REPORT ENGINE KERNEL] EXPORT_BLOCKED_INVALID_STATE. Current State:", this.state);
          throw new Error("EXPORT_BLOCKED_INVALID_STATE");
        }
        if (!this.locked) {
          console.error("[REPORT ENGINE KERNEL] EXPORT_BLOCKED_KERNEL_UNLOCKED");
          throw new Error("EXPORT_BLOCKED_KERNEL_UNLOCKED");
        }
        if (this.executionId !== activeId) {
          console.error("[REPORT ENGINE KERNEL] EXPORT_BLOCKED_EXECUTION_ID_MISMATCH. Active:", this.executionId, "Requested:", activeId);
          throw new Error("EXPORT_BLOCKED_EXECUTION_ID_MISMATCH");
        }

        this.state = "EXPORT_EXECUTED";
        this.exportStatus = `EXPORTING_${format}`;
        this.takeSnapshot();
        this.notify();

        try {
          if (format === "WORD" || format === "ALL") {
            await exportToWord(
              this.context.editorialPayload,
              this.context.project.nombre || this.context.project.name || 'Expediente',
              this.context.project.id || 'EXPEDIENTE_TACTICO',
              this.context.user
            );
          }
          if (format === "PDF" || format === "ALL") {
            await generatePdfProgrammatic(this.context.briefing);

            if (this.context.user && this.context.project.id) {
              const db = getDb();
              await addDoc(collection(db, "analyses"), {
                projectId: this.context.project.id,
                version: "v7.0",
                fecha: Date.now(),
                executiveSummary: this.context.editorialPayload.executiveSummary,
                evidenceUrls: this.context.album ? this.context.album.map((p: any) => p.previewUrl || p.url).filter(Boolean) : [],
                author: this.context.user.username,
                source: "ReportEngine.finalize"
              });

              const projectRef = doc(db, "projects", this.context.project.id);
              await updateDoc(projectRef, {
                photoCount: this.context.album?.length || 0,
              });
            }
          }

          this.exportStatus = `COMPLETE_${format}`;
          
          // Auto-terminate kernel and set state to COMPLETE
          this.locked = false;
          this.state = "COMPLETE";
          this.takeSnapshot();
          this.notify();
        } catch (err) {
          console.error("[REPORT ENGINE KERNEL] EXPORT PIPELINE FAILURE:", err);
          this.exportStatus = "FAILED";
          this.locked = false;
          this.state = "IDLE";
          this.takeSnapshot();
          this.notify();
          throw err;
        }
        break;

      case "TERMINATE_KERNEL":
        this.locked = false;
        this.state = "COMPLETE";
        this.takeSnapshot();
        this.notify();
        break;
    }
  }

  async finalizeExport(format: "PDF" | "WORD", activeId: string) {
    await this.dispatch("EXECUTE_EXPORT", { format, activeId });
  }
}

export const ReportEngineKernel = new ReportEngineKernelClass();

// 🧱 5. KERNEL BOUNDARY ENFORCEMENT
export function KernelGuard(action: { type: KernelEvent; payload?: any }) {
  if (action.type !== "INIT_KERNEL" && !ReportEngineKernel.isActive()) {
    throw new Error("KERNEL_NOT_ACTIVE");
  }
  return ReportEngineKernel.dispatch(action.type, action.payload);
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
    const activeId = `legacy-norm-${Date.now()}`;
    KernelGuard({ type: "INIT_KERNEL", payload: { executionId: activeId } });
    KernelGuard({ type: "LOCK_INPUT", payload: { content, executionId: activeId } });
    return ReportEngineKernel.getContext().content;
  },

  async finalize(options: FinalizeOptions) {
    const activeId = `legacy-final-${Date.now()}`;
    KernelGuard({ type: "INIT_KERNEL", payload: { executionId: activeId } });
    KernelGuard({ type: "LOCK_INPUT", payload: { ...options, executionId: activeId } });
    KernelGuard({ type: "APPLY_POWERUPS", payload: { executionId: activeId } });
    KernelGuard({ type: "DERIVE_LAYOUT", payload: { executionId: activeId } });
    KernelGuard({ type: "VALIDATE_KERNEL", payload: { executionId: activeId } });
    
    await ReportEngineKernel.finalizeExport("WORD", activeId);
    await ReportEngineKernel.finalizeExport("PDF", activeId);

    if (options.markAsPrinted) {
      options.markAsPrinted();
    }

    return {
      output: true,
      source: "ReportEngine.finalize"
    };
  }
};
