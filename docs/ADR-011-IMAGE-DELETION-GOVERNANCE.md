# ADR-011 Image Deletion Governance

## Objetivo

Implementar un mecanismo transversal, unificado y obligatorio para la eliminación definitiva de cualquier evidencia fotográfica registrada en el Perfilador Remoto de la SSPE-CEIPOL, independientemente de su origen. El ciclo de vida de la evidencia debe garantizar la confirmación de la irreversibilidad de la acción y la generación de una bitácora ex-post inmutable para auditoría.

---

## Arquitectura

Para evitar la fragmentación lógica de borrado en múltiples componentes visuales, se centralizó la responsabilidad en un servicio único de gobernanza:

```text
Solicitud de eliminación (UI)
             │
             ▼
      Double Confirmation Modal
             │
             ▼
ImageDeletionGovernanceService.deleteImage
             │
             ├──────────────────────────┐
             ▼                          ▼
   Actualización Álbum          Generación Bitácora
 (Eliminación Definitiva)   (Sin URLs activas/imágenes)
```

### Componente Central

* **`ImageDeletionGovernanceService`** (`src/utils/imageDeletionGovernanceService.ts`):
  * Recibe la referencia de imagen, el ID del proyecto, el usuario y la colección de fotos actual.
  * Procesa de forma transaccional el descarte operativo y la purga de caché.
  * Produce la estructura inmutable de la bitácora de trazabilidad.

---

## Flujo de Eliminación en Pantalla

Cualquier tarjeta que renderice imágenes dentro del ecosistema (capturas de campo, Street View, entorno virtual, etc.) cuenta con un botón visible `🗑️ Eliminar`. El flujo de confirmación consta de dos etapas obligatorias:

### 1. Primera Ventana de Advertencia (Advertencia de eliminación)
Presenta una advertencia explícita sobre el alcance:
> "Está a punto de eliminar esta imagen del expediente. Esta acción eliminará la evidencia visual y toda la contextualización asociada dentro del sistema."

Muestra los metadatos contextuales:
* Origen de la imagen (Campo, Street View, etc.).
* Fecha de registro.
* Clasificación actual (Tipo de facilitador físico).
* Relación geográfica (Coordenadas georreferenciadas o indicación de ausencia).

*Botones*: `CANCELAR` / `CONTINUAR`

### 2. Segunda Ventana de Confirmación (Confirmación irreversible)
Advierte sobre la naturaleza inalterable del borrado definitivo:
> "Esta acción no puede deshacerse. Al confirmar se perderá permanentemente la imagen, su contextualización territorial, clasificación analítica y vínculos dentro del expediente."

*Botones*: `REGRESAR` / `ELIMINAR DEFINITIVAMENTE`

---

## Proceso de Eliminación Transaccional

Una vez confirmada la acción, el sistema ejecuta de forma sincrónica y transaccional:
1. **Eliminar referencia del álbum** en la subcolección de Firestore.
2. **Eliminar la relación geográfica** de la base de datos local y mapas.
3. **Eliminar la aparición en los reportes** dinámicos PDF/Word (mediante filtrado en caliente).
4. **Eliminar caché local** de renderizado en el navegador.
5. **Eliminar almacenamiento operativo** (Storage y contadores del proyecto).
6. **Registrar auditoría** en una bitácora inmutable.

---

## Modelo de Bitácora de Trazabilidad

En cumplimiento con la política de custodia digital, la bitácora **no almacena binarios, thumbnails ni URLs activas** de la imagen para evitar fugas de información.

```json
{
  "event": "IMAGE_DELETED",
  "imageId": "photo-field-1",
  "projectId": "PROJ-2026-TEST",
  "deletedBy": "Investigador.CEIPOL",
  "timestamp": 1781745100000,
  "source": "FIELD_CAPTURE",
  "previousClassification": "CRÍTICO",
  "geometryType": "polígono",
  "deletionReason": "USER_REQUEST"
}
```

---

## Pruebas Automatizadas

Se creó y ejecutó con éxito la suite de pruebas automatizadas:

`npx ts-node scripts/validate_image_deletion_governance.ts`

```text
================================

IMAGE DELETE GOVERNANCE

FIELD IMAGE:
PASS

STREET VIEW:
PASS

SUPPORTING:
PASS

CANCEL FLOW:
PASS

AUDIT LOG:
PASS


STATUS:
GREEN

================================
```

---

## Conclusión

El ciclo de vida de la evidencia fotográfica del Perfilador Remoto está formalmente bajo control técnico. Se garantiza la irreversibilidad, la consistencia a lo largo de mapas y reportes, y la trazabilidad de cada acción de borrado en conformidad estricta con las reglas de gobernanza institucional de CEIPOL.
