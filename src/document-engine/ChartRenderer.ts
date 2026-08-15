import { ImageManager, ImageDimensions } from "./ImageManager";

export class ChartRenderer {
  static async renderSvgToPng(svgElement: SVGElement, scale = 2): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = svgElement.clientWidth * scale;
          canvas.height = svgElement.clientHeight * scale;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL("image/png");
            resolve(dataUrl);
          } else {
            reject(new Error("No se pudo obtener el contexto 2D del Canvas."));
          }
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          reject(new Error("Error al cargar la imagen SVG."));
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  }
}
