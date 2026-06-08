export type OsintSourceLevel = "NACIONAL" | "REGIONAL" | "FEDERAL" | "ESTATAL" | "DATOS_ABIERTOS";
export type OsintSourceType = "RSS" | "SCRAPING" | "API";

export interface OsintSource {
  id: string;
  name: string;
  url: string;
  type: OsintSourceType;
  level: OsintSourceLevel;
  region?: string;
}

export const OSINT_SOURCES: OsintSource[] = [
  // ==========================================
  // NIVEL 1: NOTICIAS EN TIEMPO REAL (NATIVAS RSS)
  // ==========================================
  // Aguascalientes (Foco Principal)
  { id: "rss_ags_bi", name: "BI Noticias", url: "https://binoticias.com/rss.xml", type: "RSS", level: "REGIONAL", region: "Aguascalientes" },
  { id: "rss_ags_sol", name: "El Sol del Centro", url: "https://www.elsoldelcentro.com.mx/rss", type: "RSS", level: "REGIONAL", region: "Aguascalientes" },
  { id: "rss_ags_lja", name: "LJA.MX", url: "https://www.lja.mx/feed/", type: "RSS", level: "REGIONAL", region: "Aguascalientes" },
  { id: "rss_ags_newsweek", name: "Newsweek Aguascalientes", url: "https://newsweekespanol.com/aguascalientes/feed/", type: "RSS", level: "REGIONAL", region: "Aguascalientes" },
  { id: "rss_ags_hidro", name: "Hidrocálido Digital", url: "https://www.hidrocalidodigital.com/feed", type: "RSS", level: "REGIONAL", region: "Aguascalientes" },
  
  // Nacionales
  { id: "rss_nac_aristegui", name: "Aristegui Noticias", url: "https://editorial.aristeguinoticias.com/feed/", type: "RSS", level: "NACIONAL" },
  { id: "rss_nac_sinembargo", name: "SinEmbargo", url: "https://www.sinembargo.mx/feed/", type: "RSS", level: "NACIONAL" },
  { id: "rss_nac_proceso", name: "Proceso", url: "https://www.proceso.com.mx/feed/", type: "RSS", level: "NACIONAL" },
  { id: "rss_nac_heraldo", name: "El Heraldo de México", url: "https://heraldodemexico.com.mx/rss", type: "RSS", level: "NACIONAL" },
  { id: "rss_nac_24hrs", name: "24 Horas", url: "https://24-horas.mx/feed", type: "RSS", level: "NACIONAL" },
  { id: "rss_nac_excelsior", name: "Excélsior", url: "https://www.excelsior.com.mx/rss.xml", type: "RSS", level: "NACIONAL" },

  // ==========================================
  // NIVEL 2: GUBERNAMENTAL (REQUERIRÁ SCRAPING FUTURO)
  // ==========================================
  // Aguascalientes
  { id: "gov_ags_estado", name: "Gobierno del Estado AGS", url: "https://www.aguascalientes.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Aguascalientes" },
  { id: "gov_ags_fiscalia", name: "Fiscalía General AGS", url: "https://www.fiscalia-aguascalientes.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Aguascalientes" },
  { id: "gov_ags_ssp", name: "SSP Estatal AGS", url: "https://www.sspags.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Aguascalientes" },
  
  // Zacatecas
  { id: "gov_zac_fiscalia", name: "Fiscalía General ZAC", url: "https://fgjez.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Zacatecas" },
  { id: "gov_zac_ssp", name: "SSP ZAC", url: "https://ssp.zacatecas.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Zacatecas" },

  // Jalisco
  { id: "gov_jal_fiscalia", name: "Fiscalía del Estado JAL", url: "https://fiscalia.jalisco.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Jalisco" },
  { id: "gov_jal_ssp", name: "Secretaría de Seguridad JAL", url: "https://ss.jalisco.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Jalisco" },

  // Guanajuato
  { id: "gov_gto_fiscalia", name: "Fiscalía General GTO", url: "https://fgeguanajuato.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Guanajuato" },
  { id: "gov_gto_ssp", name: "SSP y Paz GTO", url: "https://seguridad.guanajuato.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Guanajuato" },

  // San Luis Potosí & Querétaro
  { id: "gov_slp_fiscalia", name: "Fiscalía General SLP", url: "https://fgeslp.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "San Luis Potosí" },
  { id: "gov_qro_fiscalia", name: "Fiscalía General QRO", url: "https://fgeqro.gob.mx", type: "SCRAPING", level: "ESTATAL", region: "Querétaro" },

  // Federales
  { id: "gov_fed_fgr", name: "Fiscalía General de la República", url: "https://www.fgr.org.mx", type: "SCRAPING", level: "FEDERAL" },
  { id: "gov_fed_sspc", name: "SSPC México", url: "https://www.gob.mx/sspc", type: "SCRAPING", level: "FEDERAL" },
  { id: "gov_fed_gn", name: "Guardia Nacional", url: "https://www.gob.mx/gn", type: "SCRAPING", level: "FEDERAL" },
  { id: "gov_fed_sesnsp", name: "SESNSP", url: "https://www.gob.mx/sesnsp", type: "SCRAPING", level: "FEDERAL" },
  
  // ==========================================
  // NIVEL 3: BASES DE DATOS ABIERTOS (APIs)
  // ==========================================
  { id: "api_fed_inegi", name: "INEGI API", url: "https://www.inegi.org.mx/servicios/api_indicadores.html", type: "API", level: "DATOS_ABIERTOS" },
  { id: "api_fed_denue", name: "DENUE", url: "https://www.inegi.org.mx/app/mapa/denue/", type: "API", level: "DATOS_ABIERTOS" },
  { id: "api_fed_datamx", name: "Data México", url: "https://www.economia.gob.mx/datamexico", type: "API", level: "DATOS_ABIERTOS" }
];

/**
 * Filtra las fuentes según el estado o el nivel táctico requerido.
 */
export function getOsintSources(criteria: { level?: OsintSourceLevel, type?: OsintSourceType, region?: string }): OsintSource[] {
  return OSINT_SOURCES.filter(source => {
    let matches = true;
    if (criteria.level && source.level !== criteria.level) matches = false;
    if (criteria.type && source.type !== criteria.type) matches = false;
    if (criteria.region && source.region !== criteria.region) matches = false;
    return matches;
  });
}

/**
 * Obtiene exclusivamente los feeds RSS de la región para el barrido automatizado.
 */
export function getRegionalRSSFeeds(region: string = "Aguascalientes"): OsintSource[] {
  return OSINT_SOURCES.filter(s => s.type === "RSS" && (s.region === region || s.level === "NACIONAL"));
}