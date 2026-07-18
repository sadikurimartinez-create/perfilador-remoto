# ADR-011 Virtual Capture Governance (FASE 7.11-B)

## Objetivo

Implementar un mecanismo unificado que permita a una persona investigadora criminal realizar exploraciones a pie de calle en el entorno virtual (Google Street View), capturar vistas de forma temporal en una cintilla de pre-selección, editar su taxonomía táctica, y finalmente incorporarlas de forma transaccional al expediente de inteligencia, pasando automáticamente por el motor de gobernanza **ADR-011** (Photo Evidence Governance Engine).

---

## Arquitectura

El flujo arquitectónico diseñado garantiza que ninguna captura virtual contamine el expediente de manera automática. Todas las evidencias virtuales pasan por un estado de pre-selección local (Cintilla Temporal) antes de ser persistidas en Firestore y Storage:

```text
Google Street View (Navegación en vivo)
             │
             ▼
     [📷 Capturar Vista]
             │
             ▼
    Cintilla Temporal (Estado local React)
    ├─ Edición de Categoría Táctica (hideout, graffiti, etc.)
    └─ Edición de Comentarios (Obligatorio)
             │
             ▼
    [📥 Incorporar Capturas]
             │
             ▼
     Descarga de Imagen vía Proxy → Compresión → Carga a Storage
             │
             ▼
      Registro en Firestore con Metadatos Completos
             │
             ▼
      Auto-Selección y Procesamiento por ADR-011
```

---

## Componentes Implementados

### 1. Captura de Vista y Estado Local (`PhotoAlbum.tsx`)
* Se integró el estado reactivo `activePanorama` para conservar la instancia activa del visor de Street View.
* Se agregó la función de captura que recupera de forma dinámica la posición actual (`latitude, longitude`) y el punto de vista (`heading, pitch, zoom`) para formular la URL de la API Estática de Google Street View de manera precisa usando el API Key institucional.
* Se agregó la cintilla temporal `temporaryCintilla` para administrar las pre-capturas.

### 2. Cintilla Temporal de Pre-Selección (`PhotoAlbum.tsx`)
Renderizado como un carrusel dinámico inmediatamente debajo del visor, cada tarjeta en la cintilla temporal provee controles interactivos:
* **Previsualización de Imagen**: Renderizado en miniatura de la vista capturada.
* **Clasificación Táctica**: Selector de tipo de facilitador de entorno:
  * `hideout` (Lugar de acecho o escondite)
  * `graffiti` (Grafiti de pandilla)
  * `denue_interest` (Punto de interés DENUE)
  * `other` (Otros / Sin clasificar)
* **Comentario / Observación**: Campo de texto tipo `textarea` de llenado **obligatorio** para describir el elemento sospechoso observado.
* **Eliminar (`❌`)**: Permite purgar elementos individuales de la pre-selección antes de incorporarlos permanentemente.

### 3. Integración Directa de Metadatos en Carga (`ProjectContext.tsx` y `PhotoAlbum.tsx`)
* Se mejoró la función `uploadAndAddPhoto` de `ProjectContext.tsx` para admitir y persistir los metadatos específicos de Street View en la primera escritura de Firestore (eliminando consultas ex-post ineficientes):
  * `streetViewCategory`
  * `streetViewSource`
  * `analysisType`
* El botón principal `📥 Incorporar Capturas al Expediente (ADR-011)` ejecuta de forma asíncrona la descarga mediante el proxy, la conversión a blob JPEG, compresión de tamaño, carga física a Storage, persistencia en Firestore y la auto-selección inmediata.

---

## Validación de Gobernanza ADR-011 (Capping y Control de Cluttering)

Al incorporarse de forma definitiva, las imágenes heredan la taxonomía táctica y pasan por las restricciones de almacenamiento y reporte de la congelada **ADR-011**:
* Si un analista incorpora un volumen elevado de capturas de la misma categoría (p. ej., 6 capturas de `hideout`), el visualizador y el generador de reportes Word/PDF limitan dinámicamente la visualización a un máximo de **4** (Capped at 4) para evitar la contaminación geointeligente y la sobrecarga del reporte.
* Las capturas excedentes permanecen preservadas en el expediente digital pero bajo un estatus de ocultación inteligente (Capped), garantizando el cumplimiento de la directiva *"No eliminar evidencia masiva pero no saturar reportes"*.

---

## Resultados de Pruebas Automatizadas

Se creó y ejecutó con éxito la suite de pruebas unitarias y de gobernanza:

`npx ts-node scripts/validate_virtual_capture_governance.ts`

```text
================================

VIRTUAL CAPTURE GOVERNANCE

STATIC URL GENERATION:
PASS

TEMPORAL CINTILLA CONTROLS:
PASS

ALBUM INCORPORATION META:
PASS

ADR-011 CAPPING & CLUTTERING INTEGRITY:
PASS


STATUS:
GREEN

================================
```

---

## Conclusión

La Fase 7.11-B transforma la exploración espacial virtual en una fuente estructurada, controlada y gobernada de evidencias para el Perfilador Remoto. Ninguna imagen virtual ingresa al expediente sin una clasificación criminológica y justificación obligatoria por parte del analista, y la integración respeta el capping táctico de ADR-011 al 100%.
