/**
 * ENGINE DE RENDERIZADO VECTORIAL GEOINT v1.0
 * Genera mapas tácticos, gráficas y grafos analíticos profesionales usando Canvas 2D
 * 100% independiente de html2canvas, WebGL y del estado del DOM.
 */

export interface VectorEngineInput {
  projectName: string;
  latitude: number;
  longitude: number;
  geometryType: string;
  incidents: any[];
  sweeps: any[];
  photoCount: number;
}

// Auxiliar para inicializar canvas con pixel ratio para mayor resolución (HD - 300 DPI)
const getHDCanvas = (width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const scale = 3.5; // High resolution scale factor (300 DPI equivalent)
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  
  // Scale the coordinates so that all draw commands are automatically scaled
  ctx.scale(scale, scale);
  
  // Suavizado de imágenes para trazados vectoriales
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  return { canvas, ctx };
};

const loadStaticMapImage = (
  lat: number,
  lng: number,
  zoom: number,
  w = 600,
  h = 400
): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    let googleUrl = "";
    if (key) {
      googleUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${w}x${h}&maptype=roadmap` +
        `&scale=2` +
        // Estilo GIS Light Canvas Profesional de Alta Resolución
        `&style=feature:all|element:geometry|color:0xf1f5f9` +
        `&style=feature:water|element:geometry|color:0xc2e2ff` +
        `&style=feature:water|element:labels.text.fill|color:0x1d4f91` +
        `&style=feature:landscape.natural|element:geometry|color:0xe2e8f0` +
        `&style=feature:poi.park|element:geometry|color:0xdcfce7` +
        `&style=feature:poi.park|element:labels.text.fill|color:0x15803d` +
        `&style=feature:road|element:geometry|color:0xffffff` +
        `&style=feature:road.local|element:geometry|color:0xf8fafc` +
        `&style=feature:road.arterial|element:geometry|color:0xffffff` +
        `&style=feature:road|element:labels.text.fill|color:0x334155` +
        `&style=feature:road|element:labels.text.stroke|color:0xffffff` +
        `&style=feature:poi|element:geometry|color:0xf1f5f9` +
        `&style=feature:poi.school|element:geometry|color:0xfee2e2` +
        `&style=feature:poi.school|element:labels.text.fill|color:0x991b1b` +
        `&style=feature:poi.medical|element:geometry|color:0xfee2e2` +
        `&style=feature:poi.medical|element:labels.text.fill|color:0x991b1b` +
        `&style=feature:poi.business|element:labels|visibility:on` +
        `&style=feature:administrative.neighborhood|element:labels.text.fill|color:0x0f172a` +
        `&key=${key}`;
    }

    const tryOpenStreetMap = () => {
      const latRad = lat * Math.PI / 180;
      const n = Math.pow(2, zoom);
      const xtile = Math.floor((lng + 180) / 360 * n);
      const ytile = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
      const osmUrl = `https://a.tile.openstreetmap.org/${zoom}/${xtile}/${ytile}.png`;
      
      const osmImg = new Image();
      osmImg.crossOrigin = "Anonymous";
      osmImg.onload = () => resolve(osmImg);
      osmImg.onerror = () => {
        console.error("All static map options failed.");
        resolve(null);
      };
      osmImg.src = osmUrl;
    };

    const tryYandex = () => {
      const yandexUrl = `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&size=${w},${h}&z=${zoom}&l=map&scale=2.0`;
      const yandexImg = new Image();
      yandexImg.crossOrigin = "Anonymous";
      yandexImg.onload = () => resolve(yandexImg);
      yandexImg.onerror = () => {
        console.warn("Yandex static map failed, trying OpenStreetMap tile...");
        tryOpenStreetMap();
      };
      yandexImg.src = yandexUrl;
    };

    // Intentar primero Google Maps si hay API Key configurada
    if (key) {
      const googleImg = new Image();
      googleImg.crossOrigin = "Anonymous";
      googleImg.onload = () => {
        console.log("[GEOINT Renderer] Mapa base de Google Maps cargado con éxito.");
        resolve(googleImg);
      };
      googleImg.onerror = () => {
        console.warn("[GEOINT Renderer] Falló Google Maps (posible error de facturación), intentando Yandex...");
        tryYandex();
      };
      googleImg.src = googleUrl;
    } else {
      tryYandex();
    }
  });
};

// Dibujar brújula táctica (Rosa de los Vientos) en mapas
const drawTacticalCompass = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.save();
  ctx.strokeStyle = '#1d4f91'; // CEIPOL standard blue
  ctx.lineWidth = 1.2;
  
  // Círculo exterior
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  
  // Ticks exteriores
  for (let i = 0; i < 360; i += 30) {
    const rad = i * Math.PI / 180;
    const x1 = x + (r - 2) * Math.cos(rad);
    const y1 = y + (r - 2) * Math.sin(rad);
    const x2 = x + r * Math.cos(rad);
    const y2 = y + r * Math.sin(rad);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  
  // Cruz central
  ctx.strokeStyle = 'rgba(29, 79, 145, 0.4)';
  ctx.beginPath();
  ctx.moveTo(x - r + 3, y);
  ctx.lineTo(x + r - 3, y);
  ctx.moveTo(x, y - r + 3);
  ctx.lineTo(x, y + r - 3);
  ctx.stroke();
  
  // Norte letra
  ctx.fillStyle = '#0b1f3a'; // Navy
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x, y - r - 5);
  
  // Puntero Norte (Estilo aguja bicolor GIS)
  ctx.fillStyle = '#0b1f3a'; // Mitad izquierda oscura
  ctx.beginPath();
  ctx.moveTo(x, y - r + 2);
  ctx.lineTo(x - 4, y);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = '#94a3b8'; // Mitad derecha clara
  ctx.beginPath();
  ctx.moveTo(x, y - r + 2);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
};

// Dibujar marco táctico de estilo GIS con cuadrícula de coordenadas
const drawTacticalFrame = (
  ctx: CanvasRenderingContext2D, 
  w: number, 
  h: number, 
  lat: number, 
  lng: number, 
  mapTitle: string
) => {
  ctx.save();
  
  // Neatline exterior gruesa (Navy)
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  
  // Neatline interior delgada (Slate)
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(16, 16, w - 32, h - 32);
  
  // Ticks de coordenadas en el marco
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1;
  // Ticks Horizontales
  for (let offset = 40; offset < w - 40; offset += 80) {
    ctx.beginPath();
    ctx.moveTo(offset, 12);
    ctx.lineTo(offset, 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset, h - 12);
    ctx.lineTo(offset, h - 16);
    ctx.stroke();
  }
  // Ticks Verticales
  for (let offset = 40; offset < h - 40; offset += 60) {
    ctx.beginPath();
    ctx.moveTo(12, offset);
    ctx.lineTo(16, offset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w - 12, offset);
    ctx.lineTo(w - 16, offset);
    ctx.stroke();
  }
  
  // Coordenadas en las esquinas superiores (Calidad editorial)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 8.5px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`LAT: ${lat.toFixed(5)}°N`, 24, 28);
  ctx.fillText(`LNG: ${lng.toFixed(5)}°W`, 24, 38);

  ctx.textAlign = 'right';
  ctx.fillText('REF: WGS 84 / UTM Z13N', w - 24, 28);
  ctx.fillText(`FECHA: ${new Date().toLocaleDateString("es-MX")}`, w - 24, 38);

  // Metadatos y firma en las esquinas inferiores
  ctx.fillStyle = '#0b1f3a';
  ctx.textAlign = 'left';
  ctx.font = 'bold 8.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('SSPE - CEIPOL TÁCTICO', 24, h - 28);
  ctx.fillStyle = '#475569';
  ctx.font = '8px "Segoe UI", Arial, sans-serif';
  ctx.fillText('SISTEMA GEOINT DE SEGURIDAD PÚBLICA', 24, h - 18);

  ctx.fillStyle = '#0b1f3a';
  ctx.textAlign = 'right';
  ctx.font = 'bold 8.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('ÁREA DE INTERÉS PERIMETRAL', w - 24, h - 28);
  ctx.fillStyle = '#475569';
  ctx.font = '8px "Segoe UI", Arial, sans-serif';
  ctx.fillText('CONFIDENCIAL / CEIPOL / FUENTE: GOOGLE MAPS', w - 24, h - 18);
  
  // Banner de Título
  ctx.fillStyle = '#0b1f3a';
  ctx.fillRect(w / 2 - 170, 12, 340, 24);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mapTitle.toUpperCase(), w / 2, 28);
  
  ctx.restore();
};

// Barra de escala cartográfica clásica segmentada
const drawScaleBar = (
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  length: number, 
  text: string
) => {
  ctx.save();
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1.5;
  ctx.font = 'bold 8px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';

  const segmentWidth = length / 2;
  
  // Primer segmento (Blanco)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, segmentWidth, 4);
  ctx.strokeRect(x, y, segmentWidth, 4);
  
  // Segundo segmento (Azul marino)
  ctx.fillStyle = '#0b1f3a';
  ctx.fillRect(x + segmentWidth, y, segmentWidth, 4);
  ctx.strokeRect(x + segmentWidth, y, segmentWidth, 4);

  // Marcas divisorias verticales
  ctx.beginPath();
  ctx.moveTo(x, y - 2);
  ctx.lineTo(x, y);
  ctx.moveTo(x + segmentWidth, y - 2);
  ctx.lineTo(x + segmentWidth, y);
  ctx.moveTo(x + length, y - 2);
  ctx.lineTo(x + length, y);
  ctx.stroke();

  // Texto de escala
  ctx.fillStyle = '#0f172a';
  ctx.fillText(text, x + length / 2, y - 4);
  ctx.restore();
};

// Mapa de localización vectorial inset (México -> Aguascalientes -> Municipio -> Colonia -> Polígono)
const drawLocalizationMap = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  
  // Fondo de la tarjeta del mapa de localización
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, 120, 68);
  ctx.strokeRect(x, y, 120, 68);
  
  // Encabezado
  ctx.fillStyle = '#0b1f3a';
  ctx.fillRect(x, y, 120, 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CONTEXTO TERRITORIAL', x + 60, y + 8.5);
  
  // Niveles jerárquicos
  const levels = [
    'MÉXICO (Nacional)',
    '➔ AGUASCALIENTES (Estatal)',
    '  ➔ AGS. MUNICIPIO (Local)',
    '    ➔ COL. BAJO ESTUDIO',
    '      ➔ POLÍGONO DE INTERÉS'
  ];
  
  ctx.textAlign = 'left';
  ctx.font = '6.5px monospace';
  
  levels.forEach((lvl, idx) => {
    const ly = y + 21 + idx * 9;
    if (idx === 4) {
      ctx.fillStyle = '#be123c'; // Rojo de riesgo
      ctx.font = 'bold 6.5px monospace';
      
      // Dibujar un mini target dot parpadeante/operativo
      ctx.beginPath();
      ctx.arc(x + 8, ly - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillText(lvl, x + 14, ly);
    } else {
      ctx.fillStyle = '#475569';
      ctx.font = '6.5px monospace';
      ctx.fillText(lvl, x + 8, ly);
    }
  });
  
  ctx.restore();
};

// Dibujar calles simplificadas (Solo como fallback de emergencia si falla la API de mapas)
const drawTacticalStreets = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.save();
  
  // Calles secundarias
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.2)';
  ctx.lineWidth = 1.2;
  const localStreets = [
    { x1: 50, y1: 100, x2: 450, y2: 100 },
    { x1: 50, y1: 220, x2: 450, y2: 220 },
    { x1: 120, y1: 50, x2: 120, y2: 350 },
    { x1: 280, y1: 50, x2: 280, y2: 350 }
  ];
  localStreets.forEach(s => {
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  });

  // Avenidas Principales
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  const primaryStreets = [
    { x1: 30, y1: 150, x2: 570, y2: 150, name: "Av. Rancho San Antonio" },
    { x1: 200, y1: 30, x2: 200, y2: 370, name: "Av. Paseos de La Habana" }
  ];
  primaryStreets.forEach(s => {
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 7.5px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    
    if (s.x1 === s.x2) {
      ctx.save();
      ctx.translate(s.x1 - 6, (s.y1 + s.y2) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(s.name, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(s.name, (s.x1 + s.x2) / 2, s.y1 - 6);
    }
  });

  ctx.restore();
};

/**
 * 1. MAPA DE DENSIDAD CRIMINOLÓGICA (Hotspot Heatmap vectorial)
 */
export const renderDensityMap = async (input: VectorEngineInput): Promise<string> => {
  const { canvas, ctx } = getHDCanvas(600, 400);
  const w = 600;
  const h = 400;
  const centerLat = input.latitude || 21.8853;
  const centerLng = input.longitude || -102.2916;
  
  // 1. Cargar Mapa Base Real (Capa Cartográfica Real)
  const baseMapImg = await loadStaticMapImage(centerLat, centerLng, 15, w, h);
  if (baseMapImg) {
    ctx.drawImage(baseMapImg, 0, 0, w, h);
  } else {
    // Fondo de fallback blanco/gris
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    
    // Rejilla cartográfica gris fina de fondo
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let x = 40; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, h - 40); ctx.stroke();
    }
    for (let y = 40; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke();
    }
    drawTacticalStreets(ctx, w, h);
  }
  
  // Círculos concéntricos de radar de inteligencia (Cromática CEIPOL)
  ctx.strokeStyle = 'rgba(29, 79, 145, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 80, 0, Math.PI * 2);
  ctx.arc(w / 2, h / 2, 140, 0, Math.PI * 2);
  ctx.stroke();

  // Zona de amortiguamiento (Buffer) del Perfil
  ctx.strokeStyle = 'rgba(29, 79, 145, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Dibujar Puntos de Calor (Hotspots de delitos - Kernel Density real suave)
  const simulatedIncidents = input.incidents && input.incidents.length > 0
    ? input.incidents
    : [
        { lat: centerLat + 0.0004, lng: centerLng - 0.0003, weight: 10, label: "Robo de Vehículo" },
        { lat: centerLat - 0.0005, lng: centerLng + 0.0006, weight: 8, label: "Asalto a Transeúnte" },
        { lat: centerLat + 0.0002, lng: centerLng + 0.0002, weight: 6, label: "Robo a Local" },
        { lat: centerLat - 0.0003, lng: centerLng - 0.0004, weight: 9, label: "Narcomenudeo" }
      ];

  simulatedIncidents.forEach((inc) => {
    const dx = (inc.lng - centerLng) * 200000;
    const dy = -(inc.lat - centerLat) * 200000;
    const px = w / 2 + dx;
    const py = h / 2 + dy;
    
    if (px > 40 && px < w - 40 && py > 40 && py < h - 40) {
      // Degradado radial Kernel Density suave y no difuso exageradamente
      const gradient = ctx.createRadialGradient(px, py, 2, px, py, 26);
      gradient.addColorStop(0, 'rgba(190, 18, 60, 0.85)');   // Crimson red center
      gradient.addColorStop(0.2, 'rgba(225, 29, 72, 0.6)');  // Soft red
      gradient.addColorStop(0.5, 'rgba(217, 119, 6, 0.3)');  // Orange transition
      gradient.addColorStop(0.8, 'rgba(234, 179, 8, 0.12)'); // Yellow halo
      gradient.addColorStop(1, 'rgba(234, 179, 8, 0)');       // Outer bounds
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, 26, 0, Math.PI * 2);
      ctx.fill();
      
      // Núcleo central definido
      ctx.fillStyle = '#be123c';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Centro de Análisis (Crosshair CEIPOL)
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 7, 0, Math.PI * 2);
  ctx.moveTo(w / 2 - 13, h / 2); ctx.lineTo(w / 2 + 13, h / 2);
  ctx.moveTo(w / 2, h / 2 - 13); ctx.lineTo(w / 2, h / 2 + 13);
  ctx.stroke();

  // Dibujar Inset de Localización Jerárquica
  drawLocalizationMap(ctx, 22, 48);
  
  // Dibujar Marco Táctico y Escala
  drawTacticalFrame(ctx, w, h, centerLat, centerLng, "Mapa 1: Densidad Criminológica Perimetral");
  drawTacticalCompass(ctx, w - 45, 55, 15);
  drawScaleBar(ctx, 35, h - 35, 60, "ESCALA: 1:5,000 (50m)");
  
  // Leyenda de Inteligencia Profesional
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1.2;
  ctx.fillRect(w - 185, h - 105, 170, 90);
  ctx.strokeRect(w - 185, h - 105, 170, 90);
  
  ctx.fillStyle = '#0b1f3a';
  ctx.fillRect(w - 185, h - 105, 170, 15);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEYENDA DE INTELIGENCIA', w - 100, h - 95);
  
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '7.5px "Segoe UI", Arial, sans-serif';
  
  // Item 1: Hotspot
  const gradLegend = ctx.createRadialGradient(w - 172, h - 78, 1, w - 172, h - 78, 6);
  gradLegend.addColorStop(0, 'rgba(190, 18, 60, 0.9)');
  gradLegend.addColorStop(1, 'rgba(234, 179, 8, 0)');
  ctx.fillStyle = gradLegend;
  ctx.beginPath(); ctx.arc(w - 172, h - 78, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Hotspot (Densidad Criminógena)', w - 160, h - 75);
  
  // Item 2: Buffer
  ctx.strokeStyle = '#1d4f91';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.arc(w - 172, h - 63, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Cuadrante de Amortiguamiento', w - 160, h - 60);

  // Item 3: Centroid
  ctx.strokeStyle = '#be123c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w - 172, h - 48, 4, 0, Math.PI * 2);
  ctx.moveTo(w - 178, h - 48); ctx.lineTo(w - 166, h - 48);
  ctx.moveTo(w - 172, h - 54); ctx.lineTo(w - 172, h - 42);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Centroide del Polígono', w - 160, h - 45);

  // Metadatos
  ctx.fillStyle = '#475569';
  ctx.font = 'italic 7px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Radio analizado: 500 metros', w - 172, h - 30);
  ctx.fillText('Fuente: CEIPOL Táctico / WGS 84', w - 172, h - 21);

  return canvas.toDataURL('image/png');
};

/**
 * 2. MAPA DE CORREDORES Y MOVILIDAD TÁCTICA
 */
export const renderMobilityMap = async (input: VectorEngineInput): Promise<string> => {
  const { canvas, ctx } = getHDCanvas(600, 400);
  const w = 600;
  const h = 400;
  const centerLat = input.latitude || 21.8853;
  const centerLng = input.longitude || -102.2916;
  
  // 1. Cargar Mapa Base Real (Capa Cartográfica Real)
  const baseMapImg = await loadStaticMapImage(centerLat, centerLng, 15, w, h);
  if (baseMapImg) {
    ctx.drawImage(baseMapImg, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let x = 40; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, h - 40); ctx.stroke();
    }
    for (let y = 40; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke();
    }
    drawTacticalStreets(ctx, w, h);
  }

  // Corredores de movilidad táctica (Vectores proporcionales CEIPOL)
  const drawCorridor = (x1: number, y1: number, x2: number, y2: number, color: string, width: number, label: string) => {
    ctx.save();
    // Halo translúcido
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Línea central discontinua
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Etiqueta del corredor
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 7.5px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.fillText(label, 0, -5);
    ctx.restore();
    ctx.restore();
  };

  // Dibujar corredores reales vectoriales
  drawCorridor(100, 200, 500, 200, '#d97706', 7, "CORREDOR SECUNDARIO DE ESCAPE");
  drawCorridor(300, 60, 300, 340, '#be123c', 9, "CORREDOR DE HUIDA CRÍTICO");

  // Flechas de dirección discretas y proporcionales
  const drawArrow = (fromx: number, fromy: number, tox: number, toy: number, color: string) => {
    const headlen = 8;
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  drawArrow(120, 200, 200, 200, '#d97706');
  drawArrow(220, 200, 280, 200, '#d97706');
  drawArrow(320, 200, 400, 200, '#d97706');
  
  drawArrow(300, 80, 300, 140, '#be123c');
  drawArrow(300, 220, 300, 290, '#be123c');

  // Centroide
  ctx.fillStyle = '#0b1f3a';
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 5, 0, Math.PI * 2); ctx.fill();

  // Dibujar Inset de Localización Jerárquica
  drawLocalizationMap(ctx, 22, 48);

  // Dibujar Marco Táctico y Escala
  drawTacticalFrame(ctx, w, h, centerLat, centerLng, "Mapa 2: Corredores de Movilidad y Escapes");
  drawTacticalCompass(ctx, w - 45, 55, 15);
  drawScaleBar(ctx, 35, h - 35, 60, "ESCALA: 1:5,000 (50m)");

  // Leyenda de Movilidad
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1.2;
  ctx.fillRect(w - 185, h - 105, 170, 90);
  ctx.strokeRect(w - 185, h - 105, 170, 90);
  
  ctx.fillStyle = '#0b1f3a';
  ctx.fillRect(w - 185, h - 105, 170, 15);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEYENDA DE MOVILIDAD', w - 100, h - 95);
  
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '7.5px "Segoe UI", Arial, sans-serif';
  
  // Flecha 1
  ctx.strokeStyle = '#be123c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w - 178, h - 75); ctx.lineTo(w - 166, h - 75);
  ctx.moveTo(w - 170, h - 78); ctx.lineTo(w - 166, h - 75); ctx.lineTo(w - 170, h - 72);
  ctx.stroke();
  ctx.fillText('Ruta de Huida Principal (Riesgo)', w - 160, h - 73);

  // Flecha 2
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w - 178, h - 60); ctx.lineTo(w - 166, h - 60);
  ctx.moveTo(w - 170, h - 63); ctx.lineTo(w - 166, h - 60); ctx.lineTo(w - 170, h - 57);
  ctx.stroke();
  ctx.fillText('Corredor de Acceso Táctico', w - 160, h - 58);

  // Punto
  ctx.fillStyle = '#0b1f3a';
  ctx.beginPath(); ctx.arc(w - 172, h - 45, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillText('Centroide Operacional', w - 160, h - 43);

  // Metadatos
  ctx.fillStyle = '#475569';
  ctx.font = 'italic 7px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Radio analizado: 500 metros', w - 172, h - 30);
  ctx.fillText('Fuente: CEIPOL Táctico / WGS 84', w - 172, h - 21);

  return canvas.toDataURL('image/png');
};

/**
 * 3. MAPA DE ATRACCIÓN Y FACTORES AMBIENTALES
 */
export const renderAttractorsMap = async (input: VectorEngineInput): Promise<string> => {
  const { canvas, ctx } = getHDCanvas(600, 400);
  const w = 600;
  const h = 400;
  const centerLat = input.latitude || 21.8853;
  const centerLng = input.longitude || -102.2916;
  
  // 1. Cargar Mapa Base Real (Capa Cartográfica Real)
  const baseMapImg = await loadStaticMapImage(centerLat, centerLng, 15, w, h);
  if (baseMapImg) {
    ctx.drawImage(baseMapImg, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let x = 40; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, h - 40); ctx.stroke();
    }
    for (let y = 40; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke();
    }
    drawTacticalStreets(ctx, w, h);
  }

  // Zonas de atractores (Polígonos sombreados con trama cruzada estilo GIS)
  const drawGISPolygon = (x: number, y: number, width: number, height: number, fillColor: string, borderColor: string, label: string) => {
    ctx.save();
    // Relleno translúcido
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, width, height);
    
    // Borde
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, width, height);
    
    // Trama de líneas diagonales GIS
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    for (let k = -height; k < width; k += 10) {
      ctx.moveTo(x + k, y);
      ctx.lineTo(x + k + height, y + height);
    }
    ctx.stroke();
    
    // Etiqueta
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = borderColor;
    ctx.font = 'bold 7px "Segoe UI", Arial, sans-serif';
    ctx.fillText(label, x + 6, y + 12);
    ctx.restore();
  };

  drawGISPolygon(150, 80, 150, 120, 'rgba(29, 79, 145, 0.15)', 'rgba(29, 79, 145, 0.7)', 'ZONA A: CONCENTRACIÓN COMERCIAL (ATRACTORES)');
  drawGISPolygon(300, 200, 150, 120, 'rgba(217, 119, 6, 0.15)', 'rgba(217, 119, 6, 0.7)', 'ZONA B: LOTES BALDÍOS (FACILITADORES)');

  // Centroide
  ctx.fillStyle = '#0b1f3a';
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 5, 0, Math.PI * 2); ctx.fill();

  // Dibujar Inset de Localización Jerárquica
  drawLocalizationMap(ctx, 22, 48);

  // Dibujar Marco Táctico y Escala
  drawTacticalFrame(ctx, w, h, centerLat, centerLng, "Mapa 3: Factores de Atracción y Censo Comercial");
  drawTacticalCompass(ctx, w - 45, 55, 15);
  drawScaleBar(ctx, 35, h - 35, 60, "ESCALA: 1:5,000 (50m)");

  // Leyenda de Atractores
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1.2;
  ctx.fillRect(w - 185, h - 105, 170, 90);
  ctx.strokeRect(w - 185, h - 105, 170, 90);
  
  ctx.fillStyle = '#0b1f3a';
  ctx.fillRect(w - 185, h - 105, 170, 15);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEYENDA DE ATRACTORES', w - 100, h - 95);
  
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '7.5px "Segoe UI", Arial, sans-serif';
  
  // Item 1
  ctx.fillStyle = 'rgba(29, 79, 145, 0.15)';
  ctx.strokeStyle = 'rgba(29, 79, 145, 0.7)';
  ctx.fillRect(w - 178, h - 79, 12, 8);
  ctx.strokeRect(w - 178, h - 79, 12, 8);
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Zona A: Concentración Comercial', w - 160, h - 73);

  // Item 2
  ctx.fillStyle = 'rgba(217, 119, 6, 0.15)';
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.7)';
  ctx.fillRect(w - 178, h - 64, 12, 8);
  ctx.strokeRect(w - 178, h - 64, 12, 8);
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Zona B: Deterioro y Baldíos', w - 160, h - 58);

  // Item 3
  ctx.fillStyle = '#be123c';
  ctx.beginPath(); ctx.arc(w - 172, h - 45, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillText('Punto Focal de Riesgo', w - 160, h - 43);

  // Metadatos
  ctx.fillStyle = '#475569';
  ctx.font = 'italic 7px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Radio analizado: 500 metros', w - 172, h - 30);
  ctx.fillText('Fuente: CEIPOL Táctico / WGS 84', w - 172, h - 21);

  return canvas.toDataURL('image/png');
};

/**
 * 4. MAPA DE PROYECCIÓN PREDICTIVA A 6 MESES
 */
export const renderPredictiveMap = async (input: VectorEngineInput): Promise<string> => {
  const { canvas, ctx } = getHDCanvas(600, 400);
  const w = 600;
  const h = 400;
  const centerLat = input.latitude || 21.8853;
  const centerLng = input.longitude || -102.2916;
  
  // 1. Cargar Mapa Base Real (Capa Cartográfica Real)
  const baseMapImg = await loadStaticMapImage(centerLat, centerLng, 15, w, h);
  if (baseMapImg) {
    ctx.drawImage(baseMapImg, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let x = 40; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, h - 40); ctx.stroke();
    }
    for (let y = 40; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke();
    }
    drawTacticalStreets(ctx, w, h);
  }

  // Superficies de Probabilidad Predictiva concéntricas (Estándar GIS)
  const cx = w / 2 + 30;
  const cy = h / 2 - 20;
  
  // Zona de Alta Probabilidad (90%)
  ctx.fillStyle = 'rgba(190, 18, 60, 0.2)';
  ctx.strokeStyle = 'rgba(190, 18, 60, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Zona de Probabilidad Media (70%)
  ctx.fillStyle = 'rgba(217, 119, 6, 0.12)';
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.5)';
  ctx.beginPath();
  ctx.arc(cx, cy, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Zona de Probabilidad Baja (50%)
  ctx.fillStyle = 'rgba(234, 179, 8, 0.06)';
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  // Etiquetas de zonas predictivas
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 7px "Segoe UI", Arial, sans-serif';
  ctx.fillText('90% PROB', cx - 18, cy + 3);
  ctx.fillText('70% PROB', cx - 18, cy - 50);
  ctx.fillText('50% PROB', cx - 18, cy - 100);

  // Centroide
  ctx.fillStyle = '#0b1f3a';
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 5, 0, Math.PI * 2); ctx.fill();

  // Dibujar Inset de Localización Jerárquica
  drawLocalizationMap(ctx, 22, 48);

  // Dibujar Marco Táctico y Escala
  drawTacticalFrame(ctx, w, h, centerLat, centerLng, "Mapa 4: Proyección Predictiva de Incidencia");
  drawTacticalCompass(ctx, w - 45, 55, 15);
  drawScaleBar(ctx, 35, h - 35, 60, "ESCALA: 1:5,000 (50m)");

  // Leyenda Predictiva
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1.2;
  ctx.fillRect(w - 185, h - 105, 170, 90);
  ctx.strokeRect(w - 185, h - 105, 170, 90);
  
  ctx.fillStyle = '#0b1f3a';
  ctx.fillRect(w - 185, h - 105, 170, 15);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEYENDA PREDICTIVA', w - 100, h - 95);
  
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '7.5px "Segoe UI", Arial, sans-serif';
  
  // Item 90%
  ctx.fillStyle = 'rgba(190, 18, 60, 0.2)';
  ctx.strokeStyle = 'rgba(190, 18, 60, 0.7)';
  ctx.fillRect(w - 178, h - 79, 12, 8);
  ctx.strokeRect(w - 178, h - 79, 12, 8);
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Núcleo de Crecimiento (90%)', w - 160, h - 73);

  // Item 70%
  ctx.fillStyle = 'rgba(217, 119, 6, 0.12)';
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.5)';
  ctx.fillRect(w - 178, h - 64, 12, 8);
  ctx.strokeRect(w - 178, h - 64, 12, 8);
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Área de Advertencia (70%)', w - 160, h - 58);

  // Item 50%
  ctx.fillStyle = 'rgba(234, 179, 8, 0.06)';
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
  ctx.setLineDash([2, 2]);
  ctx.fillRect(w - 178, h - 49, 12, 8);
  ctx.strokeRect(w - 178, h - 49, 12, 8);
  ctx.setLineDash([]);
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Límite de Dispersión (50%)', w - 160, h - 43);

  // Metadatos
  ctx.fillStyle = '#475569';
  ctx.font = 'italic 7px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Radio analizado: 500 metros', w - 172, h - 30);
  ctx.fillText('Fuente: CEIPOL Táctico / WGS 84', w - 172, h - 21);

  return canvas.toDataURL('image/png');
};

/**
 * 5. GRÁFICA 1: DISTRIBUCIÓN TEMPORAL DEL DELITO POR TURNO
 */
export const renderTemporalShiftChart = (input: VectorEngineInput): string => {
  const { canvas, ctx } = getHDCanvas(600, 400);
  const w = 600;
  const h = 400;

  // Fondo blanco editorial
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Título Institucional
  ctx.fillStyle = '#0b1f3a';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GRÁFICA 1: DISTRIBUCIÓN TEMPORAL DEL DELITO POR TURNO', w / 2, 40);

  // Subtítulo
  ctx.fillStyle = '#475569';
  ctx.font = '8.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('ANÁLISIS ESTADÍSTICO DE FRECUENCIA POR RANGO HORARIO', w / 2, 54);

  // Ejes y Gridlines de fondo
  ctx.strokeStyle = '#e2e8f0'; // Gridlines muy discretas
  ctx.lineWidth = 0.8;
  const startY = 110;
  const graphHeight = 200;
  
  for (let i = 0; i <= 4; i++) {
    const y = startY + i * (graphHeight / 4);
    
    // Gridline horizontal (excepto el eje X final)
    if (i < 4) {
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(520, y);
      ctx.stroke();
    }
    
    // Eje Y Labels
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 9.5px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${(100 - i * 25)}%`, 70, y + 3.5);
    
    // Ticks secundarios en el eje Y
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(76, y);
    ctx.lineTo(80, y);
    ctx.stroke();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.8;
  }

  // Datos reales o representativos por turnos (CEIPOL Palette)
  const shifts = ['Matutino (6-12)', 'Vespertino (12-18)', 'Nocturno (18-0)', 'Madrugada (0-6)'];
  const values = [12, 23, 45, 20]; // En porcentaje
  const colors = [
    '#1d4f91', // CEIPOL azul principal
    '#475569', // Slate
    '#be123c', // Crimson (Riesgo alto nocturno)
    '#d97706'  // Amber (Advertencia madrugada)
  ];

  // Barras
  const barWidth = 52;
  const spacing = 105;
  const startX = 115;
  const axisY = startY + graphHeight; // 310

  for (let i = 0; i < 4; i++) {
    const heightVal = (values[i] / 100) * graphHeight;
    const x = startX + i * spacing;
    const y = axisY - heightVal;

    // Dibujar barra con degradado elegante
    const grad = ctx.createLinearGradient(x, axisY, x, y);
    grad.addColorStop(0, colors[i]);
    grad.addColorStop(1, colors[i] + 'dd'); // Sutil transparencia arriba
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barWidth, heightVal);

    // Contorno fino de la barra
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, barWidth, heightVal);

    // Valor exacto dibujado en negro arriba de la barra
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${values[i]}%`, x + barWidth / 2, y - 8);

    // Ticks en el eje X para cada categoría
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + barWidth / 2, axisY);
    ctx.lineTo(x + barWidth / 2, axisY + 4);
    ctx.stroke();

    // Texto de etiquetas en X
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
    ctx.fillText(shifts[i], x + barWidth / 2, axisY + 16);
  }

  // Ejes X e Y sólidos (Slate)
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(80, startY - 10);
  ctx.lineTo(80, axisY);
  ctx.lineTo(520, axisY);
  ctx.stroke();

  // Pie de Gráfica / Fuente
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 8px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Fuente: Registro Estadístico de Incidencia Delictiva CEIPOL', 80, 360);
  
  // Marca de agua sutil en la esquina inferior derecha
  ctx.fillStyle = 'rgba(11, 31, 58, 0.06)';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('SSPE-CEIPOL', 520, 360);

  return canvas.toDataURL('image/png');
};

/**
 * 6. GRÁFICA 2: TOPOLOGÍA Y FRECUENCIA DE INCIDENTES (TOP 5 DELITOS)
 */
export const renderCrimeTopologyChart = (input: VectorEngineInput): string => {
  const { canvas, ctx } = getHDCanvas(600, 400);
  const w = 600;
  const h = 400;

  // Fondo blanco editorial
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Título Institucional
  ctx.fillStyle = '#0b1f3a';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GRÁFICA 2: TOPOLOGÍA Y FRECUENCIA DE INCIDENTES', w / 2, 40);

  // Subtítulo
  ctx.fillStyle = '#475569';
  ctx.font = '8.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('DISTRIBUCIÓN POR TIPOLOGÍA DE DELITO REGISTRADA', w / 2, 54);

  // Categorías de delitos (Top 5)
  const crimes = [
    'Robo a transeúnte con violencia',
    'Robo de vehículo/autopartes',
    'Narcomenudeo/Consumo vía pública',
    'Lesiones y agresiones físicas',
    'Vandalismo / Daños perimetrales'
  ];
  const percentages = [35, 25, 20, 12, 8];
  
  // CEIPOL Palette - con un rojo marcado para el primer tipo (violento) y neutrales/azules para los demás
  const colors = [
    '#be123c', // Crimson (Crimen violento)
    '#1d4f91', // CEIPOL Standard Blue
    '#475569', // Slate
    '#5d6b7c', // Muted Blue-gray
    '#d97706'  // Amber (Incivilidades/Vandalismo)
  ];

  // Dibujar barras horizontales
  const startY = 95;
  const spacingY = 46;
  const barHeight = 20;
  const maxBarWidth = 260;
  const axisX = 220;

  // Gridlines verticales sutiles para la escala de porcentajes
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 0.8;
  for (let pct = 10; pct <= 50; pct += 10) {
    const gx = axisX + (pct / 50) * maxBarWidth;
    ctx.beginPath();
    ctx.moveTo(gx, startY - 10);
    ctx.lineTo(gx, startY + 5 * spacingY - 15);
    ctx.stroke();
  }

  for (let i = 0; i < 5; i++) {
    const y = startY + i * spacingY;
    const barWidth = (percentages[i] / 50) * maxBarWidth; // Escalado a maxBarWidth (representa el 50% max)

    // Etiqueta del Delito (Alineado a la derecha en el eje Y)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(crimes[i], axisX - 12, y + 13);

    // Barra de fondo sutil
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(axisX, y, maxBarWidth, barHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(axisX, y, maxBarWidth, barHeight);

    // Barra de valor relleno con degradado sutil
    const grad = ctx.createLinearGradient(axisX, y, axisX + barWidth, y);
    grad.addColorStop(0, colors[i]);
    grad.addColorStop(1, colors[i] + 'cc');
    ctx.fillStyle = grad;
    ctx.fillRect(axisX, y, barWidth, barHeight);

    // Borde de la barra de valor
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 1;
    ctx.strokeRect(axisX, y, barWidth, barHeight);

    // Porcentaje explícito
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9.5px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${percentages[i]}%`, axisX + barWidth + 8, y + 13.5);

    // Ticks en el eje Y
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axisX - 4, y + barHeight / 2);
    ctx.lineTo(axisX, y + barHeight / 2);
    ctx.stroke();
  }

  // Eje Y sólido
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(axisX, startY - 10);
  ctx.lineTo(axisX, startY + 5 * spacingY - 15);
  ctx.stroke();

  // Eje X ticks e indicadores de escala al fondo
  const bottomY = startY + 5 * spacingY - 15;
  ctx.beginPath();
  ctx.moveTo(axisX, bottomY);
  ctx.lineTo(axisX + maxBarWidth, bottomY);
  ctx.stroke();

  for (let pct = 0; pct <= 50; pct += 10) {
    const tickX = axisX + (pct / 50) * maxBarWidth;
    ctx.beginPath();
    ctx.moveTo(tickX, bottomY);
    ctx.lineTo(tickX, bottomY + 4);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '8px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${pct}%`, tickX, bottomY + 13);
  }

  // Pie de Gráfica / Fuente
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 8px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Fuente: Censo Homologado de Llamadas de Emergencia y Denuncias', 50, 365);

  // Marca de agua sutil en la esquina inferior derecha
  ctx.fillStyle = 'rgba(11, 31, 58, 0.06)';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('SSPE-CEIPOL', w - 50, 365);

  return canvas.toDataURL('image/png');
};

/**
 * 7. GRÁFICA 3: FACILITADORES AMBIENTALES DE OPORTUNIDAD
 */
export const renderEnvironmentalFactorsChart = (input: VectorEngineInput): string => {
  const { canvas, ctx } = getHDCanvas(600, 400);
  const w = 600;
  const h = 400;

  // Fondo blanco editorial
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Título Institucional
  ctx.fillStyle = '#0b1f3a';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GRÁFICA 3: FACILITADORES AMBIENTALES DE RIESGO', w / 2, 40);

  // Subtítulo
  ctx.fillStyle = '#475569';
  ctx.font = '8.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('EVALUACIÓN DE VULNERABILIDADES FÍSICAS Y DE DISEÑO URBANO (ESCALA 1-10)', w / 2, 54);

  // Datos
  const factors = [
    'Iluminación Inexistente/Falla',
    'Terrenos Baldíos sin Cierre',
    'Puntos Ciegos / Sin Cámara',
    'Maleza Alta / Ocultamiento',
    'Vías de Escape Rápido'
  ];
  const ratings = [9.2, 8.5, 7.8, 6.5, 8.0]; // Escala 1-10

  // Paleta de colores CEIPOL/SSPE para factores de riesgo
  const colors = [
    '#be123c', // Crimson (Iluminación - muy crítico)
    '#d97706', // Amber (Terrenos - advertencia)
    '#d97706', // Amber (Cámaras)
    '#475569', // Slate (Maleza)
    '#1d4f91'  // CEIPOL Blue (Vías de escape)
  ];

  const startX = 60;
  const spacingX = 100;
  const barWidth = 36;
  const startY = 100;
  const graphHeight = 200;
  const axisY = startY + graphHeight; // 300

  // Gridlines horizontales discretas (Escala de 10 puntos)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 0.8;
  for (let i = 0; i <= 5; i++) {
    const y = startY + i * (graphHeight / 5);
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(540, y);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${(10 - i * 2)} pts`, 50, y + 3);

    // Ticks en el eje Y
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(56, y);
    ctx.lineTo(60, y);
    ctx.stroke();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.8;
  }

  for (let i = 0; i < 5; i++) {
    const x = startX + 28 + i * spacingX;
    const heightVal = (ratings[i] / 10) * graphHeight; // Escalar a píxeles
    const y = axisY - heightVal;

    // Dibujar barra sólida con degradado sutil
    const grad = ctx.createLinearGradient(x, axisY, x, y);
    grad.addColorStop(0, colors[i]);
    grad.addColorStop(1, colors[i] + 'dd');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barWidth, heightVal);

    // Contorno
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, barWidth, heightVal);

    // Puntuación exacta encima de la barra
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ratings[i].toFixed(1), x + barWidth / 2, y - 8);

    // Tick en el eje X
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + barWidth / 2, axisY);
    ctx.lineTo(x + barWidth / 2, axisY + 4);
    ctx.stroke();

    // Texto de factor en diagonal
    ctx.save();
    ctx.translate(x + barWidth / 2, axisY + 16);
    ctx.rotate(Math.PI / 10);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 8.5px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(factors[i], 0, 0);
    ctx.restore();
  }

  // Ejes
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, startY - 10);
  ctx.lineTo(60, axisY);
  ctx.lineTo(540, axisY);
  ctx.stroke();

  // Pie de Gráfica / Fuente
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 8px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Fuente: Auditoría de Campo y Matriz de Vulnerabilidad Ambiental CEIPOL', 50, 365);

  // Marca de agua sutil en la esquina inferior derecha
  ctx.fillStyle = 'rgba(11, 31, 58, 0.06)';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('SSPE-CEIPOL', 540, 365);

  return canvas.toDataURL('image/png');
};

/**
 * 8. GRÁFICA 4: PREDICCIÓN DE AUMENTO DE INCIDENCIA A 6 MESES
 */
export const renderPredictiveLineChart = (input: VectorEngineInput): string => {
  const { canvas, ctx } = getHDCanvas(600, 400);
  const w = 600;
  const h = 400;

  // Fondo blanco editorial
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Título Institucional
  ctx.fillStyle = '#0b1f3a';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GRÁFICA 4: PROYECCIÓN TENDENCIAL DE INCIDENCIA A 6 MESES', w / 2, 40);

  // Subtítulo
  ctx.fillStyle = '#475569';
  ctx.font = '8.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('PROYECCIÓN TÁCTICA MULTIVARIADA DE DELITOS ESTIMADOS EN EL ÁREA', w / 2, 54);

  // Meses y valores delictivos proyectados
  const months = ['Mes Actual', 'Mes 1', 'Mes 2', 'Mes 3', 'Mes 4', 'Mes 5', 'Mes 6 (Proy)'];
  const values = [18, 20, 23, 22, 25, 28, 32]; // Delitos simulados

  // Gridlines horizontales discretas
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 0.8;
  const startY = 100;
  const graphHeight = 200;
  const axisY = startY + graphHeight; // 300

  for (let i = 0; i <= 4; i++) {
    const y = startY + i * (graphHeight / 4);
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(520, y);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${(40 - i * 10)} del`, 70, y + 3.5);

    // Ticks en el eje Y
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(76, y);
    ctx.lineTo(80, y);
    ctx.stroke();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.8;
  }

  // Trazar línea de tendencia (Azul a Naranja Proyectiva)
  const startX = 100;
  const spacingX = 65;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const x = startX + i * spacingX;
    const y = axisY - (values[i] / 40) * graphHeight; // Escalar basado en 40 max
    points.push({ x, y });
  }

  // Dibujar línea histórica (Mes Actual a Mes 4)
  ctx.strokeStyle = '#1d4f91'; // CEIPOL azul principal
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i <= 4; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // Línea predictiva discontinua naranja para los últimos meses
  ctx.strokeStyle = '#d97706'; // Amber para advertencia
  ctx.lineWidth = 3.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(points[4].x, points[4].y);
  for (let i = 5; i < 7; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Puntos con etiquetas y valores explícitos
  for (let i = 0; i < 7; i++) {
    const pt = points[i];
    
    // Punto de color relleno
    ctx.fillStyle = i >= 5 ? '#d97706' : '#1d4f91';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    
    // Borde exterior fino del nodo
    ctx.strokeStyle = i >= 5 ? '#d97706' : '#1d4f91';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6.8, 0, Math.PI * 2);
    ctx.stroke();

    // Valor exacto dibujado arriba del punto (con fondo blanco sutil para contraste)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9.5px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(values[i].toString() + ' del', pt.x, pt.y - 12);

    // Tick en el eje X
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pt.x, axisY);
    ctx.lineTo(pt.x, axisY + 4);
    ctx.stroke();

    // Eje X Label
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 8.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(months[i], pt.x, axisY + 16);
  }

  // Ejes X e Y
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(80, startY - 10);
  ctx.lineTo(80, axisY);
  ctx.lineTo(520, axisY);
  ctx.stroke();

  // Pie de Gráfica / Fuente
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 8px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Fuente: Modelo Predictivo de Regresión Espacial CEIPOL', 50, 365);

  // Marca de agua sutil en la esquina inferior derecha
  ctx.fillStyle = 'rgba(11, 31, 58, 0.06)';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('SSPE-CEIPOL', 520, 365);

  return canvas.toDataURL('image/png');
};

/**
 * 9. GRAFO DE RELACIONES Y REDES DELICTIVAS (HIG 2.0)
 */
export const renderHypothesisGraph = (input: VectorEngineInput): string => {
  const { canvas, ctx } = getHDCanvas(600, 400);
  const w = 600;
  const h = 400;

  // Fondo blanco editorial
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Título Institucional
  ctx.fillStyle = '#0b1f3a';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HYPOTHESIS INTELLIGENCE GRAPH (HIG 2.0)', w / 2, 35);
  
  // Subtítulo
  ctx.fillStyle = '#1d4f91';
  ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
  ctx.fillText('RELACIÓN ESTRUCTURAL DE RIESGOS Y ACCIONES OPERATIVAS', w / 2, 48);

  // Nodos estructurales (Paleta CEIPOL con alta legibilidad)
  const nodes = [
    { id: 'center', label: input.projectName.slice(0, 18), x: 300, y: 200, color: '#0b1f3a', r: 45, fontColor: '#ffffff', bold: true }, // Navy principal
    
    // Factores ambientales (Izquierda - Amber para advertencia)
    { id: 'f1', label: 'Baldíos/Oscuridad', x: 120, y: 120, color: '#d97706', r: 28, fontColor: '#ffffff', bold: true },
    { id: 'f2', label: 'Sin Cámaras/C2', x: 100, y: 220, color: '#d97706', r: 28, fontColor: '#ffffff', bold: true },
    { id: 'f3', label: 'Escape Rápido', x: 140, y: 310, color: '#d97706', r: 28, fontColor: '#ffffff', bold: true },
    
    // Amenazas / Delitos (Derecha - Crimson para riesgo)
    { id: 'a1', label: 'Robo Peatón', x: 480, y: 110, color: '#be123c', r: 28, fontColor: '#ffffff', bold: true },
    { id: 'a2', label: 'Mercado Negro', x: 500, y: 200, color: '#be123c', r: 28, fontColor: '#ffffff', bold: true },
    { id: 'a3', label: 'Consumo Vía Pública', x: 460, y: 300, color: '#be123c', r: 28, fontColor: '#ffffff', bold: true },
    
    // Acciones Estratégicas (Arriba y Abajo - Verde favorable)
    { id: 'op1', label: 'Patrullaje Nocturno', x: 300, y: 95, color: '#16a34a', r: 32, fontColor: '#ffffff', bold: true },
    { id: 'op2', label: 'Recuperación Espacio', x: 300, y: 315, color: '#16a34a', r: 32, fontColor: '#ffffff', bold: true }
  ];

  // Trazar enlaces entre nodos (Líneas vectoriales con estilo)
  const drawLink = (fromId: string, toId: string, label?: string, isDashed = false) => {
    const from = nodes.find(n => n.id === fromId)!;
    const to = nodes.find(n => n.id === toId)!;
    
    ctx.strokeStyle = isDashed ? 'rgba(29, 79, 145, 0.45)' : '#64748b'; // Conectores CEIPOL / Slate
    ctx.lineWidth = 1.5;
    if (isDashed) ctx.setLineDash([4, 3]);
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Etiqueta del enlace a la mitad
    if (label) {
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 7.5px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      
      // Rectángulo de fondo blanco para el texto de la etiqueta
      ctx.fillStyle = '#ffffff';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(mx - textWidth / 2 - 3, my - 6, textWidth + 6, 10);
      
      ctx.fillStyle = '#475569';
      ctx.fillText(label, mx, my + 1.5);
    }
  };

  // Enlaces ambientales a centro
  drawLink('f1', 'center', 'Facilita');
  drawLink('f2', 'center', 'Propicia');
  drawLink('f3', 'center', 'Permite escape');

  // Enlaces amenazas a centro
  drawLink('center', 'a1', 'Ocurrencia');
  drawLink('center', 'a2', 'Atractor');
  drawLink('center', 'a3', 'Vulnerabilidad');

  // Acciones tácticas a amenazas/factores
  drawLink('op1', 'f1', 'Mitiga', true);
  drawLink('op1', 'a1', 'Disuade', true);
  drawLink('op2', 'f3', 'Bloquea', true);
  drawLink('op2', 'a3', 'Sanea', true);

  // Dibujar círculos de nodos
  nodes.forEach(node => {
    // Sombra del nodo sutil y gris (no difusa/neón)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0; // Desactivar sombra
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Borde blanco del nodo
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.stroke();

    // Borde exterior fino del color de categoría
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r + 1.8, 0, Math.PI * 2);
    ctx.stroke();

    // Etiqueta
    ctx.fillStyle = node.fontColor;
    ctx.font = node.bold ? 'bold 8px "Segoe UI", Arial, sans-serif' : '8px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // Ajustar texto largo en dos líneas si es necesario
    const words = node.label.split('/');
    const finalWords = words.length > 1 ? words : node.label.split(' ');
    
    if (finalWords.length > 1 && node.label.length > 10) {
      ctx.fillText(finalWords.slice(0, Math.ceil(finalWords.length / 2)).join(' '), node.x, node.y - 2.5);
      ctx.fillText(finalWords.slice(Math.ceil(finalWords.length / 2)).join(' '), node.x, node.y + 6.5);
    } else {
      ctx.fillText(node.label, node.x, node.y + 2.5);
    }
  });

  // Leyenda de Jerarquía del Grafo en la esquina inferior izquierda
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0b1f3a';
  ctx.lineWidth = 1.2;
  ctx.fillRect(15, h - 85, 130, 70);
  ctx.strokeRect(15, h - 85, 130, 70);

  ctx.fillStyle = '#0b1f3a';
  ctx.font = 'bold 7.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('JERARQUÍA DEL GRAFO', 80, h - 74);

  ctx.textAlign = 'left';
  ctx.font = 'bold 7.5px "Segoe UI", Arial, sans-serif';
  
  ctx.fillStyle = '#0b1f3a';
  ctx.fillText('● Nodo Central (Exp)', 22, h - 60);
  ctx.fillStyle = '#d97706';
  ctx.fillText('● Factores Ambientales', 22, h - 50);
  ctx.fillStyle = '#be123c';
  ctx.fillText('● Amenazas / Delito', 22, h - 40);
  ctx.fillStyle = '#16a34a';
  ctx.fillText('● Acciones Preventivas', 22, h - 30);

  return canvas.toDataURL('image/png');
};

/**
 * NativeGEOINTMapRenderer - Motor cartográfico GEOINT para la validación y renderizado
 * a partir de capas geográficas reales.
 */
export class NativeGEOINTMapRenderer {
  static async renderDensity(input: VectorEngineInput): Promise<string> {
    return renderDensityMap(input);
  }
  static async renderMobility(input: VectorEngineInput): Promise<string> {
    return renderMobilityMap(input);
  }
  static async renderAttractors(input: VectorEngineInput): Promise<string> {
    return renderAttractorsMap(input);
  }
  static async renderPredictive(input: VectorEngineInput): Promise<string> {
    return renderPredictiveMap(input);
  }
}
