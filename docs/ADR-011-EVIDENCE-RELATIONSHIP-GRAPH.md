# ADR-011-EVIDENCE-RELATIONSHIP-GRAPH: CAPA DE RELACIONES ANALÍTICAS DE EVIDENCIA

## ESTADO
✅ **APROBADO & CERTIFICADO**

## CONTEXTO
Durante el desarrollo del Perfilador Remoto SSPE-CEIPOL, se ha estructurado una sólida cadena de adquisición y custodia de evidencias visuales de múltiples fuentes (campo, Street View, mapas y entornos virtuales). No obstante, para elevar la calidad criminológica de los dictámenes técnicos y las carpetas de investigación, era imperativo vincular cada pieza de evidencia física con su respectivo contexto territorial, factores de riesgo ambiental (criminógenos) e hipótesis delictivas.

## DECISIÓN ARQUITECTÓNICA
Para salvaguardar la integridad absoluta de las reglas de negocio establecidas en el motor de gobernanza congelado (**ADR-011**), se diseñó e implementó un módulo de relaciones analíticas completamente desacoplado del motor de pre-selección y ranking (`PhotoEvidenceGovernanceEngine`). 

La separación estructural queda de la siguiente manera:

```text
PHOTO EVIDENCE GOVERNANCE ENGINE (ADR-011)
              |
              | (Decide qué evidencia se publica, scorea y prioriza)
              ↓
     [Álbum de Evidencia] <--- (Bandeja transaccional de metadatos)
              ↑
              | (Explica por qué y bajo qué hipótesis es de interés)
              |
EVIDENCE RELATIONSHIP ENGINE (MÓDULO DESACOPLADO)
```

Las relaciones analíticas se almacenan y persisten de forma transaccional bajo la estructura `evidenceRelationship` en el documento de cada fotografía del subcoleccionable de Firestore `projects/{projectId}/photos/{photoId}`.

## REGLA DE NO-INFERENCIA AUTOMÁTICA (SUGERENCIAS IA PROBABILÍSTICAS)
Para cumplir con los más altos estándares de rigor en inteligencia policial y prevenir la generación de falsos positivos conceptuales, el motor de recomendaciones (`EvidenceRelationshipEngine`) se rige bajo la regla de **lenguaje estrictamente probabilístico**.

- **Permitido (Probabilístico/Indiciario)**: *"Posible facilitador..."*, *"Se identifica un indicador compatible con..."*, *"Probable zona de resguardo..."*.
- **Prohibido (Determinista/Fáctico)**: *"Este sitio es utilizado para..."*, *"La organización criminal opera en esta esquina"*, *"El inmueble pertenece a..."*.

El analista de investigación mantiene en todo momento el control definitivo para agregar, descartar o refinar estas conexiones en la interfaz de usuario.

## ESQUEMA DE DATOS (INTERFACE EvidenceRelationship)
```typescript
export interface EvidenceRelationship {
  id: string;
  evidenceId: string;
  projectId: string;
  source: "FIELD_CAPTURE" | "STREET_VIEW" | "VIRTUAL_CAPTURE" | "MAP_CAPTURE";
  geography: {
    type: "POINT" | "LINE" | "POLYGON";
    latitude?: number;
    longitude?: number;
    area?: string;
  };
  criminogenicFactors: string[];
  hypothesisLinks: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
}
```

## INTEGRACIÓN CON REPORT ENGINE
El recopilador oficial del briefing (`intelligenceLayoutEngine.ts`) consume este metadato analítico directamente del álbum para formatear de manera automatizada y estructurada el **Capítulo 5 (Evidencia Fotográfica)** en las descargas oficiales de Word y PDF.

- **Antes**: Imagen de campo + Descripción manual básica.
- **Después**: Imagen de campo + Contexto territorial georreferenciado + Lista de factores criminógenos activos + Asociación directa a hipótesis tácticas (e.g., *"Relación analítica - Hipótesis: HYP-002: Eje compatible con ruta óptima de escape radial..."*).
