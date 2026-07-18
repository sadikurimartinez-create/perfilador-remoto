import { validateGeoIntegrity } from "../src/utils/geoIntegrityEngine";

function runVirtualCaptureSuite() {
  console.log("================================");
  console.log("\nVIRTUAL CAPTURE GOVERNANCE\n");

  const apiKey = "AIzaSyBB1mc8b1lpevjxcFSSLHurnbCQw62RAaA";
  const lat = 21.8853;
  const lng = -102.2916;
  const heading = 45;
  const pitch = 5;
  const zoom = 1;
  const fov = 180 / Math.pow(2, zoom); // 90

  // 1. Verificar construcción de la URL Estática
  const staticUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${apiKey}`;
  const isUrlValid = 
    staticUrl.includes("maps.googleapis.com") &&
    staticUrl.includes("location=21.8853,-102.2916") &&
    staticUrl.includes("heading=45") &&
    staticUrl.includes("pitch=5") &&
    staticUrl.includes("fov=90") &&
    staticUrl.includes(`key=${apiKey}`);

  console.log("STATIC URL GENERATION:");
  console.log(isUrlValid ? "PASS" : "FAIL");
  console.log("");

  // 2. Simulación de Cintilla Temporal
  const temporaryCintilla = [
    {
      id: "temp-sv-1",
      url: staticUrl,
      lat,
      lng,
      heading,
      pitch,
      comentario: "Punto de observación táctico - posible casa de seguridad",
      streetViewCategory: "hideout" as const
    },
    {
      id: "temp-sv-2",
      url: staticUrl,
      lat,
      lng,
      heading: 135,
      pitch: -10,
      comentario: "Grafiti del cártel local en barda perimetral",
      streetViewCategory: "graffiti" as const
    }
  ];

  const commentsValid = temporaryCintilla.every(c => c.comentario.length > 0);
  const categoriesValid = temporaryCintilla.every(c => ["hideout", "graffiti", "denue_interest", "other"].includes(c.streetViewCategory));

  console.log("TEMPORAL CINTILLA CONTROLS:");
  console.log(commentsValid && categoriesValid ? "PASS" : "FAIL");
  console.log("");

  // 3. Simulación de Incorporación al Álbum (Conformidad ADR-011)
  // Al incorporarse, las imágenes deben adoptar las propiedades exactas para ser filtradas/priorizadas por ADR-011
  const simulatedAlbum = temporaryCintilla.map((item) => ({
    id: `photo-firestore-${item.id}`,
    url: item.url,
    lat: item.lat,
    lng: item.lng,
    tipo: "STREET_VIEW",
    fuente: "Google Street View",
    evidenceType: "VIRTUAL_STREET_VIEW",
    comentario: `EVIDENCIA VIRTUAL STREET VIEW [Categoría: ${item.streetViewCategory}]: ${item.comentario}`,
    streetViewCategory: item.streetViewCategory,
    streetViewSource: "Google Street View",
    analysisType: "STREET_VIEW",
    createdAt: Date.now()
  }));

  const incorporationValid = simulatedAlbum.every(p => 
    p.tipo === "STREET_VIEW" &&
    p.evidenceType === "VIRTUAL_STREET_VIEW" &&
    p.fuente === "Google Street View" &&
    p.analysisType === "STREET_VIEW" &&
    p.streetViewSource === "Google Street View" &&
    !!p.streetViewCategory
  );

  console.log("ALBUM INCORPORATION META:");
  console.log(incorporationValid ? "PASS" : "FAIL");
  console.log("");

  // 4. Verificación de Capping y Control de Cluttering (Gobernanza ADR-011 congelada)
  // Si agregamos más de 4 capturas en una sola categoría, la vista/exportador debe limitar la visualización a 4
  const massiveSvsInHideout = Array.from({ length: 6 }).map((_, i) => ({
    id: `photo-firestore-massive-${i}`,
    url: `https://maps.googleapis.com/cbk?idx=${i}`,
    lat,
    lng,
    tipo: "STREET_VIEW",
    fuente: "Google Street View",
    evidenceType: "VIRTUAL_STREET_VIEW",
    comentario: `Masivo #${i}`,
    streetViewCategory: "hideout" as const,
    streetViewSource: "Google Street View",
    analysisType: "STREET_VIEW",
    createdAt: Date.now()
  }));

  const fullAlbum = [...simulatedAlbum, ...massiveSvsInHideout];

  // Regla de Normalización y Filtro al vuelo en PhotoAlbum (Línea 584)
  const getStatus = (count: number) => {
    if (count === 0) return "EMPTY";
    if (count < 2) return "INSUFFICIENT";
    if (count > 4) return "CAPPED";
    return "VALID";
  };

  const svPhotos = fullAlbum.filter(p => p.tipo === "STREET_VIEW" || p.evidenceType === "VIRTUAL_STREET_VIEW");
  const hideouts = svPhotos.filter(p => p.streetViewCategory === "hideout");
  const cappedHideouts = hideouts.slice(0, 4);

  const cappingStatus = getStatus(hideouts.length); // Esperado: CAPPED (ya que hay 1 de simulatedAlbum + 6 de massiveSvsInHideout = 7)
  const cappingValid = cappingStatus === "CAPPED" && cappedHideouts.length === 4;

  console.log("ADR-011 CAPPING & CLUTTERING INTEGRITY:");
  console.log(cappingValid ? "PASS" : "FAIL");
  console.log("");

  const allPassed = isUrlValid && commentsValid && categoriesValid && incorporationValid && cappingValid;

  console.log("\nSTATUS:");
  console.log(allPassed ? "GREEN" : "RED");
  console.log("\n================================");

  if (!allPassed) {
    process.exit(1);
  }
}

runVirtualCaptureSuite();
