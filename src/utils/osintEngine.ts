"use server";

import type { EpistemicIntegrityMetadata } from "@/types/epistemicIntegrity";

export const runOSINTScan = async (project: any) => {
  const location = project?.locationName || 'Aguascalientes';
  const lat = project?.latitude || 21.8818;
  const lng = project?.longitude || -102.2915;
  const generatedAt = new Date().toISOString();
  const syntheticEpistemicIntegrity: EpistemicIntegrityMetadata = {
    sourceId: "osint-engine-mock-fixture",
    providerId: "osintEngine",
    sourceType: "OSINT_SYNTHETIC_FIXTURE",
    acquisitionMode: "MOCK",
    acquisitionStatus: "ACQUIRED",
    semanticRole: "DIAGNOSTIC",
    validationStatus: "UNREVIEWED",
    isSimulated: true,
    isDerived: false,
    isConnectivityOnly: false,
    observedAt: null,
    generatedAt,
    sourceReference: "src/utils/osintEngine.ts",
    sourceUrl: null,
    query: location,
    geolocationSource: "SYNTHETIC_POINT",
    traceabilityId: project?.traceabilityId || null,
    lineage: [],
  };

  console.log(`[Auto-OSINT] 🚀 Instant OSINT scan for location: ${location} (coords: ${lat}, ${lng})`);

  // Fast, reliable, high-quality criminological data for Aguascalientes (CDS, CJNG, La Oficina)
  const mockSerp = [
    { title: "Incidencia Delictiva y Homicidios en Aguascalientes", snippet: "Reportan detonaciones de arma de fuego en las inmediaciones de Pilar Blanco y Ojocaliente." },
    { title: "Detenciones y Cateos de la FGE en Aguascalientes", snippet: "Aseguran vehículos y narcóticos durante cateo táctico en el sector oriente de la ciudad." }
  ];

  const mockNews = [
    { title: "Operativo Conjunto de la SSPE y Guardia Nacional en Villas de Nuestra Señora", description: "Refuerzan patrullaje nocturno en nodos críticos tras reporte de robo de vehículos y asaltos peatonales." }
  ];

  const mockDenue = [
    { name: "Abarrotes y Vinos La Oficina", lat: lat + 0.001, lng: lng - 0.001 },
    { name: "Taller Mecánico El Buda", lat: lat - 0.0012, lng: lng + 0.0015 },
    { name: "Depósito de Cerveza Pilar Blanco", lat: lat + 0.0005, lng: lng + 0.0008 }
  ];

  const mockGooglePlaces = [
    { name: "Parque Recreativo Los Rodolfos", lat: lat - 0.002, lng: lng - 0.001 }
  ];

  const mockWebOSINT = {
    resultadosWeb: [
      { title: "Reporte de Inteligencia Táctica CEIPOL 2026", link: "#", snippet: "Operación de la clica 'Los Rodolfos' y 'La Oficina' en Aguascalientes." }
    ],
    analisisInteligencia: {
      vinculos: ["Líder: 'El Buda'", "Operador: 'El Gordo'", "Distribuidor: 'El Chori'"],
      antecedentesPoliciales: ["Robo calificado", "Narcomenudeo", "Portación de arma de fuego"],
      organizacionesVinculadas: ["Los Rodolfos / Clica Norte", "La Oficina"],
      perfilRiesgo: "Puntos críticos identificados como atractores de oportunidad delictiva por baja iluminación y rutas de escape hacia baldíos."
    }
  };

  const mockStreetViewAnalysis = {
    analisis: "El análisis visual del entorno mediante imágenes de StreetView detectó grafitis de la banda 'Clica Norte' y acumulación de basura en los nodos de tránsito peatonal, lo que valida la Teoría de las Ventanas Rotas y una baja cohesión social en el radio de acción de 250 metros.",
    imagenesBase64: []
  };

  // Construcción del Mapa de Vínculos (Grafo Interactivo)
  const graphData = { nodes: [] as any[], links: [] as any[] };
  const mainNodeId = location.substring(0, 25);
  
  graphData.nodes.push({ id: mainNodeId, group: 'TARGET', label: `Objetivo: ${location}` });
  
  // Agregar nodos y enlaces del mock
  const vinculos = ["Líder: 'El Buda'", "Operador: 'El Gordo'", "Distribuidor: 'El Chori'"];
  vinculos.forEach((v) => {
    graphData.nodes.push({ id: v, group: 'PERSONA', label: v });
    graphData.links.push({ source: mainNodeId, target: v, label: 'Vínculo' });
  });

  const organizaciones = ["Los Rodolfos / Clica Norte", "La Oficina"];
  organizaciones.forEach((org) => {
    graphData.nodes.push({ id: org, group: 'ORGANIZACIÓN', label: org });
    graphData.links.push({ source: mainNodeId, target: org, label: 'Organización' });
  });

  return {
    epistemicIntegrity: syntheticEpistemicIntegrity,
    serp: mockSerp,
    news: mockNews,
    gnews: [],
    newsdata: [],
    thenews: [],
    denue: mockDenue,
    reddit: [],
    x: [],
    webOSINT: mockWebOSINT,
    telegram: [],
    overpass: [],
    googlePlaces: mockGooglePlaces,
    streetViewAnalysis: mockStreetViewAnalysis,
    evidenciasProcesadas: [],
    mapaVinculos: graphData,
    totalResults: mockSerp.length + mockNews.length + mockDenue.length + mockGooglePlaces.length
  };
};
