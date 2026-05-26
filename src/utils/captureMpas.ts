import html2canvas from 'html2canvas';

export const captureMapImage = async (
  elementId: string
): Promise<string | null> => {

  const mapElement = document.getElementById(elementId);

  if (!mapElement) {
    console.error('Mapa no encontrado');
    return null;
  }

  try {

    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    return canvas.toDataURL('image/png');

  } catch (error) {

    console.error('Error capturando mapa:', error);

    return null;
  }
};

export const generateStaticMapBase64 = async (report: any): Promise<string | null> => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
  if (!apiKey) return null;

  const findings = report.findings || [];
  if (findings.length === 0) return null;

  let url = `https://maps.googleapis.com/maps/api/staticmap?size=900x500&maptype=satellite&key=${apiKey}`;

  const markers = findings.map((f: any, idx: number) => {
    let color = "green";
    const risk = (f.riskLevel || "").toLowerCase();
    if (risk === "alto" || risk === "high") color = "red";
    else if (risk === "medio" || risk === "medium") color = "orange";
    const lat = f.latitude ?? f.lat;
    const lng = f.longitude ?? f.lng;
    return `markers=color:${color}|label:${idx + 1}|${lat},${lng}`;
  }).join("&");

  url += "&" + markers;

  if (report.geometryType === "lineal" && findings.length >= 2) {
    const pathCoords = findings.map((f: any) => `${f.latitude ?? f.lat},${f.longitude ?? f.lng}`).join("|");
    url += `&path=color:0xff000080|weight:5|${pathCoords}`;
  } else if (report.geometryType === "poligono" && findings.length >= 3) {
    const pathCoords = findings.map((f: any) => `${f.latitude ?? f.lat},${f.longitude ?? f.lng}`).join("|");
    const firstCoord = `${findings[0].latitude ?? findings[0].lat},${findings[0].longitude ?? findings[0].lng}`;
    url += `&path=color:0xff000080|fillcolor:0xff000030|weight:3|${pathCoords}|${firstCoord}`;
  }

  try {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Error loading static map"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch (error) {
    console.error("Error generando mapa estático táctico:", error);
    return null;
  }
};

export const generateStreetViewBase64 = async (lat: number, lng: number, heading: number = 0): Promise<string | null> => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
  if (!apiKey) return null;
  const url = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&heading=${heading}&key=${apiKey}`;
  try {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("StreetView Error"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch (e) {
    return null;
  }
};

export const generateRiskChartBase64 = async (findings: any[]): Promise<string | null> => {
  const high = findings.filter((f: any) => { const r = (f.riskLevel || '').toLowerCase(); return r === 'alto' || r === 'high'; }).length;
  const medium = findings.filter((f: any) => { const r = (f.riskLevel || '').toLowerCase(); return r === 'medio' || r === 'medium'; }).length;
  const low = findings.filter((f: any) => { const r = (f.riskLevel || '').toLowerCase(); return r === 'bajo' || r === 'low'; }).length;

  if (high === 0 && medium === 0 && low === 0) return null;

  const chartConfig = {
    type: 'doughnut',
    data: {
      labels: ['Riesgo Alto', 'Riesgo Medio', 'Riesgo Bajo'],
      datasets: [{
        data: [high, medium, low],
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      plugins: {
        datalabels: { color: '#ffffff', font: { size: 18, weight: 'bold' } },
        legend: { position: 'right', labels: { fontSize: 16, fontColor: '#000000', padding: 20 } }
      },
      title: { display: true, text: 'Hallazgos Criminológicos por Nivel de Riesgo', fontSize: 18, fontColor: '#000000' }
    }
  };

  const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=600&h=300&bkg=white&f=png`;

  try {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); });
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png", 1.0);
  } catch (e) { return null; }
};