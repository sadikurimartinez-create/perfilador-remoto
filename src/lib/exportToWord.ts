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

async function applyWatermarkForWord(imageUrl: string): Promise<ArrayBuffer | null> {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  let objectUrl: string | null = null;
  try {
    let imgSrc = imageUrl;

    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const response = await fetch(imageUrl, { mode: "cors", cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`No se pudo descargar la imagen (${response.status}).`);
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

    const canvas = document.createElement("canvas");
    canvas.width = img.width || img.naturalWidth || 640;
    canvas.height = img.height || img.naturalHeight || 480;
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
  } catch (err) {
    console.error("Watermark failed for image:", imageUrl, err);
    return null;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const base64Index = dataUrl.indexOf(",");
  const base64 = base64Index >= 0 ? dataUrl.split(",")[1] : dataUrl;
  if (!base64) return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch (e) {
    console.error("Failed to convert dataUrl to ArrayBuffer:", e);
    return null;
  }
}

export async function exportToWord(
  payload: any,
  projectName: string,
  reportNumber?: string,
  user?: any
) {
  const safeName = projectName.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9_-]+/g, "_") || "SinNombre";

  // 1. CARGA DE LOGOS
  const sspLogoBuffer = await fetchLocalImageBuffer("/logos/logo-ssp.png");
  const ceipolLogoBuffer = await fetchLocalImageBuffer("/logos/logo-ceipol.png");
  const logoChildren: any[] = [];

  if (sspLogoBuffer) {
    logoChildren.push(new ImageRun({ data: sspLogoBuffer, transformation: { width: 50, height: 50 } } as any));
    logoChildren.push(new TextRun({ text: "                " })); // espacio
  }
  if (ceipolLogoBuffer) {
    logoChildren.push(new ImageRun({ data: ceipolLogoBuffer, transformation: { width: 50, height: 50 } } as any));
  }

  // HELPER PARAGRAPH CREATORS
  const createTitle = (text: string) => new Paragraph({
    children: [new TextRun({ text, size: 26, bold: true, color: "0D2B52", font: "Calibri" })],
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" } }
  });

  const createSubtitle = (text: string) => new Paragraph({
    children: [new TextRun({ text, size: 18, bold: true, color: "1F4E79", font: "Calibri" })],
    spacing: { before: 120, after: 60 }
  });

  const createBodyText = (text: string) => new Paragraph({
    children: [new TextRun({ text, size: 20, font: "Calibri", color: "222222" })],
    spacing: { after: 120 },
    alignment: AlignmentType.JUSTIFIED
  });

  const createBullet = (boldPrefix: string, text: string, color = "222222") => new Paragraph({
    children: [
      new TextRun({ text: "• ", bold: true, color: "0D2B52", size: 20 }),
      new TextRun({ text: boldPrefix, bold: true, color: "0D2B52", size: 18 }),
      new TextRun({ text, color, size: 18 })
    ],
    spacing: { after: 80 }
  });

  const elements: any[] = [];

  // ================= PÁGINA 1: PORTADA & DETALLES =================
  if (logoChildren.length > 0) {
    elements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: logoChildren,
        spacing: { before: 200, after: 300 }
      })
    );
  }

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "DICTAMEN TÉCNICO DE INTELIGENCIA TERRITORIAL", size: 30, color: "0D2B52", bold: true, font: "Calibri" })],
      spacing: { after: 60 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "SECRETARÍA DE SEGURIDAD PÚBLICA - CEIPOL", size: 18, color: "5B6573", bold: true, font: "Calibri" })],
      spacing: { after: 300 }
    })
  );

  // Tabla de Metadatos
  const metaBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE5" },
  };

  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: metaBorders, width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "EXPEDIENTE:", bold: true, size: 16 }), new TextRun({ text: ` ${payload.projectName.toUpperCase()}`, size: 16 })] })]
          }),
          new TableCell({
            borders: metaBorders, width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "NÚMERO EXP:", bold: true, size: 16 }), new TextRun({ text: ` ${payload.projectId}`, size: 16 })] })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: metaBorders, width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "FECHA:", bold: true, size: 16 }), new TextRun({ text: ` ${payload.date}`, size: 16 })] })]
          }),
          new TableCell({
            borders: metaBorders, width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "ANALISTA:", bold: true, size: 16 }), new TextRun({ text: ` ${payload.analyst}`, size: 16 })] })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: metaBorders, width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "GEOMETRÍA:", bold: true, size: 16 }), new TextRun({ text: ` ${payload.geometryType.toUpperCase()}`, size: 16 })] })]
          }),
          new TableCell({
            borders: metaBorders, width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "ÁREA GEOGRÁFICA:", bold: true, size: 16 }), new TextRun({ text: ` ${payload.areaGeografica}`, size: 16 })] })]
          })
        ]
      })
    ],
    spacing: { after: 300 }
  });

  elements.push(metadataTable);

  // Clasificación de Seguridad en la Portada
  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "CLASIFICACIÓN: ", bold: true, size: 18, color: "B91C1C" }),
        new TextRun({ text: "CONFIDENCIAL / EXCLUSIVO SSPE-CEIPOL", size: 18, bold: true, color: "B91C1C" })
      ],
      spacing: { before: 100, after: 200 }
    })
  );

  // Caja de Síntesis Ejecutiva en Portada
  elements.push(
    new Paragraph({
      children: [new TextRun({ text: "SÍNTESIS DEL DICTAMEN TÉCNICO", bold: true, size: 20, color: "0D2B52", font: "Calibri" })],
      spacing: { after: 100 }
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
              borders: {
                left: { color: "0D2B52", space: 1, style: BorderStyle.SINGLE, size: 24 },
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
              },
              margins: { left: 180, right: 180, top: 120, bottom: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: payload.executiveSummary, size: 18, font: "Calibri" })], alignment: AlignmentType.JUSTIFIED })]
            })
          ]
        })
      ]
    })
  );

  // ================= PÁGINA 2: BLOQUE I.1 - CONTEXTO TERRITORIAL =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("BLOQUE I: ANÁLISIS EJECUTIVO - CONTEXTO TERRITORIAL"));
  elements.push(createBodyText(payload.contextoTerritorial));

  // ================= PÁGINA 3: BLOQUE I.2 - HIPÓTESIS PRINCIPAL =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("BLOQUE I: ANÁLISIS EJECUTIVO - HIPÓTESIS PRINCIPAL"));
  elements.push(createSubtitle("Estructuración Metodológica de la Hipótesis delictiva:"));
  
  elements.push(createBullet("¿Qué ocurre?: ", payload.hipotesisPrincipal.queOcurre));
  elements.push(createBullet("¿Dónde ocurre?: ", payload.hipotesisPrincipal.dondeOcurre));
  elements.push(createBullet("¿Quién podría participar?: ", payload.hipotesisPrincipal.quienParticipa));
  elements.push(createBullet("¿Por qué ocurre?: ", payload.hipotesisPrincipal.porQueOcurre));
  elements.push(createBullet("¿Qué evidencia sustenta?: ", payload.hipotesisPrincipal.evidenciaSustento));
  elements.push(createBullet("Nivel de confianza analítica: ", payload.hipotesisPrincipal.nivelConfianza, "B91C1C"));

  // ================= PÁGINA 4: BLOQUE I.3 - VALORACIÓN OPERACIONAL =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("BLOQUE I: ANÁLISIS EJECUTIVO - VALORACIÓN OPERACIONAL"));
  elements.push(createSubtitle("Evaluación de Amenazas, Oportunidades y Vulnerabilidades del Sector:"));
  
  elements.push(createBullet("Amenaza: ", payload.valoracionOperacional.amenaza));
  elements.push(createBullet("Oportunidad criminal: ", payload.valoracionOperacional.oportunidadCriminal));
  elements.push(createBullet("Vulnerabilidades urbanas: ", payload.valoracionOperacional.vulnerabilidades));
  elements.push(createBullet("Capacidad institucional requerida: ", payload.valoracionOperacional.capacidadRequerida));

  // ================= PÁGINA 5: BLOQUE II - MATRIZ DE TRAZABILIDAD =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("BLOQUE II: MATRIZ DE TRAZABILIDAD ANALÍTICA"));
  elements.push(createSubtitle("Gobernanza Algorítmica y Explicabilidad de Fuentes:"));

  const matrixRows = [
    new TableRow({
      children: [
        new TableCell({ shading: { fill: "0D2B52", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Componente", bold: true, color: "FFFFFF", size: 16 })] })] }),
        new TableCell({ shading: { fill: "0D2B52", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Fuente", bold: true, color: "FFFFFF", size: 16 })] })] }),
        new TableCell({ shading: { fill: "0D2B52", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Método", bold: true, color: "FFFFFF", size: 16 })] })] }),
        new TableCell({ shading: { fill: "0D2B52", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Hallazgo", bold: true, color: "FFFFFF", size: 16 })] })] }),
        new TableCell({ shading: { fill: "0D2B52", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Impacto Operativo", bold: true, color: "FFFFFF", size: 16 })] })] }),
      ]
    })
  ];

  payload.trazabilidadMatrix.forEach((r, idx) => {
    matrixRows.push(
      new TableRow({
        children: [
          new TableCell({ shading: { fill: idx % 2 === 0 ? "F8FAFC" : "FFFFFF", type: ShadingType.CLEAR }, borders: metaBorders, children: [new Paragraph({ children: [new TextRun({ text: r.componente, size: 14 })] })] }),
          new TableCell({ shading: { fill: idx % 2 === 0 ? "F8FAFC" : "FFFFFF", type: ShadingType.CLEAR }, borders: metaBorders, children: [new Paragraph({ children: [new TextRun({ text: r.fuente, size: 14 })] })] }),
          new TableCell({ shading: { fill: idx % 2 === 0 ? "F8FAFC" : "FFFFFF", type: ShadingType.CLEAR }, borders: metaBorders, children: [new Paragraph({ children: [new TextRun({ text: r.metodo, size: 14 })] })] }),
          new TableCell({ shading: { fill: idx % 2 === 0 ? "F8FAFC" : "FFFFFF", type: ShadingType.CLEAR }, borders: metaBorders, children: [new Paragraph({ children: [new TextRun({ text: r.hallazgo, size: 14 })] })] }),
          new TableCell({ shading: { fill: idx % 2 === 0 ? "F8FAFC" : "FFFFFF", type: ShadingType.CLEAR }, borders: metaBorders, children: [new Paragraph({ children: [new TextRun({ text: r.impacto, size: 14 })] })] }),
        ]
      })
    );
  });

  elements.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: matrixRows, spacing: { after: 200 } }));

  // ================= PÁGINA 6: OSINT SINTETIZADO =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("ANÁLISIS DE INTELIGENCIA OSINT COMPLEMENTARIA"));
  elements.push(createSubtitle("Evaluación del Entorno Socioeconómico y Comercial:"));
  elements.push(createBodyText(payload.osintSynthesized));

  // ================= PÁGINA 7: MOTOR DE PANDILLAS =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("ANÁLISIS DE VINCULACIÓN TERRITORIAL (PANDILLAS)"));
  elements.push(createSubtitle("Contexto de Pandillas y Actores de Riesgo Locales:"));
  elements.push(createBodyText(payload.pandillasAnalysis));

  // ================= PÁGINA 8: BLOQUE IX - CONCLUSIONES OPERATIVAS =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("BLOQUE IX: CONCLUSIONES OPERATIVAS Y RECOMENDACIONES"));

  elements.push(createSubtitle("Hallazgos Críticos:"));
  payload.conclusiones.hallazgosCriticos.forEach(h => elements.push(createBullet("", h)));

  elements.push(createSubtitle("Riesgos Inmediatos:"));
  payload.conclusiones.riesgosInmediatos.forEach(r => elements.push(createBullet("", r)));

  elements.push(createSubtitle("Escenarios Futuros:"));
  payload.conclusiones.escenariosFuturos.forEach(e => elements.push(createBullet("", e)));

  elements.push(createSubtitle("Recomendaciones Tácticas:"));
  payload.conclusiones.recomendacionesTacticas.forEach(t => elements.push(createBullet("", t, "B91C1C")));

  elements.push(createSubtitle("Recomendaciones Estratégicas:"));
  payload.conclusiones.recomendacionesEstrategicas.forEach(s => elements.push(createBullet("", s, "1E3A8A")));

  // ================= PÁGINAS VISUALES INDEPENDIENTES (BLOQUE III: ATLAS CARTOGRÁFICO) =================
  if (payload.maps) {
    payload.maps.forEach((map, idx) => {
      elements.push(new Paragraph({ pageBreakBefore: true }));
      elements.push(createTitle(`BLOQUE III: ATLAS CARTOGRÁFICO - ${map.title.toUpperCase()}`));
      const buf = dataUrlToArrayBuffer(map.dataUrl);
      if (buf) {
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: buf, transformation: { width: 440, height: 260 } })],
            spacing: { after: 200 }
          })
        );
      }
      elements.push(createSubtitle("Interpretación Operacional del Mapa:"));
      elements.push(createBodyText(map.interpretation));
    });
  }

  // ================= BLOQUE V: MODELOS ANALÍTICOS (GRÁFICAS) =================
  if (payload.graphs) {
    payload.graphs.forEach((graph, idx) => {
      elements.push(new Paragraph({ pageBreakBefore: true }));
      elements.push(createTitle(`BLOQUE V: MODELO ANALÍTICO - ${graph.title.toUpperCase()}`));
      const buf = dataUrlToArrayBuffer(graph.dataUrl);
      if (buf) {
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: buf, transformation: { width: 420, height: 200 } })],
            spacing: { after: 120 }
          })
        );
      }
      elements.push(createSubtitle("Detalle Metodológico e Interpretación:"));
      elements.push(createBullet("Explicación técnica: ", graph.explanation));
      elements.push(createBullet("Hallazgo relevante: ", graph.finding));
      elements.push(createBullet("Relación con hipótesis: ", graph.relation));
    });
  }

  // ================= BLOQUE VII: EVIDENCIA FOTOGRÁFICA DE CAMPO =================
  if (payload.photoEvidence) {
    const buildPhotoTableElement = async (photo: any, index: number) => {
      try {
        const buffer = await applyWatermarkForWord(photo.dataUrl);
        if (!buffer) return null;

        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 8, color: "0D2B52" },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: "0D2B52" },
            left: { style: BorderStyle.SINGLE, size: 8, color: "0D2B52" },
            right: { style: BorderStyle.SINGLE, size: 8, color: "0D2B52" }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new ImageRun({ data: buffer, transformation: { width: 440, height: 250 } })]
                    }),
                    new Paragraph({
                      spacing: { before: 80 },
                      children: [new TextRun({ text: `Evidencia Fotográfica de Campo 0${index + 1}.`, bold: true, size: 18, color: "0D2B52" })]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Ubicación: ", bold: true, size: 16 }),
                        new TextRun({ text: photo.location, size: 16 })
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Factor ambiental identificado: ", bold: true, size: 16 }),
                        new TextRun({ text: photo.factor, size: 16 })
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Análisis IA Táctico: ", bold: true, size: 16 }),
                        new TextRun({ text: photo.caption, size: 16 })
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Interpretación criminológica: ", bold: true, size: 16 }),
                        new TextRun({ text: photo.criminologicalInterpretation, size: 16 })
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Relación con hipótesis: ", bold: true, size: 16 }),
                        new TextRun({ text: photo.relation, size: 16 })
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Nivel de riesgo: ", bold: true, size: 16 }),
                        new TextRun({ text: photo.riskLevel, bold: true, size: 16, color: photo.riskLevel === "ALTO" ? "B91C1C" : "1E3A8A" })
                      ]
                    })
                  ]
                })
              ]
            })
          ],
          spacing: { after: 120 }
        });
      } catch {
        return null;
      }
    };

    for (let i = 0; i < payload.photoEvidence.length; i++) {
      elements.push(new Paragraph({ pageBreakBefore: true }));
      elements.push(createTitle(`BLOQUE VII: EVIDENCIA FOTOGRÁFICA (EVIDENCIA 0${i + 1})`));
      const el = await buildPhotoTableElement(payload.photoEvidence[i], i);
      if (el) elements.push(el);
    }
  }

  // ================= BLOQUE IV: ANÁLISIS STREET VIEW =================
  if (payload.streetViewAnalysis) {
    for (let i = 0; i < payload.streetViewAnalysis.length; i++) {
      const sv = payload.streetViewAnalysis[i];
      const buf = dataUrlToArrayBuffer(sv.dataUrl);
      if (buf) {
        elements.push(new Paragraph({ pageBreakBefore: true }));
        elements.push(createTitle(`BLOQUE IV: EVALUACIÓN VISUAL DE ENTORNO (ACECHO 0${i + 1})`));
        elements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 8, color: "1F4E79" },
              bottom: { style: BorderStyle.SINGLE, size: 8, color: "1F4E79" },
              left: { style: BorderStyle.SINGLE, size: 8, color: "1F4E79" },
              right: { style: BorderStyle.SINGLE, size: 8, color: "1F4E79" }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new ImageRun({ data: buf, transformation: { width: 400, height: 200 } })]
                      }),
                      new Paragraph({
                        spacing: { before: 80 },
                        children: [new TextRun({ text: `Punto de Acecho 0${i + 1}: Inteligencia Visual Territorial`, bold: true, size: 18, color: "1F4E79" })]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Ubicación: ", bold: true, size: 16 }),
                          new TextRun({ text: sv.location, size: 16 })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Elementos observados: ", bold: true, size: 16 }),
                          new TextRun({ text: sv.observed, size: 16 })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Análisis criminológico: ", bold: true, size: 16 }),
                          new TextRun({ text: sv.criminologicalAnalysis, size: 16 })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Relación con hipótesis: ", bold: true, size: 16 }),
                          new TextRun({ text: sv.relation, size: 16 })
                        ]
                      })
                    ]
                  })
                ]
              })
            ],
            spacing: { after: 120 }
          })
        );
      }
    }
  }

  // ================= BLOQUE VI: BARRIDOS DE INTELIGENCIA =================
  if (payload.sweepsData && payload.sweepsData.length > 0) {
    elements.push(new Paragraph({ pageBreakBefore: true }));
    elements.push(createTitle("BLOQUE VI: BARRIDOS DE INTELIGENCIA DE FUENTES"));
    
    payload.sweepsData.forEach((s: any) => {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: `Barrido: ${s.engine.toUpperCase()}`, bold: true, size: 18, color: "0D2B52" })],
          spacing: { before: 120, after: 60 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Fuente consultada: ", bold: true, size: 16 }),
            new TextRun({ text: s.source, size: 16 })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Datos integrados: ", bold: true, size: 16 }),
            new TextRun({ text: s.data, size: 16 })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Contexto de movilidad: ", bold: true, size: 16 }),
            new TextRun({ text: s.context, size: 16 })
          ],
          spacing: { after: 180 }
        })
      );
    });
  }

  // ================= BLOQUE VIII: HYPOTHESIS INTELLIGENCE GRAPH HIG 2.0 =================
  if (payload.hypothesisGraph) {
    elements.push(new Paragraph({ pageBreakBefore: true }));
    elements.push(createTitle("BLOQUE VIII: HYPOTHESIS INTELLIGENCE GRAPH (HIG 2.0)"));
    const buf = dataUrlToArrayBuffer(payload.hypothesisGraph.dataUrl);
    if (buf) {
      elements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: buf, transformation: { width: 440, height: 260 } })],
          spacing: { after: 200 }
        })
      );
    }
    elements.push(createSubtitle("Lectura Operacional del Grafo HIG 2.0:"));
    elements.push(createBodyText(payload.hypothesisGraph.interpretation));
  }

  // 6. ENSAMBLAJE DEL DOCUMENTO WORD CON DOCX
  const headerFooterTabs = [
    { type: TabStopType.RIGHT, position: 9350 }
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20, color: "222222" },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 240, after: 120 }, widowControl: true },
        },
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 1417, bottom: 1134, left: 1417, right: 1134 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: headerFooterTabs,
                children: [
                  new TextRun({ text: "CEIPOL - SSPE", bold: true, color: "5B6573", size: 16, font: "Calibri" }),
                  new TextRun({ text: "\tDICTAMEN TÉCNICO DE INTELIGENCIA TERRITORIAL", color: "5B6573", size: 16, font: "Calibri" }),
                  new TextRun({ text: "\tCONFIDENCIAL | EXCLUSIVO", bold: true, color: "5B6573", size: 16, font: "Calibri" }),
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
                  new TextRun({ text: `${payload.date} | `, color: "5B6573", size: 14, font: "Calibri" }),
                  new TextRun({ 
                    children: ["Página ", PageNumber.CURRENT || "1"],
                    color: "5B6573", 
                    size: 14,
                    font: "Calibri" 
                  }),
                  new TextRun({ text: ` | EXP: ${safeName.slice(0, 40)}`, color: "5B6573", size: 14, font: "Calibri" }),
                ],
              }),
            ],
          }),
        },
        children: elements,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Dictamen_Inteligencia_Territorial_${safeName}.docx`);
}
