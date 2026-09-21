export type OfficialAcquisitionMethod = "RSS" | "JSON_API" | "PUBLIC_HTML";
export type OfficialSourceCategory =
  | "SSPE"
  | "STATE_PROSECUTOR"
  | "STATE_GOVERNMENT"
  | "MUNICIPALITY"
  | "CIVIL_PROTECTION"
  | "FGR"
  | "NATIONAL_GUARD"
  | "FEDERAL_GAZETTE"
  | "STATE_GAZETTE"
  | "JUDICIARY"
  | "INSTITUTIONAL_BULLETIN";

export interface CifaOfficialSourceDefinition {
  id: string;
  organization: string;
  jurisdiction: string;
  sourceType: string;
  category: OfficialSourceCategory;
  url: string;
  feedUrl: string | null;
  enabled: boolean;
  priority: number;
  acquisitionMethod: OfficialAcquisitionMethod;
}

// Only public, unauthenticated government endpoints verified for this registry.
export const CIFA_OFFICIAL_SOURCE_REGISTRY: readonly CifaOfficialSourceDefinition[] = [
  {
    id: "ags-government-bulletins",
    organization: "Gobierno del Estado de Aguascalientes",
    jurisdiction: "Aguascalientes",
    sourceType: "GOVERNMENT_BULLETIN",
    category: "INSTITUTIONAL_BULLETIN",
    url: "https://eservicios2.aguascalientes.gob.mx/SSI/noticia.aspx",
    feedUrl: null,
    enabled: true,
    priority: 100,
    acquisitionMethod: "PUBLIC_HTML",
  },
  {
    id: "ags-official-gazette",
    organization: "Periódico Oficial del Estado de Aguascalientes",
    jurisdiction: "Aguascalientes",
    sourceType: "OFFICIAL_GAZETTE",
    category: "STATE_GAZETTE",
    url: "https://eservicios2.aguascalientes.gob.mx/PeriodicoOficial/",
    feedUrl: null,
    enabled: true,
    priority: 90,
    acquisitionMethod: "PUBLIC_HTML",
  },
  {
    id: "ags-government-portal",
    organization: "Gobierno del Estado de Aguascalientes",
    jurisdiction: "Aguascalientes",
    sourceType: "GOVERNMENT_PORTAL",
    category: "STATE_GOVERNMENT",
    url: "https://www.aguascalientes.gob.mx/",
    feedUrl: null,
    enabled: true,
    priority: 80,
    acquisitionMethod: "PUBLIC_HTML",
  },
];
