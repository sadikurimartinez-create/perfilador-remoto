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
    children: [new TextRun({ text, size: 28, bold: true, color: "0D2B52", font: "Calibri" })],
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "0D2B52" } }
  });

  const createSubtitle = (text: string) => new Paragraph({
    children: [new TextRun({ text, size: 20, bold: true, color: "1F4E79", font: "Calibri" })],
    spacing: { before: 120, after: 60 }
  });

  const createBodyText = (text: string) => new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri", color: "222222" })],
    spacing: { after: 120 },
    alignment: AlignmentType.JUSTIFIED
  });

  const elements: any[] = [];

  // ================= PÁGINA 1: PORTADA & SÍNTESIS EJECUTIVA =================
  if (logoChildren.length > 0) {
    elements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: logoChildren,
        spacing: { before: 200, after: 400 }
      })
    );
  }

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "INFORME DE GEOINTELIGENCIA OPERATIVA", size: 32, color: "0D2B52", bold: true, font: "Calibri" })],
      spacing: { after: 60 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "SECRETARÍA DE SEGURIDAD PÚBLICA - CEIPOL", size: 20, color: "5B6573", bold: true, font: "Calibri" })],
      spacing: { after: 400 }
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
            children: [new Paragraph({ children: [new TextRun({ text: "EXPEDIENTE:", bold: true, size: 18 }), new TextRun({ text: ` ${projectName.toUpperCase()}`, size: 18 })] })]
          }),
          new TableCell({
            borders: metaBorders, width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "FECHA:", bold: true, size: 18 }), new TextRun({ text: ` ${new Date().toLocaleDateString("es-MX")}`, size: 18 })] })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: metaBorders, width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "ANALISTA:", bold: true, size: 18 }), new TextRun({ text: ` ${user?.username || "Institucional"}`, size: 18 })] })]
          }),
          new TableCell({
            borders: metaBorders, width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: "F5F7FA", type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: "CLASIFICACIÓN:", bold: true, size: 18, color: "B22222" }), new TextRun({ text: " CONFIDENCIAL / EXCLUSIVO", size: 18, color: "B22222" })] })]
          })
        ]
      })
    ],
    spacing: { after: 400 }
  });

  elements.push(metadataTable);

  // Caja de Síntesis Ejecutiva
  elements.push(
    new Paragraph({
      children: [new TextRun({ text: "SÍNTESIS EJECUTIVA DEL DICTAMEN", bold: true, size: 22, color: "0D2B52", font: "Calibri" })],
      spacing: { after: 120 }
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
              children: [new Paragraph({ children: [new TextRun({ text: payload.executiveSummary, size: 22, font: "Calibri" })], alignment: AlignmentType.JUSTIFIED })]
            })
          ]
        })
      ]
    })
  );

  // ================= PÁGINA 2: HIPÓTESIS FINAL ÚNICA =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("1. HIPÓTESIS FINAL ÚNICA"));
  elements.push(createBodyText(payload.finalHypothesis));

  // ================= PÁGINA 3: MAPA 1 =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  if (payload.maps?.[0]) {
    const map = payload.maps[0];
    elements.push(createTitle(`2. CARTOGRAFÍA OPERATIVA - ${map.title.toUpperCase()}`));
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
    elements.push(createSubtitle("Interpretación Operacional:"));
    elements.push(createBodyText(map.interpretation));
  }

  // ================= PÁGINA 4: MAPA 2 =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  if (payload.maps?.[1]) {
    const map = payload.maps[1];
    elements.push(createTitle(`2. CARTOGRAFÍA OPERATIVA - ${map.title.toUpperCase()}`));
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
    elements.push(createSubtitle("Interpretación Operacional:"));
    elements.push(createBodyText(map.interpretation));
  }

  // ================= PÁGINA 5: GRÁFICAS ANALÍTICAS =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("3. ANÁLISIS DE SCORING Y MODELADOS"));
  
  if (payload.graphs) {
    for (let i = 0; i < Math.min(payload.graphs.length, 2); i++) {
      const graph = payload.graphs[i];
      const buf = dataUrlToArrayBuffer(graph.dataUrl);
      if (buf) {
        elements.push(
          new Paragraph({
            children: [new TextRun({ text: graph.title.toUpperCase(), bold: true, size: 18, color: "1F4E79" })],
            spacing: { before: 120, after: 60 }
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: buf, transformation: { width: 400, height: 180 } })],
            spacing: { after: 120 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Explicación: ", bold: true, size: 16 }),
              new TextRun({ text: graph.explanation, size: 16 })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Hallazgo: ", bold: true, size: 16 }),
              new TextRun({ text: graph.finding, size: 16 })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Relación con hipótesis: ", bold: true, size: 16 }),
              new TextRun({ text: graph.relation, size: 16 })
            ],
            spacing: { after: 240 }
          })
        );
      }
    }
  }

  // ================= PÁGINA 6: ANEXO FOTOGRÁFICO DE CAMPO - PARTE 1 =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("4. REGISTRO FOTOGRÁFICO DE CAMPO - PARTE 1"));

  const buildPhotoElement = async (photo: any, index: number) => {
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
                    children: [new TextRun({ text: `Imagen ${index + 1}.`, bold: true, size: 18, color: "0D2B52" })]
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

  if (payload.photoEvidence?.[0]) {
    const el = await buildPhotoElement(payload.photoEvidence[0], 0);
    if (el) elements.push(el);
  }
  if (payload.photoEvidence?.[1]) {
    const el = await buildPhotoElement(payload.photoEvidence[1], 1);
    if (el) elements.push(el);
  }

  // ================= PÁGINA 7: ANEXO FOTOGRÁFICO DE CAMPO - PARTE 2 =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("4. REGISTRO FOTOGRÁFICO DE CAMPO - PARTE 2"));

  if (payload.photoEvidence?.[2]) {
    const el = await buildPhotoElement(payload.photoEvidence[2], 2);
    if (el) elements.push(el);
  }
  if (payload.photoEvidence?.[3]) {
    const el = await buildPhotoElement(payload.photoEvidence[3], 3);
    if (el) elements.push(el);
  }

  // ================= PÁGINA 8: STREET VIEW =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("5. PUNTOS DE ACECHO Y VULNERABILIDAD FÍSICA"));

  if (payload.streetViewAnalysis) {
    for (let i = 0; i < Math.min(payload.streetViewAnalysis.length, 2); i++) {
      const sv = payload.streetViewAnalysis[i];
      const buf = dataUrlToArrayBuffer(sv.dataUrl);
      if (buf) {
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

  // ================= PÁGINA 9: OSINT SINTETIZADO =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("6. ANÁLISIS DE INTELIGENCIA OSINT COMPLEMENTARIA"));
  elements.push(createSubtitle("Evaluación del Entorno Socioeconómico y Flujos de Movilidad:"));
  elements.push(createBodyText(payload.osintSynthesized));

  // ================= PÁGINA 10: MOTOR DE PANDILLAS =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("7. ANÁLISIS DE VINCULACIÓN TERRITORIAL (PANDILLAS)"));
  elements.push(createSubtitle("Contexto de Pandillas y Actores de Riesgo Locales:"));
  elements.push(createBodyText(payload.pandillasAnalysis));

  // ================= PÁGINA 11: GRAFO DE HIPÓTESIS HIG 2.0 =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("8. HYPOTHESIS INTELLIGENCE GRAPH (HIG 2.0)"));

  if (payload.hypothesisGraph) {
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

  // ================= PÁGINA 12: CONCLUSIONES OPERATIVAS =================
  elements.push(new Paragraph({ pageBreakBefore: true }));
  elements.push(createTitle("9. CONCLUSIONES OPERATIVAS Y RECOMENDACIONES"));

  payload.operationalConclusions.forEach(c => {
    elements.push(
      new Paragraph({
        numbering: { reference: "custom-bullets", level: 0 },
        children: [
          new TextRun({ text: `[Prioridad ${c.prioridad}] `, bold: true, color: c.prioridad === "Alta" ? "B91C1C" : "1E3A8A" }),
          new TextRun({ text: `Hallazgo: `, bold: true }),
          new TextRun({ text: `${c.hallazgo}. ` }),
          new TextRun({ text: `Riesgo asociado: `, bold: true }),
          new TextRun({ text: `${c.riesgo}. ` }),
          new TextRun({ text: `Acción recomendada: `, bold: true }),
          new TextRun({ text: `${c.accion}.` })
        ],
        spacing: { after: 120 }
      })
    );
  });

  // 6. ENSAMBLAJE DEL DOCUMENTO WORD CON DOCX
  const headerFooterTabs = [
    { type: TabStopType.RIGHT, position: 9350 }
  ];

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
            }
          ]
        }
      ]
    },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: "222222" },
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
                  new TextRun({ text: "CEIPOL", bold: true, color: "5B6573", size: 18, font: "Calibri" }),
                  new TextRun({ text: "\tINFORME DE GEOINTELIGENCIA OPERATIVA", color: "5B6573", size: 18, font: "Calibri" }),
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
  saveAs(blob, `Informe_Geointeligencia_${safeName}.docx`);
}
