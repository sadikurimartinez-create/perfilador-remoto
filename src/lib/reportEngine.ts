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

  async finalize(options: FinalizeOptions) {
    if (!options.content?.trim()) {
      throw new Error("REPORT_ENGINE_EMPTY_OUTPUT");
    }

    const { 
      project, 
      content, 
      album, 
      mapSnapshots, 
      riskLevel, 
      reportSummary, 
      user, 
      markAsPrinted, 
      scinceDemographics,
      sweeps
    } = options;

    // 1. RECOLECTAR Y NORMALIZAR VISUALES
    const visuals: any[] = [];
    
    if (mapSnapshots) {
      mapSnapshots.forEach((snap: any, idx: number) => {
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

    if (album) {
      album.forEach((photo: any, idx: number) => {
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

    // 2. ENVIAR A LAYOUT ENGINE v2 (Strict locks & Deduplications)
    const briefing = buildIntelligenceBriefing(
      {
        projectId: project.id,
        projectName: project.nombre || project.name || 'Expediente',
        createdAt: new Date().toISOString(),
        geometryType: project.geometryType || 'polygon',
        objectives: [],
        textNotes: [],
        voiceNotes: [],
        findings: project.findings || [],
        conclusions: [],
        recommendations: []
      } as any,
      visuals,
      {
        sweeps: sweeps || [],
        reportSummary
      }
    );

    // 3. PERSISTIR EN FIRESTORE (Solo dictamen final verificado)
    if (user && project.id) {
      try {
        const db = getDb();
        await addDoc(collection(db, "analyses"), {
          projectId: project.id,
          content,
          createdAt: Date.now(),
          reportEngineOutput: true,
          source: "ReportEngine.finalize",
          title: "Dictamen Criminológico Ambiental Generado",
          summary: reportSummary || "Dictamen oficial generado.",
          createdBy: user.username,
          createdById: user.id,
          createdByRole: user.role,
          attachedPhotos: album ? album.map((p: any) => p.previewUrl).filter(Boolean) : [],
        });
        
        const projectRef = doc(db, "projects", project.id);
        await updateDoc(projectRef, {
          photoCount: album?.length || 0,
        });
      } catch (dbErr) {
        console.error("[ReportEngine] Error persisting to Firestore:", dbErr);
      }
    }

    // 4. EXPORTAR WORD (.docx)
    await exportToWord(
      content,
      project.nombre || project.name || 'Expediente',
      album ? album.map((p: any) => ({ url: p.previewUrl, tipo: p.tipo, comentario: p.comentario })) : [],
      riskLevel,
      mapSnapshots,
      scinceDemographics,
      project.id,
      reportSummary
    );

    // 5. EXPORTAR PDF PROGRAMÁTICO (jsPDF sin DOM)
    await generatePdfProgrammatic(briefing);

    // Ejecutar callback final
    if (markAsPrinted) {
      await markAsPrinted();
    }

    return {
      output: true,
      source: "ReportEngine.finalize"
    };
  }
};
