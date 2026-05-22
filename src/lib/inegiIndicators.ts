export type InegiDemographics = {
  exito: boolean;
  municipioNombre: string;
  poblacionTotal: string;
  datosExtra: string;
};

// Catálogo de Claves Geoestadísticas de Aguascalientes (INEGI)
const AGS_MUNICIPIOS: Record<string, string> = {
  "aguascalientes": "01001",
  "asientos": "01002",
  "calvillo": "01003",
  "cosío": "01004",
  "cosio": "01004",
  "jesús maría": "01005",
  "jesus maria": "01005",
  "pabellón de arteaga": "01006",
  "pabellon de arteaga": "01006",
  "rincón de romos": "01007",
  "rincon de romos": "01007",
  "san josé de gracia": "01008",
  "san jose de gracia": "01008",
  "tepezalá": "01009",
  "tepezala": "01009",
  "el llano": "01010",
  "san francisco de los romo": "01011"
};

const INEGI_TOKEN = process.env.INEGI_API_TOKEN || "5333be08-38e0-47c9-845a-76e4d12e3adb";

// Indicador 1002000001 = Población Total (Censo)
const ID_POBLACION = "1002000001"; 

export async function getInegiDemographics(municipio: string | null, estado: string | null): Promise<InegiDemographics> {
  if (!municipio) {
    return { exito: false, municipioNombre: "Desconocido", poblacionTotal: "N/A", datosExtra: "" };
  }

  const municipioNormalizado = municipio.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const estadoNormalizado = estado?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Por ahora limitamos el enfoque detallado al estado de Aguascalientes
  let claveGeo = AGS_MUNICIPIOS[municipioNormalizado];
  
  if (!claveGeo) {
    // Si no es AGS o no se encuentra, devolvemos un fallback genérico para que la IA asuma datos nacionales urbanos
    return { 
      exito: false, 
      municipioNombre: municipio, 
      poblacionTotal: "No disponible vía API", 
      datosExtra: "Aplicar promedios urbanos de desempleo (aprox. 3.5%) y población joven (aprox. 25%) según contexto." 
    };
  }

  const url = `https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/${ID_POBLACION}/es/${claveGeo}/false/BISE/2.0/${INEGI_TOKEN}?type=json`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": "PerfiladorRemoto/1.0" } });
    if (!res.ok) throw new Error(`Error API INEGI: ${res.status}`);
    
    const data = await res.json();
    const series = data?.Series?.[0];
    const obs = series?.OBSERVATIONS?.[0]; // Toma el dato más reciente
    
    const poblacion = obs?.OBS_VALUE ? Number(obs.OBS_VALUE).toLocaleString("es-MX") : "Dato no localizado";

    return {
      exito: true,
      municipioNombre: municipio,
      poblacionTotal: poblacion,
      datosExtra: "Al analizar la colonia, considere la densidad poblacional del municipio y cruce con vulnerabilidades macro (desocupación histórica del 3-4% y alta concentración de población joven de 15 a 29 años)."
    };

  } catch (err) {
    console.error("[inegiIndicators] Fallo al consultar INEGI:", err);
    return { exito: false, municipioNombre: municipio, poblacionTotal: "Error de conexión", datosExtra: "" };
  }
}