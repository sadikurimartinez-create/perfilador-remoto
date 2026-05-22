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
    ctx.fillText("SIGLAS DE TU DEPENDENCIA AQUÍ", 0, 0);
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

/**
 * Analiza el Markdown de Gemini y lo convierte en párrafos estructurados de Word.
 */
function parseMarkdownToParagraphs(text: string): Paragraph[] {
  const lines = text.split(/\r?\n/);
  const paragraphs: Paragraph[] = [];

  for (let line of lines) {
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 120 } }));
      continue;
    }

    let headingLevel = null;
    let isBullet = false;

    if (line.startsWith("# ")) { headingLevel = HeadingLevel.HEADING_1; line = line.replace(/^# /, ""); }
    else if (line.startsWith("## ")) { headingLevel = HeadingLevel.HEADING_2; line = line.replace(/^## /, ""); }
    else if (line.startsWith("### ")) { headingLevel = HeadingLevel.HEADING_3; line = line.replace(/^### /, ""); }
    else if (line.startsWith("- ") || line.startsWith("* ")) { isBullet = true; line = line.replace(/^[-*]\s/, ""); }
    else if (line.match(/^\d+\.\s/)) { isBullet = true; }

    const parts = line.split(/(\*\*.*?\*\*)/g);
    const runs = parts.map(part => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return new TextRun({ text: part.slice(2, -2), bold: true, size: 22, font: "Arial" });
      }
      return new TextRun({ text: part, size: 22, font: "Arial" });
    });

    if (headingLevel) {
      paragraphs.push(new Paragraph({ children: runs, heading: headingLevel, spacing: { before: 240, after: 120 } }));
    } else if (isBullet) {
      paragraphs.push(new Paragraph({ children: runs, bullet: { level: 0 }, spacing: { before: 120, after: 120 }, alignment: AlignmentType.JUSTIFIED }));
    } else {
      paragraphs.push(new Paragraph({ children: runs, spacing: { before: 120, after: 120 }, alignment: AlignmentType.JUSTIFIED }));
    }
  }
  return paragraphs;
}

export async function exportToWord(
  content: string,
  projectName: string,
  attachedPhotos?: string[],
  riskLevel?: "bajo" | "medio" | "alto",
  mapSnapshots?: { title: string; dataUrl: string }[]
) {
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
  const coverPageParagraphs: Paragraph[] = [
    new Paragraph({ spacing: { before: 1000 } }),
  ];

  if (logoChildren.length > 0) {
    coverPageParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: logoChildren,
      })
    );
  }

  coverPageParagraphs.push(
    new Paragraph({ spacing: { before: 800 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "DICTAMEN TÁCTICO", bold: true, size: 36, font: "Arial", color: "1E293B" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "PERFIL CRIMINOLÓGICO AMBIENTAL", bold: true, size: 48, font: "Arial", color: "0F172A" })],
    }),
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `POLÍGONO / EXPEDIENTE: ${projectName.toUpperCase()}`, size: 24, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `FECHA DE EMISIÓN: ${new Date().toLocaleDateString("es-MX")}`, size: 24, font: "Arial" })],
    }),
    new Paragraph({ spacing: { before: 800 } })
  );

  if (riskLevel) {
    const color = riskLevel === "alto" ? "DC2626" : riskLevel === "medio" ? "D97706" : "16A34A";
    coverPageParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `NIVEL DE RIESGO: ${riskLevel.toUpperCase()}`, bold: true, size: 28, font: "Arial", color })],
      })
    );
  }

  coverPageParagraphs.push(new Paragraph({ pageBreakBefore: true })); // Salto de página después de portada

  // 3. CUERPO DEL DOCUMENTO (Parseado desde Markdown)
  const bodyParagraphs = parseMarkdownToParagraphs(content);

  // 4. MAPAS (ATLAS CARTOGRÁFICO)
  const mapParagraphs: Paragraph[] = [];
  if (mapSnapshots && mapSnapshots.length > 0) {
    mapParagraphs.push(new Paragraph({ pageBreakBefore: true }));
    mapParagraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "ATLAS CARTOGRÁFICO Y GEOESPACIAL", bold: true, size: 32, font: "Arial" })],
        spacing: { after: 400 }
      })
    );

    for (const snapshot of mapSnapshots) {
      if (snapshot.dataUrl && snapshot.dataUrl.startsWith("data:image")) {
        try {
          const tmpImg = new Image();
          tmpImg.src = snapshot.dataUrl;
          await new Promise<void>((resolve, reject) => {
            tmpImg.onload = () => resolve();
            tmpImg.onerror = () => reject(new Error("[exportToWord] Error en mapa"));
          });
          const MAP_MAX_WIDTH = 600;
          const ratio = (tmpImg.height || MAP_MAX_WIDTH) / (tmpImg.width || MAP_MAX_WIDTH) || 1;
          const proportionalHeight = Math.floor(MAP_MAX_WIDTH * ratio);

          const mapBuffer = dataUrlToArrayBuffer(snapshot.dataUrl);
          mapParagraphs.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: snapshot.title.toUpperCase(), bold: true, size: 24, font: "Arial" })],
              spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  ...({ data: mapBuffer, transformation: { width: MAP_MAX_WIDTH, height: proportionalHeight } } as any),
                }),
              ],
            })
          );
        } catch (e) { console.warn("Error en mapa:", e); }
      }
    }
  }

  // 5. FOTOGRAFÍAS TÁCTICAS
  const photoParagraphs: Paragraph[] = [];
  if (attachedPhotos && attachedPhotos.length > 0) {
    photoParagraphs.push(new Paragraph({ pageBreakBefore: true }));
    photoParagraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "ANEXO FOTOGRÁFICO Y TRABAJO DE CAMPO", bold: true, size: 32, font: "Arial" })],
        spacing: { after: 400 }
      })
    );

    const WORD_MAX_WIDTH = 500;
    for (const url of attachedPhotos) {
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
        const originalWidth = img.width || img.naturalWidth || WORD_MAX_WIDTH;
        const originalHeight = img.height || img.naturalHeight || WORD_MAX_WIDTH;
        const ratio = originalHeight / originalWidth || 1;
        const proportionalHeight = Math.floor(WORD_MAX_WIDTH * ratio);

        photoParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                ...({ data: stampedBuffer, transformation: { width: WORD_MAX_WIDTH, height: proportionalHeight } } as any),
              }),
            ],
            spacing: { before: 200, after: 400 }
          })
        );
      } catch (err) {
        console.warn("Error procesando foto:", url, err);
      }
    }
  }

  // 6. ENSAMBLAJE DEL DOCUMENTO WORD
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: "000000" }, // 11pt
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 276 } }, // 1.15 line spacing
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: { color: "0F172A", size: 32, bold: true },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { color: "1E293B", size: 28, bold: true },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
      ],
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "CONFIDENCIAL / USO EXCLUSIVO - CEIPOL", color: "94A3B8", size: 16 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Página ", size: 18, color: "64748B" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "64748B" }),
                  new TextRun({ text: " de ", size: 18, color: "64748B" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "64748B" }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...coverPageParagraphs,
          ...bodyParagraphs,
          ...mapParagraphs,
          ...photoParagraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName =
    projectName
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_") || "SinNombre";

  saveAs(blob, `Dictamen_Oficial_${safeName}.docx`);
}
