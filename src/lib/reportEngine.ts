import { jsPDF } from "jspdf";
import { exportToWord } from "@/lib/exportToWord";
import { buildIntelligenceBriefing, loadPublicImageAsDataUrl, IntelligenceBriefing, buildIntelligenceEditorialPayload, IntelligenceReportPayload } from "@/utils/intelligenceLayoutEngine";
import { ReportQualityGate } from "@/utils/reportQualityGate";
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
  selectedAnnexes?: any;
};

export async function generatePdfProgrammatic(briefing: IntelligenceBriefing) {
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

    // Mover el badge institucional SSPE-CEIPOL a la barra de pie de figura para no obstruir los mapas/gráficos
    doc.setFillColor('#f4f7fb');
    doc.rect(x, y + height - 15, width, 15, 'F');
    
    // Badge institucional alineado a la derecha dentro de la barra
    doc.setFillColor('#0b1f3a');
    doc.rect(x + width - 30, y + height - 10.5, 27, 6, 'F');
    doc.setTextColor('#ffffff');
    doc.setFontSize(6.2);
    doc.setFont('helvetica', 'bold');
    doc.text('SSPE-CEIPOL', x + width - 16.5, y + height - 6.2, { align: 'center' });

    // Pie de figura recortado para evitar colisión con el badge
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.text);
    doc.setFont('helvetica', 'normal');
    const caption = doc.splitTextToSize(visual.caption, width - 35).slice(0, 2);
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
      doc.text('SECRETARÍA DE SEGURIDAD PÚBLICA / CEIPOL', PAGE.width / 2, 27, { align: 'center' });

      doc.setTextColor(COLORS.text);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      let cursorY = 47;
      if (page.bullets) {
        page.bullets.forEach((b) => {
          doc.text(b, PAGE.margin, cursorY);
          cursorY += 7;
        });
      }

      addSectionTitle('Resumen Ejecutivo del Dictamen', 105);
      
      doc.setFillColor('#ffffff');
      doc.roundedRect(PAGE.margin, 112, PAGE.width - PAGE.margin * 2, 68, 2, 2, 'F');
      doc.setDrawColor(COLORS.line);
      doc.roundedRect(PAGE.margin, 112, PAGE.width - PAGE.margin * 2, 68, 2, 2);
      
      doc.setTextColor(COLORS.text);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      if (page.summary) {
        const summaryLines = doc.splitTextToSize(page.summary, PAGE.width - PAGE.margin * 2 - 12);
        doc.text(summaryLines.slice(0, 10), PAGE.margin + 6, 122);
      }

    } else if (page.mode === 'executive') {
      addHeader(page.title);
      addSectionTitle(page.title, 29);
      if (page.interpretation) {
        doc.setTextColor(COLORS.text);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const textLines = doc.splitTextToSize(page.interpretation, 260);
        doc.text(textLines, PAGE.margin, 45);
      }
      if (page.bullets) {
        addBullets(page.bullets, PAGE.margin, 45, 260, 8);
      }

    } else if (page.mode === 'trazabilidad') {
      addHeader(page.title);
      addSectionTitle(page.title, 29);
      
      let currentY = 42;
      doc.setFillColor('#0b1f3a');
      doc.rect(PAGE.margin, currentY, PAGE.width - PAGE.margin * 2, 8, 'F');
      
      doc.setFontSize(7.5);
      doc.setTextColor('#ffffff');
      doc.setFont('helvetica', 'bold');
      doc.text("Componente", PAGE.margin + 4, currentY + 5.5);
      doc.text("Fuente", PAGE.margin + 42, currentY + 5.5);
      doc.text("Método", PAGE.margin + 80, currentY + 5.5);
      doc.text("Hallazgo", PAGE.margin + 128, currentY + 5.5);
      doc.text("Impacto Operativo", PAGE.margin + 195, currentY + 5.5);
      
      currentY += 8;
      
      page.sweeps?.forEach((row: any, rIdx: number) => {
        doc.setFillColor(rIdx % 2 === 0 ? '#f4f7fb' : '#ffffff');
        doc.rect(PAGE.margin, currentY, PAGE.width - PAGE.margin * 2, 10, 'F');
        doc.setDrawColor(COLORS.line);
        doc.rect(PAGE.margin, currentY, PAGE.width - PAGE.margin * 2, 10);
        
        doc.setFontSize(7);
        doc.setTextColor(COLORS.text);
        doc.setFont('helvetica', 'normal');
        
        doc.text(row.componente, PAGE.margin + 4, currentY + 6.5);
        doc.text(row.fuente, PAGE.margin + 42, currentY + 6.5);
        doc.text(row.metodo, PAGE.margin + 80, currentY + 6.5);
        doc.text(doc.splitTextToSize(row.hallazgo, 64).slice(0, 1), PAGE.margin + 128, currentY + 6.5);
        doc.text(doc.splitTextToSize(row.impacto, 60).slice(0, 1), PAGE.margin + 195, currentY + 6.5);
        
        currentY += 10;
      });

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
        doc.text(`Fuente: ${sweep.source}`, PAGE.width - PAGE.margin - 6, currentY + 8, { align: 'right' });
        
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

    // Pie de página fijo
    doc.setDrawColor(COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, PAGE.height - 10, PAGE.width - PAGE.margin, PAGE.height - 10);
    
    doc.setFontSize(7);
    doc.setTextColor(COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el ${new Date(briefing.generatedAt).toLocaleDateString()} | SSPE-CEIPOL Inteligencia Táctica`, PAGE.margin, PAGE.height - 6);
    doc.text(`Página ${idx + 1} de ${briefing.pages.length}`, PAGE.width - PAGE.margin, PAGE.height - 6, { align: 'right' });
  });

  doc.save(`Dictamen_Inteligencia_Territorial_${briefing.fileNumber}.pdf`);
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
  | "EXECUTE_EXPORT";

export type KernelSubscriber = (state: KernelState) => void;

export interface ExecutionTrace {
  executionId: string;
  transitions: string[];
  snapshots: Array<{
    state: KernelState;
    payloadLength: number;
    powerupsCount: number;
    pagesCount: number;
  }>;
  exportStatus: string;
  validationResults: any;
}

export class ReportEngineKernelClass {
  private state: KernelState = "IDLE";
  private executionId: string | null = null;
  private locked = false;
  private context: any = {};
  private subscribers: KernelSubscriber[] = [];
  private snapshots: Array<{
    state: KernelState;
    payloadLength: number;
    powerupsCount: number;
    pagesCount: number;
  }> = [];
  private transitionsList: string[] = [];
  private exportStatus = "NOT_STARTED";
  private validationResults: any = null;

  isActive(): boolean {
    return this.locked;
  }

  getState(): KernelState {
    return this.state;
  }

  getTrace(): ExecutionTrace {
    return {
      executionId: this.executionId || "",
      transitions: [...this.transitionsList],
      snapshots: [...this.snapshots],
      exportStatus: this.exportStatus,
      validationResults: this.validationResults
    };
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

    this.snapshots.push({
      state: this.state,
      payloadLength: payloadStr.length,
      powerupsCount: (this.context.powerups || []).length,
      pagesCount: (this.context.briefing?.pages || []).length
    });
  }

  async dispatch(event: KernelEvent, payload?: any) {
    console.log(`[REPORT ENGINE KERNEL] ENTER dispatch: ${event}`);
    console.log(`[STATE BEFORE] ${this.state}`);
    console.log(`[EXECUTION ID] ${this.executionId}`);

    const gate = (ev: KernelEvent, current: KernelState) => {
      const transitions: Record<KernelEvent, KernelState[]> = {
        INIT_KERNEL: ["IDLE", "INITIALIZED", "INPUT_LOCKED", "POWERUPS_DEDUPED", "LAYOUT_DERIVED", "VALIDATED", "EXPORT_EXECUTED", "COMPLETE"],
        LOCK_INPUT: ["INITIALIZED"],
        APPLY_POWERUPS: ["INPUT_LOCKED"],
        DERIVE_LAYOUT: ["POWERUPS_DEDUPED"],
        VALIDATE_KERNEL: ["LAYOUT_DERIVED"],
        EXECUTE_EXPORT: ["VALIDATED"]
      };

      if (!transitions[ev].includes(current)) {
        console.error(`[REPORT ENGINE KERNEL] TRANSITION_DENIED. Event: ${ev}, Current State: ${current}`);
        throw new Error(`MULTI_EXECUTION_BLOCKED: State: ${current}, Event: ${ev}`);
      }
    };

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
        
        const sectionsCount = (content.match(/^#+/gm) || []).length;
        if (sectionsCount > 200 || content.length > 250000) {
          throw new Error("STATE_MACHINE_OVERFLOW_BLOCKED");
        }

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
        this.context.selectedAnnexes = payload.selectedAnnexes;
        this.context.includeOsintAppendix = payload.includeOsintAppendix;

        this.state = "INPUT_LOCKED";
        this.transitionsList.push("LOCK_INPUT");
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

        this.context.powerups = structuredPowerups;
        this.state = "POWERUPS_DEDUPED";
        this.transitionsList.push("APPLY_POWERUPS");
        this.takeSnapshot();
        this.notify();
        break;

      case "DERIVE_LAYOUT": {
        gate("DERIVE_LAYOUT", this.state);
        if (this.executionId !== payload?.executionId) {
          throw new Error("DERIVE_LAYOUT_EXECUTION_ID_MISMATCH");
        }

        const editorialPayload = await buildIntelligenceEditorialPayload(
          this.context.content || "",
          this.context.album || [],
          this.context.mapSnapshots || [],
          this.context.sweeps || [],
          this.context.project,
          this.context.reportNumber,
          this.context.user?.name || this.context.user?.username
        );

        const briefing = buildIntelligenceBriefing(
          {
            projectId: this.context.reportNumber || this.context.project.id,
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

        this.context.briefing = briefing;
        this.context.editorialPayload = editorialPayload;

        this.state = "LAYOUT_DERIVED";
        this.transitionsList.push("DERIVE_LAYOUT");
        this.takeSnapshot();
        this.notify();
        break;
      }

      case "VALIDATE_KERNEL":
        gate("VALIDATE_KERNEL", this.state);
        if (this.executionId !== payload?.executionId) {
          throw new Error("VALIDATE_EXECUTION_ID_MISMATCH");
        }

        const previewLayer = typeof document !== 'undefined' && document.getElementById("official-pdf-content");
        if (previewLayer) {
          throw new Error("ASSERT_FAILED: Preview layer exists");
        }

        const payloadObj = this.context.editorialPayload;
        if (!payloadObj) {
          throw new Error("VALIDATION_FAILED_CRITERIA: Missing editorial payload");
        }

        // Auditar mediante ReportQualityGate v6.0
        ReportQualityGate.validate(payloadObj, this.context.briefing);

        const hasHIGGraph = !!payloadObj.hypothesisGraph && !!payloadObj.hypothesisGraph.dataUrl;

        // GOVERNANCE: Component integration checks based on UI selections
        const selectedAnnexes = this.context.selectedAnnexes;
        if (selectedAnnexes) {
          // Check maps
          if (selectedAnnexes.mapDensity && !payloadObj.maps.some((m: any) => m.title.toLowerCase().includes("densidad") || m.title.toLowerCase().includes("calor") || m.title.toLowerCase().includes("riesgo") || m.title.toLowerCase().includes("mapa"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.mapMobility && !payloadObj.maps.some((m: any) => m.title.toLowerCase().includes("corredores") || m.title.toLowerCase().includes("movilidad") || m.title.toLowerCase().includes("flujos"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.mapAttractors && !payloadObj.maps.some((m: any) => m.title.toLowerCase().includes("atracción") || m.title.toLowerCase().includes("atractores") || m.title.toLowerCase().includes("denue"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.mapPredictive && !payloadObj.maps.some((m: any) => m.title.toLowerCase().includes("proyección") || m.title.toLowerCase().includes("predicción") || m.title.toLowerCase().includes("predictiva"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }

          // Check graphs
          if (selectedAnnexes.chartTemporal && !payloadObj.graphs.some((g: any) => g.title.toLowerCase().includes("temporal") || g.title.toLowerCase().includes("turno") || g.title.toLowerCase().includes("horario") || g.title.toLowerCase().includes("delitos"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.chartTopology && !payloadObj.graphs.some((g: any) => g.title.toLowerCase().includes("topología") || g.title.toLowerCase().includes("frecuencia") || g.title.toLowerCase().includes("incidentes") || g.title.toLowerCase().includes("atractores"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.chartEnvironmental && !payloadObj.graphs.some((g: any) => g.title.toLowerCase().includes("facilitadores") || g.title.toLowerCase().includes("ambiental") || g.title.toLowerCase().includes("oportunidad") || g.title.toLowerCase().includes("riesgo"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.chartPrediction && !payloadObj.graphs.some((g: any) => g.title.toLowerCase().includes("predicción") || g.title.toLowerCase().includes("futuro") || g.title.toLowerCase().includes("aumento"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }

          // Check sweeps
          if (selectedAnnexes.sweepDenue && !payloadObj.sweepsData.some((s: any) => s.engine.toLowerCase().includes("denue") || s.engine.toLowerCase().includes("inegi"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.sweepIncidencia && !payloadObj.sweepsData.some((s: any) => s.engine.toLowerCase().includes("incidencia") || s.engine.toLowerCase().includes("delitos"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.sweepRepuve && !payloadObj.sweepsData.some((s: any) => s.engine.toLowerCase().includes("repuve") || s.engine.toLowerCase().includes("vehicular"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.sweepRnpdno && !payloadObj.sweepsData.some((s: any) => s.engine.toLowerCase().includes("rnpdno") || s.engine.toLowerCase().includes("desaparecidos"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.sweepMultimodal && !payloadObj.sweepsData.some((s: any) => s.engine.toLowerCase().includes("multimodal"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
          if (selectedAnnexes.sweepCifa && !payloadObj.sweepsData.some((s: any) => s.engine.toLowerCase().includes("cifa"))) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }

          // Check HIG Graph
          if (selectedAnnexes.graphConnections && !hasHIGGraph) {
            throw new Error("Informe incompleto: existen componentes seleccionados sin integración documental.");
          }
        }

        const analyticalPageCount = this.context.briefing?.pages?.filter((p: any) =>
          p.mode === 'cover' || p.mode === 'hypothesis' || p.mode === 'executive' || p.mode === 'trazabilidad' || p.mode === 'text' || p.mode === 'conclusions'
        ).length || 0;

        this.validationResults = {
          noPreviewLayer: true,
          powerupsAreStructured: true,
          totalPages: analyticalPageCount,
          noUIExportLayer: true,
          componentsVerified: true
        };
        this.state = "VALIDATED";
        this.transitionsList.push("VALIDATE_KERNEL");
        this.takeSnapshot();
        this.notify();
        break;

      case "EXECUTE_EXPORT":
        const activeId = payload?.activeId;
        const format = payload?.format || "ALL";

        console.log("[REPORT ENGINE KERNEL] EXPORT TRIGGERED. Format:", format, "activeId:", activeId);

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
        this.transitionsList.push("EXECUTE_EXPORT");
        this.takeSnapshot();
        this.notify();

        try {
          if (format === "WORD" || format === "ALL") {
            if (this.context.editorialPayload) {
              this.context.editorialPayload.includeOsintAppendix = this.context.includeOsintAppendix;
            }
            await exportToWord(
              this.context.editorialPayload,
              this.context.project.nombre || this.context.project.name || 'Expediente',
              this.context.project.id || 'EXPEDIENTE_TACTICO',
              this.context.user
            );
          }
          if (format === "PDF" || format === "ALL") {
            await generatePdfProgrammatic(this.context.briefing);
          }

          if (this.context.user && this.context.project.id) {
            try {
              const db = getDb();
              await addDoc(collection(db, "analyses"), {
                projectId: this.context.project.id,
                version: "v9.0",
                fecha: Date.now(),
                createdAt: Date.now(),
                executiveSummary: this.context.editorialPayload.executiveSummary,
                content: this.context.content || "",
                evidenceUrls: this.context.album ? this.context.album.map((p: any) => p.previewUrl || p.url).filter(Boolean) : [],
                attachedPhotos: this.context.album ? this.context.album.map((p: any) => p.previewUrl || p.url).filter(Boolean) : [],
                author: this.context.user.username,
                createdBy: this.context.user.username,
                source: "ReportEngine.finalize",
                reportEngineOutput: true,
                summary: this.context.reportSummary || ""
              });

              const projectRef = doc(db, "projects", this.context.project.id);
              await updateDoc(projectRef, {
                photoCount: this.context.album?.length || 0,
              });
            } catch (dbErr) {
              console.warn("[REPORT ENGINE KERNEL] Fallo no crítico guardando reporte en Firestore (se continúa con la exportación):", dbErr);
            }
          }

          this.exportStatus = `COMPLETE_${format}`;
          
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
    }
  }

  async finalizeExport(format: "PDF" | "WORD", activeId: string) {
    await this.dispatch("EXECUTE_EXPORT", { format, activeId });
  }
}

export const ReportEngineKernel = new ReportEngineKernelClass();

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
  }
};
