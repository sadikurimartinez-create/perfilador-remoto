import { exportToWord } from "@/lib/exportToWord";

type FinalizeOptions = {
  content: string;
  projectName: string;
  attachedPhotos?: ({ url: string; tipo?: string; comentario?: string } | string)[];
  riskLevel?: "bajo" | "medio" | "alto";
  mapSnapshots?: { title: string; dataUrl: string }[];
  scinceDemographics?: any;
  reportNumber?: string;
  reportSummary?: string;
  markAsPrinted?: () => Promise<void> | void;
};

type PdfOptions = {
  element: HTMLElement;
  filename: string;
  markAsPrinted?: () => Promise<void> | void;
  maxPages?: number;
};

const assertPdfLayoutWithinLimit = (element: HTMLElement, maxPages = 12) => {
  const pageHeightPx = 1123;
  const estimatedPages = Math.ceil(element.scrollHeight / pageHeightPx);
  if (estimatedPages > maxPages) {
    throw new Error("LAYOUT_OVERFLOW_DETECTED");
  }
};

export const ReportEngine = {
  async finalize(options: FinalizeOptions) {
    if (!options.content?.trim()) {
      throw new Error("REPORT_ENGINE_EMPTY_OUTPUT");
    }

    await exportToWord(
      options.content,
      options.projectName,
      options.attachedPhotos,
      options.riskLevel,
      options.mapSnapshots,
      options.scinceDemographics,
      options.reportNumber,
      options.reportSummary
    );

    await options.markAsPrinted?.();

    return {
      output: true,
      source: "ReportEngine.finalize",
    };
  },

  async finalizePdf(options: PdfOptions) {
    assertPdfLayoutWithinLimit(options.element, options.maxPages ?? 12);

    // @ts-ignore html2pdf.js no expone tipos consistentes en este proyecto.
    const html2pdfModule = await import("html2pdf.js");
    const html2pdf = ((html2pdfModule as any).default || html2pdfModule) as any;
    await html2pdf()
      .set({
        margin: 0,
        filename: options.filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(options.element)
      .save();

    await options.markAsPrinted?.();

    return {
      output: true,
      source: "ReportEngine.finalize",
    };
  },
};
