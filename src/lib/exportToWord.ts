// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
  PageOrientation,
  ShadingType,
  TabStopType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  HeightRule,
} from "docx";
import { saveAs } from "file-saver";

async function fetchLocalImageBuffer(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blob.arrayBuffer();
  } catch (e) {
    return null;
  }
}

async function applyWatermarkForWord(imageUrl: string): Promise<ArrayBuffer> {
  let objectUrl: string | null = null;
  try {
    let imgSrc = imageUrl;

    // Si es una URL HTTP/HTTPS, descargar vía fetch para evitar CORS/taint
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {      const response = await fetch(imageUrl, { mode: "cors", cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`No se pudo descargar la imagen (${response.status}). Configure las reglas CORS en Firebase Storage.`);
      }
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      imgSrc = objectUrl;
    }

    const img = new Image();
    if (imgSrc.startsWith("http://") || imgSrc.startsWith("https://")) {
      img.crossOrigin = "Anonymous";
    }
    img.src = imgSrc;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Error cargando la imagen para el Word"));
    });

    // 4. Lógica del canvas
    const canvas = document.createElement("canvas");
    canvas.width = img.width || img.naturalWidth;
    canvas.height = img.height || img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo crear el contexto de canvas");
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const fontSize = Math.floor(canvas.width / 15) || 48;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText("SSPE-CEIPOL", 0, 0);
    ctx.restore();

    // 5. Devolver ArrayBuffer para docx
    const stampedBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
      canvas.toBlob(
        async (outBlob) => {
          if (!outBlob) {
            reject(new Error("No se pudo generar el blob de la imagen"));
            return;
          }
          const arrayBuffer = await outBlob.arrayBuffer();
          resolve(arrayBuffer);
        },
        "image/jpeg",
        0.85
      );
    });

    return stampedBuffer;
  } finally {
    // Liberar memoria del URL temporal si se creó
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.indexOf(",") >= 0 ? dataUrl.split(",")[1] : dataUrl;
  if (!base64) throw new Error("Data URL inválida");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function fetchImageToBuffer(imageUrl: string): Promise<ArrayBuffer | null> {
  try {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Error loading image"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width || img.naturalWidth || 640;
    canvas.height = img.height || img.naturalHeight || 640;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0);
    return await new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (blob) resolve(await blob.arrayBuffer());
        else resolve(null);
      }, "image/jpeg", 0.85);
    });
  } catch (e) {
    return null;
  }
}

function sanitizeReportContent(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  const seenHeadings = new Set<string>();
  const seenSweepBlocks = new Set<string>();
  let skipDuplicateBlock = false;

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,4}\s+(.+)$/);
    if (headingMatch) {
      const normalizedHeading = headingMatch[1]
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      const isSweepHeading =
        normalizedHeading.includes("barrido") ||
        normalizedHeading.includes("osint") ||
        normalizedHeading.includes("street view");

      if (isSweepHeading && seenHeadings.has(normalizedHeading)) {
        skipDuplicateBlock = true;
        continue;
      }

      seenHeadings.add(normalizedHeading);
      skipDuplicateBlock = false;
    }

    if (skipDuplicateBlock) continue;

    const sweepLine = line.match(/\[Barrido\s+([^\]]+)\].*?(Tipo:\s*[^|]+)/i);
    if (sweepLine) {
      const sweepKey = `${sweepLine[1]}|${sweepLine[2]}`.toLowerCase();
      if (seenSweepBlocks.has(sweepKey)) continue;
      seenSweepBlocks.add(sweepKey);
    }

    output.push(line);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").slice(0, 18000);
}

function assertDocxLayoutWithinLimit(pageEstimate: number) {
  if (pageEstimate > 12) {
    throw new Error("STATE_MACHINE_OVERFLOW_BLOCKED");
  }
}

/**
 * Analiza el Markdown de Gemini y lo convierte en párrafos estructurados de Word.
 */
async function parseMarkdownToParagraphs(text: string): Promise<Paragraph[]> {
  const lines = text.split(/\r?\n/);
  const paragraphs: Paragraph[] = [];
  const urlRegex = /(https:\/\/maps\.googleapis\.com\/maps\/api\/streetview[^\s\)]+)/g;
      let inInfoBox = false;

  for (let line of lines) {
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 120 } }));
      continue;
    }

    let headingLevel: any = null;
    let isBullet = false;

    if (line.startsWith("# ")) { headingLevel = HeadingLevel.HEADING_1; line = line.replace(/^# /, ""); }
    else if (line.startsWith("## ")) { headingLevel = HeadingLevel.HEADING_2; line = line.replace(/^## /, ""); }
    else if (line.startsWith("### ")) { headingLevel = HeadingLevel.HEADING_3; line = line.replace(/^### /, ""); }
    else if (line.startsWith("- ") || line.startsWith("* ")) { isBullet = true; line = line.replace(/^[-*]\s/, ""); }
    else if (line.match(/^\d+\.\s/)) { isBullet = true; line = line.replace(/^\d+\.\s/, ""); }

    // Limpiar sintaxis de links markdown por si Gemini arrojó la url de Street View así: [Street View](https://...)
    let cleanLine = line.replace(/\[([^\]]*)\]\((https:\/\/maps\.googleapis\.com\/maps\/api\/streetview[^\)]+)\)/g, "$2");
    cleanLine = cleanLine.replace(/!\[([^\]]*)\]\((https:\/\/maps\.googleapis\.com\/maps\/api\/streetview[^\)]+)\)/g, "$2");

    const parts = cleanLine.split(urlRegex);
    const runs: any[] = [];
    
    for (const part of parts) {
      if (part.startsWith("https://maps.googleapis.com/maps/api/streetview")) {
        const imgBuf = await fetchImageToBuffer(part);
        if (imgBuf) {
          // Imagen cuadrada para la vista de Street View dentro del texto
          runs.push(new ImageRun({ data: imgBuf, transformation: { width: 400, height: 400 } }));
        } else {
          runs.push(new TextRun({ text: "[Error al cargar imagen Street View automática]", color: "FF0000", size: 22 }));
        }
      } else if (part) {
        const bParts = part.split(/(\*\*.*?\*\*)/g);
        for (const bp of bParts) {
          if (bp.startsWith("**") && bp.endsWith("**")) {
                runs.push(new TextRun({ text: bp.slice(2, -2), bold: true, size: 22, font: "Calibri", color: "222222" }));
          } else if (bp) {
                runs.push(new TextRun({ text: bp, size: 22, font: "Calibri", color: "222222" }));
          }
        }
      }
    }

    if (headingLevel) {
          const upperLine = cleanLine.toUpperCase();
          inInfoBox = upperLine.includes("CONCLUSIONES") || upperLine.includes("HALLAZGOS") || upperLine.includes("PREDICTIVA") || upperLine.includes("RECOMENDACION");
          paragraphs.push(new Paragraph({ children: runs, heading: headingLevel }));
    } else {
          const paragraphOpts: any = {
            children: runs,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 80, after: 80 }
          };
          
          if (inInfoBox && !isBullet && !line.includes("https://maps")) {
            paragraphOpts.shading = { type: ShadingType.CLEAR, fill: "F2F4F7" };
            paragraphOpts.border = {
              top: { color: "0D2B52", space: 1, style: BorderStyle.SINGLE, size: 12 },
              bottom: { color: "0D2B52", space: 1, style: BorderStyle.SINGLE, size: 12 },
              left: { color: "0D2B52", space: 1, style: BorderStyle.SINGLE, size: 12 },
              right: { color: "0D2B52", space: 1, style: BorderStyle.SINGLE, size: 12 },
            };
          }
          
          if (isBullet) {
            paragraphOpts.numbering = { reference: "custom-bullets", level: 0 };
          }
          
          paragraphs.push(new Paragraph(paragraphOpts));
    }
  }
  return paragraphs;
}

export async function exportToWord(
  content: string,
  projectName: string,
  attachedPhotos?: ({ url: string; tipo?: string; comentario?: string } | string)[],
  riskLevel?: "bajo" | "medio" | "alto",
  mapSnapshots?: { title: string; dataUrl: string }[],
  scinceDemographics?: any,
  reportNumber?: string,
  reportSummary?: string
) {
  const safeName = projectName.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9_-]+/g, "_") || "SinNombre";
  const reportContent = sanitizeReportContent(content);
  const visualCount = Math.min(mapSnapshots?.length || 0, 8);
  const photoCount = Math.min(attachedPhotos?.length || 0, 8);
  const estimatedPages = 2 + Math.ceil(reportContent.length / 3200) + Math.ceil(visualCount / 2) + Math.ceil(photoCount / 2);
  assertDocxLayoutWithinLimit(estimatedPages);

  // 1. CARGA DE LOGOS
  const sspLogoBuffer = await fetchLocalImageBuffer("/logos/logo-ssp.png");
  const ceipolLogoBuffer = await fetchLocalImageBuffer("/logos/logo-ceipol.png");
  const logoChildren: any[] = [];

  if (sspLogoBuffer) {
    logoChildren.push(new ImageRun({ data: sspLogoBuffer, transformation: { width: 100, height: 100 } } as any));
    logoChildren.push(new TextRun({ text: "                " })); // espacio
  }
  if (ceipolLogoBuffer) {
    logoChildren.push(new ImageRun({ data: ceipolLogoBuffer, transformation: { width: 100, height: 100 } } as any));
  }

  // 2. CONSTRUCCIÓN DE LA PORTADA
  const coverPageParagraphs: Paragraph[] = [];
  if (logoChildren.length > 0) {
    coverPageParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: logoChildren,
        spacing: { before: 400, after: 1000 }
      })
    );
  } else {
    coverPageParagraphs.push(new Paragraph({ spacing: { before: 1400 } }));
  }

  coverPageParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "DICTAMEN TÁCTICO", size: 28, color: "0D2B52", bold: true, font: "Calibri" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "PERFIL CRIMINOLÓGICO AMBIENTAL", size: 40, color: "0D2B52", bold: true, font: "Calibri" })],
      spacing: { before: 120, after: 1000 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `NÚMERO DE EXPEDIENTE: ${reportNumber || projectName.toUpperCase()}`, size: 24, font: "Calibri", color: "222222", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `FECHA DE EMISIÓN: ${new Date().toLocaleDateString("es-MX")}`, size: 24, font: "Calibri", color: "222222" })],
      spacing: { after: 600 }
    })
  );

  if (reportSummary) {
    coverPageParagraphs.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [new TextRun({ text: "SÍNTESIS EJECUTIVA DEL DICTAMEN", bold: true, size: 22, color: "0D2B52", font: "Calibri" })]
      }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        shading: { type: ShadingType.CLEAR, fill: "F5F7FA" },
        border: {
          top: { color: "D9DEE5", space: 1, style: BorderStyle.SINGLE, size: 6 },
          bottom: { color: "D9DEE5", space: 1, style: BorderStyle.SINGLE, size: 6 },
          left: { color: "D9DEE5", space: 1, style: BorderStyle.SINGLE, size: 6 },
          right: { color: "D9DEE5", space: 1, style: BorderStyle.SINGLE, size: 6 },
        },
        children: [new TextRun({ text: reportSummary, size: 22, font: "Calibri", color: "222222" })],
        spacing: { before: 120, after: 600 }
      })
    );
  }

  let riskColor = "B22222"; // CRÍTICO
  if (riskLevel === "bajo") riskColor = "2E8B57";
  else if (riskLevel === "medio") riskColor = "E6A700";
  else if (riskLevel === "alto") riskColor = "D96A00";

  if (riskLevel) {
    coverPageParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `NIVEL DE RIESGO: ${riskLevel.toUpperCase()}`, bold: true, size: 32, font: "Calibri", color: riskColor })],
        spacing: { after: 1000 }
      })
    );
  }

  coverPageParagraphs.push(
    new Paragraph({
        border: { top: { color: "0D2B52", space: 1, style: BorderStyle.SINGLE, size: 24 } }
    })
  );
  coverPageParagraphs.push(new Paragraph({ pageBreakBefore: true })); // Salto de página después de portada

  // 3. CUERPO DEL DOCUMENTO (Parseado desde Markdown)
  const bodyParagraphs = await parseMarkdownToParagraphs(reportContent);

  // 3.5 PERFIL SOCIODEMOGRÁFICO
  const scinceElements: any[] = [];
  if (scinceDemographics) {
    scinceElements.push(
      new Paragraph({
        children: [new TextRun({ text: "PERFIL SOCIODEMOGRÁFICO DEL ÁREA DE ANÁLISIS", bold: true, size: 28, font: "Aptos", color: "0D2B52" })],
        spacing: { before: 360, after: 200 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "Caracterización sociodemográfica obtenida mediante integración de información censal INEGI correspondiente al área geográfica analizada.", size: 22, font: "Aptos", color: "222222" })],
        spacing: { after: 360 }
      })
    );

    const createRow = (icon: string, indicator: string, value: string, isGray: boolean, valueColor?: string) => {
      const shading = isGray ? { fill: "F5F7FA", type: ShadingType.CLEAR } : undefined;
      const borders = {
        top: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
      };

      return new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            shading, borders, verticalAlign: VerticalAlign.CENTER, width: { size: 15, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: icon, font: "Segoe UI Emoji", size: 22 })] })]
          }),
          new TableCell({
            shading, borders, verticalAlign: VerticalAlign.CENTER, width: { size: 55, type: WidthType.PERCENTAGE },
            margins: { left: 100 },
            children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: indicator, font: "Aptos", size: 22, color: "222222", bold: true })] })]
          }),
          new TableCell({
            shading, borders, verticalAlign: VerticalAlign.CENTER, width: { size: 30, type: WidthType.PERCENTAGE },
            margins: { right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: value, font: "Aptos", size: 22, color: valueColor || "222222", bold: true })] })]
          })
        ]
      });
    };

    const headerRow = new TableRow({
      height: { value: 400, rule: HeightRule.ATLEAST },
      children: [
        new TableCell({
          shading: { fill: "0D2B52", type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Ícono", font: "Aptos", size: 24, bold: true, color: "FFFFFF" })] })]
        }),
        new TableCell({
          shading: { fill: "0D2B52", type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          margins: { left: 100 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: "Indicador", font: "Aptos", size: 24, bold: true, color: "FFFFFF" })] })]
        }),
        new TableCell({
          shading: { fill: "0D2B52", type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          margins: { right: 100 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Valor", font: "Aptos", size: 24, bold: true, color: "FFFFFF" })] })]
        })
      ]
    });

    const rows = [headerRow];
    const indicators = [
      { icon: "👥", name: "Población Total", val: scinceDemographics.poblacionTotal.toLocaleString("es-MX") },
      { icon: "👨", name: "Hombres", val: `${scinceDemographics.hombres.toLocaleString("es-MX")} (${scinceDemographics.pctHombres.toFixed(1)}%)` },
      { icon: "👩", name: "Mujeres", val: `${scinceDemographics.mujeres.toLocaleString("es-MX")} (${scinceDemographics.pctMujeres.toFixed(1)}%)` },
      { icon: "🎂", name: "Edad Promedio", val: `${scinceDemographics.edadPromedio.toFixed(1)} años` },
      { icon: "🧑", name: "Población de 15 a 29 años", val: `${scinceDemographics.pctJovenes.toFixed(1)}%` },
      { icon: "🎓", name: "Escolaridad Promedio", val: `${scinceDemographics.escolaridad.toFixed(1)} años` },
      { icon: "🏠", name: "Viviendas Habitadas", val: scinceDemographics.viviendas.toLocaleString("es-MX") },
      { icon: "👩‍👧", name: "Hogares con Jefatura Femenina", val: `${scinceDemographics.jefaturaFem.toFixed(1)}%` },
      { icon: "💼", name: "Población Económicamente Activa", val: `${scinceDemographics.pea.toFixed(1)}%` },
      { icon: "🌐", name: "Acceso a Internet", val: `${scinceDemographics.internet.toFixed(1)}%` },
      { icon: "📍", name: "Densidad Poblacional", val: `${scinceDemographics.densidad.toLocaleString("es-MX")} hab/km²` },
      { icon: "📉", name: "Grado de Marginación", val: scinceDemographics.gradoMarginacion },
      { icon: "🚨", name: "Índice Sociodemográfico de Vulnerabilidad", val: scinceDemographics.gradoVulnerabilidad, color: scinceDemographics.colorVulnerabilidad },
    ];

    indicators.forEach((ind, i) => {
      rows.push(createRow(ind.icon, ind.name, ind.val, i % 2 !== 0, ind.color));
    });

    const table = new Table({
      width: { size: 90, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows
    });
    
    scinceElements.push(table);

    const lecturaTable = new Table({
      width: { size: 90, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" },
                bottom: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" },
                left: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" },
                right: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" },
              },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
              children: [
                new Paragraph({
                  spacing: { after: 120 },
                  children: [new TextRun({ text: "LECTURA SOCIODEMOGRÁFICA", bold: true, font: "Aptos", size: 24, color: "0D2B52" })]
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  children: [new TextRun({ text: scinceDemographics.lectura, font: "Aptos", size: 22, color: "222222" })]
                })
              ]
            })
          ]
        })
      ]
    });

    const censintTable = new Table({
      width: { size: 90, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" },
                bottom: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" },
                left: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" },
                right: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" },
              },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
              children: [
                new Paragraph({
                  spacing: { after: 120 },
                  children: [new TextRun({ text: "EVALUACIÓN DE VULNERABILIDAD SOCIODEMOGRÁFICA (CENSINT)", bold: true, font: "Aptos", size: 24, color: "0D2B52" })]
                }),
                new Paragraph({
                  spacing: { after: 120 },
                  children: [
                    new TextRun({ text: "SocioDemographic Vulnerability Score (SVS): ", bold: true, font: "Aptos", size: 22, color: "222222" }),
                    new TextRun({ text: `${scinceDemographics.svs}/100`, bold: true, font: "Aptos", size: 22, color: scinceDemographics.svsColor }),
                    new TextRun({ text: ` [${scinceDemographics.svsNivel.toUpperCase()}]`, bold: true, font: "Aptos", size: 22, color: scinceDemographics.svsColor })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  children: [new TextRun({ text: scinceDemographics.lecturaCensint, font: "Aptos", size: 22, color: "222222" })]
                })
              ]
            })
          ]
        })
      ]
    });

    scinceElements.push(
      new Paragraph({ spacing: { before: 240 } }),
      lecturaTable,
      new Paragraph({ spacing: { before: 240 } }),
      censintTable,
      new Paragraph({ spacing: { after: 360 } })
    );
  }

  // 4. MAPAS (ATLAS CARTOGRÁFICO)
  const mapElements: any[] = [];
  if (mapSnapshots && mapSnapshots.length > 0) {
    const boundedSnapshots = mapSnapshots.slice(0, 8);
    const chartsSnaps = boundedSnapshots.filter(s => s.title.toLowerCase().includes("gráfica") || s.title.toLowerCase().includes("grafica"));
    const mapsSnaps = boundedSnapshots.filter(s => !chartsSnaps.some((c) => c.title === s.title));

    const processVisuals = async (title: string, snaps: any[]) => {
      if (snaps.length === 0) return;

      const cellsData: any[] = [];
      for (const snapshot of snaps) {
        if (snapshot.dataUrl && snapshot.dataUrl.startsWith("data:image")) {
          try {
            const tmpImg = new Image();
            tmpImg.src = snapshot.dataUrl;
            await new Promise<void>((resolve, reject) => {
              tmpImg.onload = () => resolve();
              tmpImg.onerror = () => reject(new Error("[exportToWord] Error en visual"));
            });
            const MAP_MAX_WIDTH = 360;
            const ratio = (tmpImg.height || MAP_MAX_WIDTH) / (tmpImg.width || MAP_MAX_WIDTH) || 1;
            const proportionalHeight = Math.min(210, Math.floor(MAP_MAX_WIDTH * ratio));

            const mapBuffer = dataUrlToArrayBuffer(snapshot.dataUrl);
            cellsData.push({snapshot, mapBuffer, width: MAP_MAX_WIDTH, height: proportionalHeight });
          } catch (e) { console.warn("Error en visual:", e); }
        }
      }

      for (let i = 0; i < cellsData.length; i += 2) {
        mapElements.push(new Paragraph({ pageBreakBefore: true }));
        if (i === 0) {
          mapElements.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: title, bold: true, size: 32, font: "Calibri", color: "0D2B52" })],
              spacing: { after: 400 }
            })
          );
        }

        const renderMapItem = (m: any) => {
          if (!m) return [];
          return [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: m.snapshot.title.toUpperCase(), bold: true, size: 18, color: "0D2B52", font: "Calibri" })],
              spacing: { before: 120, after: 60 }
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({ data: m.mapBuffer, transformation: { width: m.width, height: m.height } } as any)]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `Plataforma de Geointeligencia SAI | ${new Date().toLocaleDateString("es-MX")}`, size: 12, color: "5B6573", font: "Calibri" })],
              spacing: { before: 40, after: 240 }
            })
          ];
        };

        mapElements.push(...renderMapItem(cellsData[i]));
        if (cellsData[i + 1]) {
          mapElements.push(...renderMapItem(cellsData[i + 1]));
        }
      }
    };

    await processVisuals("ATLAS CARTOGRÁFICO Y GEOESPACIAL", mapsSnaps);
    await processVisuals("MODELOS ANALÍTICOS Y GRÁFICAS", chartsSnaps);
  }

  // 5. FOTOGRAFÍAS TÁCTICAS
  const photoElements: any[] = [];
  if (attachedPhotos && attachedPhotos.length > 0) {
    const photoCellsData: any[] = [];
    const boundedPhotos = attachedPhotos.slice(0, 8);
    for (let i = 0; i < boundedPhotos.length; i++) {
      const item = boundedPhotos[i];
      const url = typeof item === "string" ? item : item.url;
      const tipo = typeof item === "string" ? "Evidencia Táctica" : (item.tipo || "Evidencia Táctica");
      const comentario = typeof item === "string" ? "" : (item.comentario || "Sin comentario.");
      try {
        const stampedBuffer = await applyWatermarkForWord(url);
        // Reconstruir un objeto Image para conocer el aspect ratio
        const img = new Image();
        img.src = url;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () =>
            reject(
              new Error(
                "[exportToWord] No se pudo calcular dimensiones originales de la imagen"
              )
            );
        });
        const WORD_MAX_WIDTH = 360;
        const originalWidth = img.width || img.naturalWidth || 640;
        const originalHeight = img.height || img.naturalHeight || 480;
        const ratio = originalHeight / originalWidth || 1;
        const proportionalHeight = Math.min(230, Math.floor(WORD_MAX_WIDTH * ratio));

        photoCellsData.push({ stampedBuffer, tipo, comentario, width: WORD_MAX_WIDTH, height: proportionalHeight, index: i + 1 });
      } catch (err) {
        console.warn("Error procesando foto:", url, err);
      }
    }

    for (let i = 0; i < photoCellsData.length; i += 2) {
      photoElements.push(new Paragraph({ pageBreakBefore: true }));
      if (i === 0) {
        photoElements.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "ANEXO FOTOGRÁFICO Y TRABAJO DE CAMPO", bold: true, size: 32, font: "Calibri", color: "0D2B52" })],
            spacing: { after: 400 }
          })
        );
      }

      const renderPhotoItem = (p: any) => {
        if (!p) return [];
        const items = [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: p.stampedBuffer, transformation: { width: p.width, height: p.height } } as any)],
            spacing: { before: 120 }
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Imagen ${p.index} - ${p.tipo}`, bold: true, size: 18, color: "0D2B52", font: "Calibri" })],
            spacing: { before: 60 }
          })
        ];

        if (p.comentario) {
          items.push(
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              children: [new TextRun({ text: p.comentario, size: 20, font: "Calibri", color: "222222" })],
              spacing: { before: 60, after: 60 }
            })
          );
        }

        items.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Trabajo de Campo | ${new Date().toLocaleDateString("es-MX")}`, size: 12, color: "5B6573", font: "Calibri" })],
            spacing: { after: 240 }
          })
        );

        return items;
      };

      photoElements.push(...renderPhotoItem(photoCellsData[i]));
      if (photoCellsData[i + 1]) {
        photoElements.push(...renderPhotoItem(photoCellsData[i + 1]));
      }
    }
  }

  const headerFooterTabs = [
    { type: TabStopType.CENTER, position: 4283 },
    { type: TabStopType.RIGHT, position: 8567 },
  ];

  // 6. ENSAMBLAJE DEL DOCUMENTO WORD
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "custom-bullets",
          levels: [
            {
              level: 0,
              format: "bullet",
              text: "■",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } }
            },
            {
              level: 1,
              format: "bullet",
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1080, hanging: 360 } } }
            },
            {
              level: 2,
              format: "bullet",
              text: "–",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } }
            }
          ]
        }
      ]
    },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: "222222" }, // 11pt
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 276, after: 120 }, widowControl: true },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: { color: "0D2B52", size: 32, bold: true },
          paragraph: {
            spacing: { before: 360, after: 200 },
            border: {
              top: { color: "0D2B52", space: 1, style: BorderStyle.SINGLE, size: 12 },
            },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { color: "1F4E79", size: 26, bold: true },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          run: { color: "222222", size: 22, bold: true },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
            margin: { top: 1417, bottom: 1134, left: 1417, right: 1134 }, // 2.5cm sup/izq, 2.0cm inf/der
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: headerFooterTabs,
                children: [
                  new TextRun({ text: "CEIPOL", bold: true, color: "5B6573", size: 18, font: "Calibri" }),
                  new TextRun({ text: "\tPERFIL CRIMINOLÓGICO AMBIENTAL", color: "5B6573", size: 18, font: "Calibri" }),
                  new TextRun({ text: "\tCONFIDENCIAL | USO EXCLUSIVO", bold: true, color: "5B6573", size: 18, font: "Calibri" }),
                ],
                border: { bottom: { color: "D9DEE5", space: 1, style: BorderStyle.SINGLE, size: 6 } },
                spacing: { after: 200 }
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: headerFooterTabs,
                border: { top: { color: "D9DEE5", space: 1, style: BorderStyle.SINGLE, size: 6 } },
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: `${new Date().toLocaleDateString("es-MX")} | `, color: "5B6573", size: 14, font: "Calibri" }),
                  new TextRun({ 
                    children: ["Pagina ", PageNumber.CURRENT || "1", " | "],
                    color: "5B6573", 
                    size: 14,
                    font: "Calibri" 
                  }),
                  new TextRun({ text: `EXP: ${safeName.slice(0, 46)}`, color: "5B6573", size: 14, font: "Calibri" }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...coverPageParagraphs,
          ...scinceElements,
          ...bodyParagraphs,
          ...mapElements,
          ...photoElements,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  saveAs(blob, `Dictamen_Oficial_${safeName}.docx`);
}
