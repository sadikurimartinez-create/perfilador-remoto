/**
 * Evidence-Inference Compatibility Matrix (ADR-010 - INDE)
 * Valida la consistencia lógica y legal de las conclusiones criminológicas
 * a partir de la evidencia física certificada en el expediente.
 */

export interface MatrixValidationResult {
  isValid: boolean;
  violations: string[];
}

export interface CompatibilityRule {
  evidenceKeyword: string;
  evidenceName: string;
  allowedKeywords: string[];
  prohibitedKeywords: string[];
  errorMessage: string;
}

export class EvidenceInferenceMatrix {
  private static RULES: CompatibilityRule[] = [
    {
      evidenceKeyword: "graffiti",
      evidenceName: "Graffiti / Pinta de Bardas",
      allowedKeywords: [
        "expresión gráfica territorial",
        "marca gráfica",
        "vandalismo",
        "deterioro urbano",
        "apropiación simbólica",
        "comunicación visual"
      ],
      prohibitedKeywords: [
        "célula criminal confirmada",
        "grupo delictivo organizado",
        "base de operaciones del cártel",
        "control absoluto",
        "estructura criminal activa"
      ],
      errorMessage: "El graffiti/pinta representa una apropiación simbólica o expresión gráfica; no faculta diagnosticar de forma conclusiva la presencia o el control de una célula del crimen organizado."
    },
    {
      evidenceKeyword: "maleza",
      evidenceName: "Maleza Alta / Predio en Abandono",
      allowedKeywords: [
        "pérdida de vigilancia natural",
        "condición de vulnerabilidad",
        "ocultamiento temporal",
        "facilitador ambiental",
        "deterioro físico"
      ],
      prohibitedKeywords: [
        "punto de operación delincuencial",
        "casa de seguridad",
        "centro de acopio criminal",
        "zona de distribución"
      ],
      errorMessage: "La maleza alta o el descuido físico representan pérdida de vigilancia natural y vulnerabilidad física; es una sobreinferencia catalogarlo como un punto de operación criminal activo sin pruebas adicionales."
    },
    {
      evidenceKeyword: "luminaria",
      evidenceName: "Baja Iluminación / Falla de Alumbrado",
      allowedKeywords: [
        "baja vigilancia natural",
        "percepción de inseguridad",
        "reducción de visibilidad",
        "oportunidad delictiva"
      ],
      prohibitedKeywords: [
        "zona controlada por delincuentes",
        "ruta de escape de la banda",
        "punto de asalto sistemático"
      ],
      errorMessage: "La falla de alumbrado público es un factor de oportunidad de baja vigilancia; no justifica por sí sola declarar un control delictivo sistemático."
    },
    {
      evidenceKeyword: "vehículo abandonado",
      evidenceName: "Vehículo en Estado de Abandono",
      allowedKeywords: [
        "deterioro urbano",
        "vulnerabilidad territorial",
        "condición de abandono",
        "obstrucción vial"
      ],
      prohibitedKeywords: [
        "punto de vigilancia criminal",
        "coche bomba",
        "base de operaciones móvil"
      ],
      errorMessage: "Un vehículo abandonado denota desatención y deterioro físico urbano; catalogarlo como una base o punto de vigilancia criminal activa requiere de peritaje previo."
    },
    {
      evidenceKeyword: "lote baldío",
      evidenceName: "Lote Baldío / Terreno Desocupado",
      allowedKeywords: [
        "condición de vulnerabilidad",
        "pérdida de control ambiental",
        "riesgo de acumulación de residuos",
        "espacio compatible con tránsito disuasivo"
      ],
      prohibitedKeywords: [
        "punto de vigilancia",
        "casa de seguridad",
        "zona de exclusión policial",
        "guarida de delincuentes"
      ],
      errorMessage: "Un lote baldío es un terreno desocupado vulnerable; concluir sin pruebas físicas que es un punto de vigilancia u ocultamiento de delincuentes activos viola la prudencia analítica."
    }
  ];

  /**
   * Analiza un bloque de texto para detectar violaciones a la matriz de compatibilidad Evidencia-Inferencia.
   */
  public static validate(text: string): MatrixValidationResult {
    const violations: string[] = [];
    const lowerText = text.toLowerCase();

    for (const rule of this.RULES) {
      // 1. Si se menciona la evidencia física
      if (lowerText.includes(rule.evidenceKeyword)) {
        // 2. Comprobar si se utiliza alguna de las inferencias inválidas / prohibidas para esa evidencia
        for (const prohibited of rule.prohibitedKeywords) {
          if (lowerText.includes(prohibited)) {
            violations.push(
              `[VIOLACIÓN DE MATRIZ - ${rule.evidenceName}]: Se vinculó la evidencia con la inferencia proscrita "${prohibited}". ${rule.errorMessage}`
            );
          }
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }
}
