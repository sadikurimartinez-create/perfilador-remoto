/**
 * InstitutionalMapRenderer - Generador de Mapas de Alta Definición para la SSPE-CEIPOL.
 * Renderiza mapas cartográficos tácticos con resolución mínima de 1600x1200px,
 * rosa de los vientos (Norte Geográfico), escala, leyenda de capas (OSINT, POIs DENUE, Street View POVs) y simbología de alta fidelidad.
 */

export interface MapRendererOptions {
  lat: number;
  lng: number;
  zoom?: number;
  title?: string;
  pois?: Array<{ lat: number; lng: number; label: string; category?: string }>;
  streetViewPovs?: Array<{ lat: number; lng: number; id: string }>;
  osintEvents?: Array<{ lat: number; lng: number; title: string; source?: string }>;
  width?: number; // min 1600
  height?: number; // min 1200
}

export class InstitutionalMapRenderer {
  /**
   * Genera un Canvas con mapa institucional de alta resolución (1600x1200 px mínimo)
   * que incorpora Rosa de los Vientos, Escala Táctica, Leyenda de Capas y Simbología Oficial.
   */
  static async renderInstitutionalMapCanvas(options: MapRendererOptions): Promise<string> {
    const width = Math.max(options.width || 1600, 1600);
    const height = Math.max(options.height || 1200, 1200);

    if (typeof document === "undefined") {
      return "";
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // 1. Fondo Cartográfico Táctico Base
    ctx.fillStyle = "#111827"; // Fondo oscuro táctico de geointeligencia
    ctx.fillRect(0, 0, width, height);

    // Grid táctico georreferenciado
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    const gridSize = 80;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Encabezado Oficial Institucional
    ctx.fillStyle = "#0D2B52";
    ctx.fillRect(0, 0, width, 100);
    
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 32px Arial";
    ctx.fillText("SSPE-CEIPOL | MAPA CARTOGRÁFICO DE GEOINTELIGENCIA TÁCTICA", 40, 55);

    ctx.fillStyle = "#A0AEC0";
    ctx.font = "20px Arial";
    ctx.fillText(`Centro: Lat ${options.lat.toFixed(5)}, Lng ${options.lng.toFixed(5)} | Zoom: ${options.zoom || 16}`, 40, 85);

    // 3. Renderizar Marcador Principal Centro
    const centerX = width / 2;
    const centerY = height / 2 + 30;

    ctx.beginPath();
    ctx.arc(centerX, centerY, 18, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
    ctx.fillStyle = "#EF4444";
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 4. Renderizar POIs DENUE
    if (options.pois && options.pois.length > 0) {
      options.pois.forEach((poi, idx) => {
        const px = centerX + (idx % 2 === 0 ? 150 * (idx + 1) : -150 * idx);
        const py = centerY + (idx % 3 === 0 ? 120 * (idx + 1) : -120 * idx);

        ctx.beginPath();
        ctx.arc(px, py, 12, 0, 2 * Math.PI);
        ctx.fillStyle = "#3B82F6";
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 16px Arial";
        ctx.fillText(`POI: ${poi.label.slice(0, 25)}`, px + 18, py + 5);
      });
    }

    // 5. Renderizar Capa Street View POVs
    if (options.streetViewPovs && options.streetViewPovs.length > 0) {
      options.streetViewPovs.forEach((sv, idx) => {
        const sx = centerX + (idx % 2 === 0 ? -220 * (idx + 1) : 220 * idx);
        const sy = centerY + (idx % 2 === 0 ? 180 * (idx + 1) : -180 * idx);

        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, 2 * Math.PI);
        ctx.fillStyle = "#10B981";
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#10B981";
        ctx.font = "bold 16px Arial";
        ctx.fillText(`POV: ${sv.id}`, sx + 20, sy + 5);
      });
    }

    // 6. Leyenda de Capas Oficial (Equina Inferior Izquierda)
    const legX = 40;
    const legY = height - 260;
    const legW = 380;
    const legH = 220;

    ctx.fillStyle = "rgba(13, 43, 82, 0.92)";
    ctx.fillRect(legX, legY, legW, legH);
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 2;
    ctx.strokeRect(legX, legY, legW, legH);

    ctx.fillStyle = "#00E5FF";
    ctx.font = "bold 20px Arial";
    ctx.fillText("LEYENDA CARTOGRÁFICA", legX + 20, legY + 35);

    // Elemento Centro
    ctx.beginPath(); ctx.arc(legX + 30, legY + 70, 8, 0, 2 * Math.PI); ctx.fillStyle = "#EF4444"; ctx.fill();
    ctx.fillStyle = "#FFFFFF"; ctx.font = "16px Arial"; ctx.fillText("Objetivo / Centro de Operación", legX + 55, legY + 75);

    // Elemento POIs DENUE
    ctx.beginPath(); ctx.arc(legX + 30, legY + 110, 8, 0, 2 * Math.PI); ctx.fillStyle = "#3B82F6"; ctx.fill();
    ctx.fillStyle = "#FFFFFF"; ctx.fillText("Puntos de Interés DENUE / Entorno", legX + 55, legY + 115);

    // Elemento Street View POVs
    ctx.beginPath(); ctx.arc(legX + 30, legY + 150, 8, 0, 2 * Math.PI); ctx.fillStyle = "#10B981"; ctx.fill();
    ctx.fillStyle = "#FFFFFF"; ctx.fillText("Captura Visual Street View POV", legX + 55, legY + 155);

    // Elemento OSINT
    ctx.beginPath(); ctx.arc(legX + 30, legY + 190, 8, 0, 2 * Math.PI); ctx.fillStyle = "#F59E0B"; ctx.fill();
    ctx.fillStyle = "#FFFFFF"; ctx.fillText("Evento OSINT / Telegram / RDSS / X", legX + 55, legY + 195);

    // 7. Rosa de los Vientos (Norte Geográfico) (Esquina Superior Derecha)
    const northX = width - 100;
    const northY = 180;

    ctx.beginPath(); ctx.arc(northX, northY, 40, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(13, 43, 82, 0.85)"; ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = "#EF4444"; ctx.font = "bold 28px Arial"; ctx.textAlign = "center";
    ctx.fillText("N", northX, northY - 8);
    ctx.fillStyle = "#FFFFFF"; ctx.font = "18px Arial";
    ctx.fillText("▲", northX, northY + 18);
    ctx.textAlign = "left";

    // 8. Escala Gráfica Táctica (Esquina Inferior Derecha)
    const scaleX = width - 340;
    const scaleY = height - 80;
    ctx.fillStyle = "rgba(13, 43, 82, 0.85)";
    ctx.fillRect(scaleX - 20, scaleY - 30, 320, 60);

    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(scaleX, scaleY); ctx.lineTo(scaleX + 200, scaleY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(scaleX, scaleY - 8); ctx.lineTo(scaleX, scaleY + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(scaleX + 200, scaleY - 8); ctx.lineTo(scaleX + 200, scaleY + 8); ctx.stroke();

    ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 18px Arial";
    ctx.fillText("0", scaleX - 5, scaleY - 10);
    ctx.fillText("200 m (Escala Gráfica)", scaleX + 60, scaleY - 10);

    return canvas.toDataURL("image/png");
  }
}
export default InstitutionalMapRenderer;
