import { StandardCrimeRecord } from "@/utils/statisticalIntelligenceEngineV2/models/statisticalTypes";

export interface NormalizedCrimeResult {
  delito_original: string;
  delito_homologado_SAI: string;
  nivel_confianza: number;
  reglas_aplicadas: string[];
  variables_detectadas: string[];
  requiere_revision_humana: boolean;
  tipo_homicidio?: "DOLOSO" | "CULPOSO" | "EJECUCIÓN" | "OTRO";
}

export interface NormalizationAudit {
  conteoOriginal: Record<string, number>;
  conteoHomologado: Record<string, number>;
  tablaEquivalencias: Record<string, string>;
  casosAmbiguos: { original: string; asignado: string; confianza: number; motivo: string }[];
  porcentajeConfianzaPromedio: number;
  reporteMarkdown: string;
}

export class SemanticNormalizerSAI {
  /**
   * Homologa semánticamente un delito a las 10 categorías oficiales de SAI.
   */
  public static normalize(record: any): NormalizedCrimeResult {
    const originalRaw = record.INCIDENTE ?? record.incidente ?? record.delito ?? record.DELITO ?? record.SUBTIPO ?? record.subtipo ?? record.tipo ?? record.TIPO ?? "NO ESPECIFICADO";
    const original = String(originalRaw).trim();
    
    const cleanText = (str: string) => 
      str.normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .toLowerCase()
         .trim();

    const desc = String(record.DESCRIPCION ?? record.descripcion ?? record.comentario ?? record.COMENTARIO ?? "");
    const modalidad = String(record.MODALIDAD ?? record.modalidad ?? record.violencia ?? "");
    const lugar = String(record.LUGAR ?? record.lugar ?? record.colonia ?? "");
    const objeto = String(record.OBJETO ?? record.objeto ?? record.bien_afectado ?? "");

    const originalCleaned = cleanText(original);
    const descCleaned = cleanText(desc);
    const modalidadCleaned = cleanText(modalidad);
    const lugarCleaned = cleanText(lugar);
    const objetoCleaned = cleanText(objeto);

    let delito_homologado_SAI = "ROBO A TRANSEÚNTE"; // Fallback por defecto si no se logra clasificar
    let nivel_confianza = 50;
    const reglas_aplicadas: string[] = [];
    const variables_detectadas: string[] = [];
    let requiere_revision_humana = false;
    let tipo_homicidio: NormalizedCrimeResult["tipo_homicidio"] = undefined;

    // Helper para buscar palabras clave
    const matchesAny = (text: string, keywords: string[]) => keywords.some(k => text.includes(k));

    // 1. EXTRACT CRIME MARKERS
    if (matchesAny(originalCleaned, ["casa", "habitacion", "domicili", "vivienda", "depto", "departamento", "inmueble"])) {
      variables_detectadas.push("lugar: habitacional");
    }
    if (matchesAny(originalCleaned + " " + descCleaned + " " + objetoCleaned, ["bateria", "llanta", "espejo", "placa", "copa", "autoparte", "refaccion", "acumulador"])) {
      variables_detectadas.push("objeto: autopartes");
    }
    if (matchesAny(originalCleaned + " " + descCleaned, ["cristalazo", "rompio", "vidrio", "cristal"])) {
      variables_detectadas.push("modalidad: cristalazo");
    }
    if (matchesAny(originalCleaned, ["moto", "motoneta", "motocicl"])) {
      variables_detectadas.push("vehiculo: motocicleta");
    }
    if (matchesAny(originalCleaned, ["camion", "transporte", "autobus", "colectivo", "pasajero", "ruta"])) {
      variables_detectadas.push("lugar: transporte_publico");
    }

    // 2. APPLY SEMANTIC CLASSIFICATION RULES
    
    // Rule: Homicidios
    if (matchesAny(originalCleaned, ["homicidio", "ejecucion", "asesinato", "fallecido", "occiso", "muerto", "agresion de vida"])) {
      delito_homologado_SAI = "HOMICIDIOS";
      reglas_aplicadas.push("Deducción de privación de la vida humana");
      
      if (matchesAny(originalCleaned + " " + descCleaned + " " + modalidadCleaned, ["doloso", "fuego", "bala", "disparo", "ejecut", "sicari"])) {
        tipo_homicidio = "DOLOSO";
        if (matchesAny(originalCleaned + " " + descCleaned, ["ejecut", "sicari", "ajuste"])) {
          tipo_homicidio = "EJECUCIÓN";
        }
      } else if (matchesAny(originalCleaned + " " + descCleaned + " " + modalidadCleaned, ["culposo", "accidente", "transito", "atropell"])) {
        tipo_homicidio = "CULPOSO";
      } else {
        tipo_homicidio = "OTRO";
      }
      nivel_confianza = 95;
    }
    
    // Rule: Extorsión
    else if (matchesAny(originalCleaned, ["extorsion", "piso", "amenaza economica", "secuestro virtual"])) {
      delito_homologado_SAI = "EXTORSIÓN";
      reglas_aplicadas.push("Detección de extorsión o cobro de piso");
      nivel_confianza = 95;
    }
    
    // Rule: Robo en Autotransporte Público
    else if (
      matchesAny(originalCleaned, ["camion", "transporte publico", "autobus", "ruta", "pecera"]) ||
      (matchesAny(originalCleaned, ["robo", "asalto"]) && matchesAny(lugarCleaned + " " + originalCleaned, ["transporte", "colectivo", "autobus", "camion"]))
    ) {
      delito_homologado_SAI = "ROBO EN AUTOTRANSPORTE PÚBLICO";
      reglas_aplicadas.push("Robo cometido a pasajeros o dentro de transporte público");
      nivel_confianza = 90;
    }
    
    // Rule: Robo Tipo Cristalazo
    else if (
      matchesAny(originalCleaned, ["cristalazo", "interior de vehiculo", "dentro de automovil", "objetos de vehiculo", "accesorios interiores"]) ||
      (matchesAny(originalCleaned + " " + descCleaned, ["cristalazo", "romp"]) && matchesAny(objetoCleaned + " " + descCleaned, ["laptop", "bolsa", "maleta", "celular", "mochila", "cartera"]))
    ) {
      delito_homologado_SAI = "ROBO TIPO CRISTALAZO";
      reglas_aplicadas.push("Robo mediante ruptura de cristales o sustracción de objetos del interior");
      nivel_confianza = 90;
    }
    
    // Rule: Robo de Partes de Motocicleta
    else if (
      matchesAny(originalCleaned, ["moto", "motocicleta", "motoneta"]) &&
      matchesAny(originalCleaned + " " + descCleaned + " " + objetoCleaned, ["partes", "accesorios", "piezas", "refaccion"])
    ) {
      delito_homologado_SAI = "ROBO DE PARTES DE MOTOCICLETA";
      reglas_aplicadas.push("Sustracción de componentes de motocicleta");
      nivel_confianza = 85;
    }
    
    // Rule: Robo de Motocicleta
    else if (matchesAny(originalCleaned, ["robo de motocicleta", "robo de moto", "robo motocicleta", "robo motoneta"])) {
      delito_homologado_SAI = "ROBO DE MOTOCICLETA";
      reglas_aplicadas.push("Sustracción completa de unidad motocicleta");
      nivel_confianza = 95;
    }
    
    // Rule: Robo de Partes de Vehículo
    else if (
      matchesAny(originalCleaned + " " + descCleaned + " " + objetoCleaned, ["bateria", "llantas", "espejos", "placas", "autopartes", "partes de vehiculo", "acumulador"]) &&
      !matchesAny(originalCleaned, ["moto", "motocicleta", "motoneta"])
    ) {
      delito_homologado_SAI = "ROBO DE PARTES DE VEHÍCULO";
      reglas_aplicadas.push("Sustracción de componentes externos o accesorios de vehículo automotor");
      nivel_confianza = 90;
    }
    
    // Rule: Robo de Vehículo
    else if (
      matchesAny(originalCleaned, ["robo de vehiculo", "robo vehiculo", "robo automovil", "robo auto", "robo de auto", "robo de coche", "robo coche", "robo de camioneta", "robo camioneta"]) ||
      (matchesAny(originalCleaned, ["vehiculo", "auto", "camioneta", "coche", "automovil"]) && matchesAny(originalCleaned, ["robo", "despojo"]))
    ) {
      delito_homologado_SAI = "ROBO DE VEHÍCULO";
      reglas_aplicadas.push("Sustracción completa de vehículo de 4 o más ruedas");
      nivel_confianza = 95;
    }
    
    // Rule: Robo a Casa Habitación
    else if (matchesAny(originalCleaned, ["casa", "habitacion", "domicilio", "vivienda", "departamento", "depto", "domiciliario", "casa habitacion"])) {
      delito_homologado_SAI = "ROBO A CASA HABITACIÓN";
      reglas_aplicadas.push("Ingreso ilegítimo a inmueble destinado como vivienda");
      nivel_confianza = 90;
    }
    
    // Rule: Robo a Transeúnte / Personas
    else if (
      matchesAny(originalCleaned, ["transeunte", "persona", "peaton", "asalto calle", "via publica", "cartera", "celular", "bolsa"]) ||
      matchesAny(originalCleaned, ["robo a persona", "robo persona", "despojo a transeunte"])
    ) {
      delito_homologado_SAI = "ROBO A TRANSEÚNTE";
      reglas_aplicadas.push("Apoderamiento de objetos pertenecientes a una persona en vía pública");
      nivel_confianza = 85;
    }

    // 3. CONFIDENCE AND HUMAN REVISION POLISHING
    // Exact match direct boost (using clean text)
    const directEquivalents: Record<string, string> = {
      "robo a casa": "ROBO A CASA HABITACIÓN",
      "robo casa habitacion": "ROBO A CASA HABITACIÓN",
      "robo domiciliario": "ROBO A CASA HABITACIÓN",
      "robo a domicilio": "ROBO A CASA HABITACIÓN",
      "robo vivienda": "ROBO A CASA HABITACIÓN",
      "robo a transeunte": "ROBO A TRANSEÚNTE",
      "robo a persona": "ROBO A TRANSEÚNTE",
      "asalto en via publica": "ROBO A TRANSEÚNTE",
      "robo de vehiculo": "ROBO DE VEHÍCULO",
      "robo automovil": "ROBO DE VEHÍCULO",
      "robo auto": "ROBO DE VEHÍCULO",
      "robo vehiculo": "ROBO DE VEHÍCULO",
      "robo autopartes": "ROBO DE PARTES DE VEHÍCULO",
      "robo de partes de vehiculo": "ROBO DE PARTES DE VEHÍCULO",
      "cristalazo": "ROBO TIPO CRISTALAZO",
      "robo interior vehiculo": "ROBO TIPO CRISTALAZO",
      "extorsion": "EXTORSIÓN",
      "cobro de piso": "EXTORSIÓN",
      "homicidio doloso": "HOMICIDIOS",
      "homicidio culposo": "HOMICIDIOS",
      "ejecucion": "HOMICIDIOS",
      "robo moto": "ROBO DE MOTOCICLETA",
      "robo motocicleta": "ROBO DE MOTOCICLETA",
      "robo transporte publico": "ROBO EN AUTOTRANSPORTE PÚBLICO"
    };

    if (directEquivalents[originalCleaned]) {
      delito_homologado_SAI = directEquivalents[originalCleaned];
      reglas_aplicadas.push("Coincidencia textual directa en catálogo de equivalencias");
      nivel_confianza = 100;
    }

    if (nivel_confianza < 70) {
      requiere_revision_humana = true;
      reglas_aplicadas.push("Confianza baja; requiere validación criminológica manual");
    }

    return {
      delito_original: original,
      delito_homologado_SAI,
      nivel_confianza,
      reglas_aplicadas,
      variables_detectadas,
      requiere_revision_humana,
      tipo_homicidio
    };
  }

  /**
   * Genera una auditoría de normalización completa para un conjunto de registros.
   */
  public static audit(rawRecords: any[]): NormalizationAudit {
    const conteoOriginal: Record<string, number> = {};
    const conteoHomologado: Record<string, number> = {};
    const tablaEquivalencias: Record<string, string> = {};
    const casosAmbiguos: NormalizationAudit["casosAmbiguos"] = [];
    let confianzaSum = 0;

    for (const record of rawRecords) {
      const res = this.normalize(record);
      
      conteoOriginal[res.delito_original] = (conteoOriginal[res.delito_original] || 0) + 1;
      conteoHomologado[res.delito_homologado_SAI] = (conteoHomologado[res.delito_homologado_SAI] || 0) + 1;
      
      if (!tablaEquivalencias[res.delito_original]) {
        tablaEquivalencias[res.delito_original] = res.delito_homologado_SAI;
      }

      confianzaSum += res.nivel_confianza;

      if (res.requiere_revision_humana || res.nivel_confianza < 80) {
        casosAmbiguos.push({
          original: res.delito_original,
          asignado: res.delito_homologado_SAI,
          confianza: res.nivel_confianza,
          motivo: res.reglas_aplicadas.join(" | ")
        });
      }
    }

    const total = rawRecords.length || 1;
    const porcentajeConfianzaPromedio = Math.round(confianzaSum / total);

    // Generar Reporte Markdown
    let md = `# Reporte: Auditoría de Normalización Criminal SAI\n\n`;
    md += `* **Ecosistema:** SSPE-CEIPOL / Sistema SAI\n`;
    md += `* **Fecha de Ejecución:** ${new Date().toLocaleDateString("es-MX")} ${new Date().toLocaleTimeString("es-MX")}\n`;
    md += `* **Registros Procesados:** ${rawRecords.length}\n`;
    md += `* **Nivel de Confianza Promedio:** ${porcentajeConfianzaPromedio}%\n\n`;

    md += `## 1. Conteo de Delitos Originales (Antes)\n\n`;
    md += `| Delito Original | Frecuencia |\n`;
    md += `| :--- | :--- |\n`;
    const sortedOriginals = Object.entries(conteoOriginal).sort((a, b) => b[1] - a[1]);
    for (const [del, count] of sortedOriginals.slice(0, 15)) {
      md += `| ${del} | ${count} |\n`;
    }
    if (sortedOriginals.length > 15) {
      md += `| *Y ${sortedOriginals.length - 15} delitos más...* | | \n`;
    }

    md += `\n## 2. Conteo de Delitos Homologados SAI (Después)\n\n`;
    md += `| Delito Homologado SAI | Frecuencia |\n`;
    md += `| :--- | :--- |\n`;
    const sortedHomologated = Object.entries(conteoHomologado).sort((a, b) => b[1] - a[1]);
    for (const [del, count] of sortedHomologated) {
      md += `| **${del}** | ${count} |\n`;
    }

    md += `\n## 3. Tabla de Equivalencias Generadas\n\n`;
    md += `| Delito en Base Original | Categoría Homologada Oficial SAI | Status |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const [orig, hom] of Object.entries(tablaEquivalencias).slice(0, 15)) {
      md += `| ${orig} | ${hom} | ✓ Homologado |\n`;
    }

    if (casosAmbiguos.length > 0) {
      md += `\n## 4. Casos de Alta Ambigüedad / Requiere Revisión Humana\n\n`;
      md += `| Delito Original | Categoría Asignada | Confianza | Causa/Reglas |\n`;
      md += `| :--- | :--- | :--- | :--- |\n`;
      for (const c of casosAmbiguos.slice(0, 10)) {
        md += `| ${c.original} | ${c.asignado} | ${c.confianza}% | ${c.motivo} |\n`;
      }
    }

    return {
      conteoOriginal,
      conteoHomologado,
      tablaEquivalencias,
      casosAmbiguos,
      porcentajeConfianzaPromedio,
      reporteMarkdown: md
    };
  }
}
