import { GangEntity, FusionResult, calculateSimilarity } from "./pandillas.mapper";
import { validateGeoIntegrity } from "../../utils/geoIntegrityEngine";

export function matchPandillasDatasetRows(
  csvRows: any[],
  nombre: string,
  zonaInfluencia: string
): any[] {
  const normalizedGangName = (nombre || "").toLowerCase().trim();
  let matchesCsv = csvRows.filter(row => {
    const gangCol = (row.Pandilla || "").toLowerCase().trim();
    return gangCol && normalizedGangName && (gangCol.includes(normalizedGangName) || normalizedGangName.includes(gangCol));
  });

  const normalizedZone = (zonaInfluencia || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (matchesCsv.length === 0 && normalizedZone) {
    matchesCsv = csvRows.filter(row => {
      const col = (row.Colonia || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const calle = (row.Calle || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return (col && (col.includes(normalizedZone) || normalizedZone.includes(col))) ||
        (calle && (calle.includes(normalizedZone) || normalizedZone.includes(calle)));
    });
  }

  return matchesCsv;
}

/**
 * Pandillas Intelligence Fusion Engine
 * Responsible for de-duplicating gangs, merging aliases, and consolidating structural relationships into networks.
 */
export function fuseGangsAndBuildGraph(
  manualGang: GangEntity,
  existingGangs: GangEntity[],
  csvMatches: { Calle: string; No: string; Colonia: string; Municipio: string; Estado: string; Lat?: string | number; Lng?: string | number }[]
): FusionResult {
  const allGangs = [manualGang, ...existingGangs];
  const uniqueGangsMap = new Map<string, GangEntity>();

  // Consolidate identical or highly similar gang names
  for (const gang of allGangs) {
    if (!gang.nombre) continue;
    let foundKey = "";
    for (const key of uniqueGangsMap.keys()) {
      if (calculateSimilarity(key, gang.nombre) > 0.8) {
        foundKey = key;
        break;
      }
    }

    if (foundKey) {
      const existing = uniqueGangsMap.get(foundKey)!;
      // Merge zones
      if (gang.zonaInfluencia && !existing.zonaInfluencia.includes(gang.zonaInfluencia)) {
        existing.zonaInfluencia += `, ${gang.zonaInfluencia}`;
      }
      // Merge antagonists
      const mergedAntagonists = Array.from(new Set([
        ...(existing.antagonicas || []),
        ...(gang.antagonicas || [])
      ]));
      existing.antagonicas = mergedAntagonists;
      // Merge members
      const memberKeys = new Set(existing.integrantes.map(m => `${m.nombre.toLowerCase()}-${m.alias.toLowerCase()}`));
      for (const member of gang.integrantes) {
        const key = `${member.nombre.toLowerCase()}-${member.alias.toLowerCase()}`;
        if (!memberKeys.has(key)) {
          existing.integrantes.push(member);
          memberKeys.add(key);
        }
      }
      // Merge graffiti
      if (gang.grafitiInfo) {
        existing.grafitiInfo = {
          texto: existing.grafitiInfo?.texto || gang.grafitiInfo.texto,
          simbolos: existing.grafitiInfo?.simbolos || gang.grafitiInfo.simbolos,
          patrones: existing.grafitiInfo?.patrones || gang.grafitiInfo.patrones,
          imageUrl: existing.grafitiInfo?.imageUrl || gang.grafitiInfo.imageUrl,
        };
      }
    } else {
      uniqueGangsMap.set(gang.nombre, {
        ...gang,
        integrantes: [...gang.integrantes],
        antagonicas: [...(gang.antagonicas || [])]
      });
    }
  }

  // Find the primary gang being analyzed
  const primaryName = manualGang.nombre || "Pandilla Desconocida";
  const primaryGang = uniqueGangsMap.get(primaryName) || {
    nombre: primaryName,
    zonaInfluencia: manualGang.zonaInfluencia || "Zona no delimitada",
    antagonicas: manualGang.antagonicas || [],
    integrantes: manualGang.integrantes || [],
    grafitiInfo: manualGang.grafitiInfo,
  };

  // Determine risk level based on members and antagonism
  let riskScore = 0;
  if (primaryGang.integrantes.length > 3) riskScore += 1;
  if (primaryGang.integrantes.length > 8) riskScore += 1;
  const primaryAnts = primaryGang.antagonicas || [];
  if (primaryAnts.length > 1) riskScore += 1;
  if (primaryAnts.length > 3) riskScore += 1;
  if (primaryGang.grafitiInfo?.simbolos || primaryGang.grafitiInfo?.patrones) riskScore += 1;

  const riskLevel: FusionResult["ficha"]["nivelRiesgo"] =
    riskScore >= 4 ? "Crítico" : riskScore === 3 ? "Alto" : riskScore === 2 ? "Medio" : "Bajo";

  // Build structural description
  let estructuraJerarquica = "Horizontal (Células dispersas)";
  let descripcionEstructura = "Estructura asociativa flexible típica de pandillas juveniles de barrio. No se observa un líder piramidal rígido, sino nodos territoriales.";
  if (primaryGang.integrantes.some(m => m.rol.toLowerCase().includes("lider") || m.rol.toLowerCase().includes("jefe"))) {
    estructuraJerarquica = "Piramidal descentralizada";
    descripcionEstructura = "Organización con liderazgos definidos por sector (palabreros o jefes de clica) que controlan la distribución de símbolos, cobro de piso o actividades ilícitas localizadas.";
  }

  // Set up network graph nodes and edges
  const nodos: FusionResult["grafo"]["nodos"] = [];
  const enlaces: FusionResult["grafo"]["enlaces"] = [];

  // 1. Primary Gang Node
  nodos.push({ id: primaryName, label: primaryName, tipo: "pandilla", risk: riskLevel });

  // 2. Members Nodes & Edges
  primaryGang.integrantes.forEach((m, idx) => {
    const mId = m.alias ? `${m.alias} (${primaryName})` : `${m.nombre} (${primaryName})`;
    const label = m.alias ? `"${m.alias}" - ${m.rol}` : `${m.nombre} - ${m.rol}`;
    nodos.push({ id: mId, label, tipo: "integrante", grupo: primaryName });
    enlaces.push({ source: mId, target: primaryName, relacion: "pertenece" });
  });

  // 3. Antagonistic Gangs Nodes & Conflict Edges
  (primaryGang.antagonicas || []).forEach((ant: string) => {
    nodos.push({ id: ant, label: ant, tipo: "pandilla", risk: "Alto" });
    enlaces.push({ source: primaryName, target: ant, relacion: "conflicto" });
  });

  // 4. Zone/Territory Node
  if (primaryGang.zonaInfluencia) {
    const zoneId = `Zona: ${primaryGang.zonaInfluencia}`;
    nodos.push({ id: zoneId, label: primaryGang.zonaInfluencia, tipo: "zona" });
    enlaces.push({ source: primaryName, target: zoneId, relacion: "actividad" });
  }

  // 5. Graffiti Node if exists
  if (primaryGang.grafitiInfo?.texto || primaryGang.grafitiInfo?.simbolos) {
    const symbolId = `Grafiti: ${primaryGang.grafitiInfo.texto || "Símbolos"}`;
    const symbolLabel = `Grafiti: ${primaryGang.grafitiInfo.texto || ""} [${primaryGang.grafitiInfo.simbolos || ""}]`;
    nodos.push({ id: symbolId, label: symbolLabel, tipo: "simbolo" });
    enlaces.push({ source: primaryName, target: symbolId, relacion: "actividad" });
  }

  // Process geolocations from matched CSV addresses
  const geolocalizacion: FusionResult["mapa"]["geolocalizacion"] = [];
  const areasCalientes: FusionResult["mapa"]["areasCalientes"] = [];

  const geoValidation = validateGeoIntegrity({
    latitude: manualGang.coordenadas?.lat,
    longitude: manualGang.coordenadas?.lng,
    source: "ANALYST_SELECTED"
  });
  const defaultLat = geoValidation.latitude;
  const defaultLng = geoValidation.longitude;

  if (csvMatches.length > 0) {
    csvMatches.forEach((match, idx) => {
      let lat = Number(match.Lat);
      let lng = Number(match.Lng);

      const itemValidation = validateGeoIntegrity({ latitude: lat, longitude: lng, source: "SOURCE_RECORD" });
      if (itemValidation.confidence !== "UNKNOWN" && itemValidation.latitude !== null && itemValidation.longitude !== null) {
        lat = itemValidation.latitude;
        lng = itemValidation.longitude;
      } else {
        return; // Skip adding point as it has no valid spatial anchor
      }

      geolocalizacion.push({
        lat,
        lng,
        descripcion: `${match.Calle || ""} ${match.No || ""}, Col. ${match.Colonia || ""}, Aguascalientes`,
      });

      areasCalientes.push({
        lat,
        lng,
        radioMetros: 0,
        intensidad: 0,
      });
    });
  } else if (primaryGang.zonaInfluencia && defaultLat !== null && defaultLng !== null) {
    // If no CSV matches but zone exists and anchor is valid, make a single central point
      geolocalizacion.push({
        lat: defaultLat,
        lng: defaultLng,
      descripcion: `Zona Delimitada: ${primaryGang.zonaInfluencia}`,
    });
      areasCalientes.push({
        lat: defaultLat,
        lng: defaultLng,
        radioMetros: 0,
        intensidad: 0,
      });
  }

  // Generate automated intelligence alerts
  const alertas: FusionResult["alertas"] = [];
  const today = new Date().toLocaleDateString("es-MX");

  if (csvMatches.length > 0) {
    alertas.push({
      tipo: "territorio",
      severidad: "Alta",
      mensaje: `Se detectaron ${csvMatches.length} domicilios históricos coincidentes en el dataset con la zona de influencia reportada.`,
      fecha: today,
    });
  }

  const ants = primaryGang.antagonicas || [];
  if (ants.length > 0) {
    alertas.push({
      tipo: "conflicto",
      severidad: "Crítica",
      mensaje: `Frontera de fricción activa identificada entre "${primaryName}" y "${ants.join(", ")}" en sectores colindantes.`,
      fecha: today,
    });
  }

  if (primaryGang.integrantes.length > 5) {
    alertas.push({
      tipo: "actor",
      severidad: "Media",
      mensaje: `Estructura de clica expandida detectada: más de 5 integrantes activos vinculados operativamente.`,
      fecha: today,
    });
  }

  if (primaryGang.grafitiInfo?.simbolos) {
    alertas.push({
      tipo: "incidente",
      severidad: "Baja",
      mensaje: `Marcaje territorial por grafiti ("${primaryGang.grafitiInfo.simbolos}") detectado. Posible expansión de marcas de control.`,
      fecha: today,
    });
  }

  return {
    ficha: {
      nombre: primaryName,
      zona: primaryGang.zonaInfluencia || "No especificada",
      integrantes: primaryGang.integrantes,
      estructuraJerarquica,
      descripcionEstructura,
      nivelRiesgo: riskLevel,
      resumenInteligencia: `La pandilla "${primaryName}" ejerce control territorial asimétrico en la zona de "${primaryGang.zonaInfluencia}". ${primaryGang.integrantes.length > 0 ? `Se identifican ${primaryGang.integrantes.length} integrantes clave con roles establecidos.` : "No se reportan integrantes plenamente identificados en esta fase."}`,
      crossCheckJuridico: `Criterios de Delincuencia Organizada (Art. 2 de la LFCDO): El grupo de 3 o más personas ("${primaryName}") organizadas de hecho para cometer delitos de forma permanente o reiterada cumple de manera preliminar con la definición de asociación delictiva del Código Penal del Estado de Aguascalientes. Se sugiere canalizar al Ministerio Público de Litigación Estratégica.`,
    },
    mapa: {
      geolocalizacion,
      areasCalientes,
      expansionTerritorial: csvMatches.length > 10 ? "Expansión Crítica (Múltiples sectores)" : csvMatches.length > 3 ? "Expansión Activa (Eje de conflicto sectorizado)" : "Contención Territorial (Focalizada)",
    },
    grafo: {
      nodos,
      enlaces,
    },
    alertas,
  };
}
