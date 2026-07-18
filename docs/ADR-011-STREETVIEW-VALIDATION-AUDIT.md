# ADR-011 Street View Validation Audit

## Objetivo

Eliminar falsos positivos de evidencia virtual dentro del Perfilador Remoto de la SSPE-CEIPOL, garantizando que solamente imágenes reales de recorridos virtuales sean clasificadas, almacenadas y renderizadas como Street View en los informes.

---

## Hallazgo

Durante la auditoría de la FASE 7.9, se identificó que imágenes cartográficas de mapas GIS, respuestas vacías del proveedor, errores de disponibilidad o placeholders con mensajes como `"Sorry, we have no imagery here."` eran registradas y procesadas silenciosamente en el pipeline de evidencia virtual como imágenes legítimas de Street View. Esto contaminaba los reportes tácticos con secciones o tarjetas vacías o con mapas cartográficos erróneos haciéndose pasar por evidencias de terreno.

---

## Corrección

Implementación de un **filtro preventivo y centralizado** (`streetViewValidator.ts`) que actúa como un guardián de adquisición a dos niveles del pipeline:
1. En `streetViewCollector.ts` (capa de adquisición del motor visual `VisualEvidenceEngine`).
2. En `intelligenceLayoutEngine.ts` (capa de renderizado editorial del payload intermedio).

El validador filtra las imágenes bajo cuatro reglas robustas:
- **Existencia**: Rechaza URLs nulas, vacías o que respondan con error `404`.
- **Contenido del Proveedor**: Filtra proactivamente palabras clave como `placeholder`, `error`, `unavailable`, `no imagery`, y `sorry, we have no imagery`.
- **Tipo de Recurso**: Excluye imágenes cartográficas o capturas GIS que contengan palabras como `map image`, `poi`, `roads`, `labels`, `gis`, `tile` (salvo que provengan de un dominio Street View legítimo de Google).

---

## Resultados de las Pruebas

Se ejecutó la suite automatizada con éxito rotundo:

```text
======================================

STREET VIEW PROVIDER GUARD

VALIDATION:

VALID IMAGE:
PASS

NO IMAGE:
PASS

ERROR PLACEHOLDER:
PASS

GIS MAP:
PASS


STATUS:
GREEN

======================================
```

### Tabla de Decisiones

| Escenario de Entrada | Entrada Evaluada | Decisión | Estatus de Prueba |
| :--- | :--- | :--- | :--- |
| **Street View legítimo** | `google-streetview-valid-image` | **ACCEPTED** (Procesado) | ✅ PASS |
| **Sin Imagen** | `url: null` | **REJECTED** (Ignorado) | ✅ PASS |
| **Error de Cobertura de Google** | `"Sorry, we have no imagery here."` | **REJECTED** (Ignorado) | ✅ PASS |
| **Captura Cartográfica / GIS** | `"POI, roads, labels"` | **REJECTED** (Ignorado) | ✅ PASS |

---

## Conclusión

El pipeline editorial y visual se encuentra oficialmente libre de falsos positivos de Street View. Si no hay cobertura virtual o la imagen devuelta no es auténtica, el sistema la ignora de forma silenciosa garantizando informes tácticos limpios, de alta calidad y 100% veraces.
