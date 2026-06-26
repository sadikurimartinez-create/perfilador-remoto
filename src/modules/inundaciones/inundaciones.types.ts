export interface FloodAssessment {
  id?: string;
  zona_analizada: string;
  iri_score: number; // 0 to 100
  nivel_riesgo: "Bajo" | "Medio" | "Alto" | "Crítico";
  factores_principales: string[];
  evidencia_geoespacial: {
    tipo: string;
    descripcion: string;
    coordenadas?: { lat: number; lng: number };
  }[];
  evidencia_osint: {
    fuente: string;
    texto: string;
    fecha?: string;
    coordenadas?: { lat: number; lng: number };
  }[];
  infraestructura_critica: {
    nombre: string;
    tipo: "Hospital" | "Escuela" | "Estación de Bomberos" | "Instalación Eléctrica" | "Zona Urbana Crítica" | "Otro";
    vulnerabilidad: "Baja" | "Media" | "Alta" | "Crítica";
    coordenadas: { lat: number; lng: number };
  }[];
  alerta: boolean;
  recomendaciones: string[];
  createdAt?: number;
  createdBy?: string;
  lat: number;
  lng: number;
  radioMetros: number;
  observaciones_campo?: string;
  pronostico_lluvia?: string;
  recommended_wms_layers?: any[];
}
