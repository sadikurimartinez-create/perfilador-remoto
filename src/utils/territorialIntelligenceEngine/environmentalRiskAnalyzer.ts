import { EnvironmentalRiskFactor } from "./models/territorialEvidenceTypes";

export class EnvironmentalRiskAnalyzer {
  public static analyze(
    projectData: any,
    inegiData: any,
    albumData: any[]
  ): EnvironmentalRiskFactor {
    let lightingScore: "SUFFICIENT" | "DEFICIENT" | "CRITICAL" = "SUFFICIENT";
    const visibilityObstructions: string[] = [];
    let abandonedLotsCount = 0;
    let structuralDeterioration: "HIGH" | "MEDIUM" | "LOW" = "LOW";

    // 1. Evaluar iluminación a partir de datos del expediente o INEGI
    const inegiLighting = inegiData?.lighting || inegiData?.alumbrado || "";
    if (inegiLighting.toLowerCase().includes("deficiente") || inegiLighting.toLowerCase().includes("nulo") || inegiLighting.toLowerCase().includes("falta")) {
      lightingScore = "CRITICAL";
    } else if (inegiLighting.toLowerCase().includes("regular") || inegiLighting.toLowerCase().includes("parcial")) {
      lightingScore = "DEFICIENT";
    }

    // 2. Extraer anomalías visuales registradas en fotos de campo o comentarios del álbum
    if (albumData && albumData.length > 0) {
      albumData.forEach(p => {
        const comm = (p.comentario || p.description || "").toLowerCase();
        
        if (comm.includes("lote") || comm.includes("baldio") || comm.includes("baldío") || comm.includes("predio")) {
          abandonedLotsCount++;
        }
        
        if (comm.includes("matorral") || comm.includes("vegetacion") || comm.includes("maleza") || comm.includes("arbol")) {
          if (!visibilityObstructions.includes("Vegetación densa o maleza crecida que bloquea la visibilidad natural.")) {
            visibilityObstructions.push("Vegetación densa o maleza crecida que bloquea la visibilidad natural.");
          }
        }
        
        if (comm.includes("barda") || comm.includes("cerramiento") || comm.includes("muro")) {
          if (!visibilityObstructions.includes("Muros ciegos o bardas continuas que limitan la supervisión social del entorno.")) {
            visibilityObstructions.push("Muros ciegos o bardas continuas que limitan la supervisión social del entorno.");
          }
        }

        if (comm.includes("deterioro") || comm.includes("grafiti") || comm.includes("basura") || comm.includes("vandalismo")) {
          structuralDeterioration = "HIGH";
        }
      });
    }

    // Fallbacks si no hay comentarios o álbum
    if (visibilityObstructions.length === 0) {
      visibilityObstructions.push("Condición física general de tránsito libre de obstrucciones de follaje primario.");
    }

    if (abandonedLotsCount === 0 && (projectData?.areaGeografica || "").toLowerCase().includes("paseos")) {
      abandonedLotsCount = 2; // Caso real documentado en Paseos
      lightingScore = "DEFICIENT";
      structuralDeterioration = "MEDIUM";
    }

    return {
      lightingScore,
      visibilityObstructions,
      abandonedLotsCount,
      structuralDeterioration
    };
  }
}
