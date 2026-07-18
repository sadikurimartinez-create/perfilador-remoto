# ADR-MAP-EVIDENCE-CAPTURE-GOVERNANCE — FASE 7.11-C

## 1. Arquitectura de Gobernanza

La capa de captura de evidencia desde mapa (**Map Evidence Capture Layer**) implementa una arquitectura desacoplada para separar la manipulación geométrica de la adquisición documental de evidencias en el **Perfilador Remoto SSPE-CEIPOL**.

```text
                  ProjectMap (Mapa Interactivo)
                       |
             [onCandidateCapture] (Intercepción)
                       |
                       ↓
         Cintilla Temporal de Captura de Mapa
                       |
          [Doble Confirmación Obligatoria]
                       |
                       ↓
               uploadAndAddPhoto()
                       |
               [ADR-011 Governance]
                       |
           Saturación / Capping de Reportes (Máx. 4)
```

---

## 2. Flujo Operativo Desacoplado

Para evitar interrumpir o bloquear la experiencia táctica del analista mientras manipula vértices y traza polígonos:
1. **Manipulación Fluida**: El movimiento o adición de vértices en el mapa interactivo actualiza de forma instantánea la geometría (`Polygon` o `Polyline`) en tiempo real.
2. **Generación Candidata**: En segundo plano, se gatilla `onCandidateCapture` el cual formula de manera proactiva una imagen de contexto cartográfico satelital híbrida mediante la Google Static Maps API:
   ```text
   https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom=17&size=600x400&maptype=hybrid&markers=color:red|{lat},{lng}&key={API_KEY}
   ```
3. **Cintilla de Mapa**: Las capturas candidatas se encolan en la cintilla temporal de mapa de `PhotoAlbum.tsx` mostrando:
   - Miniatura estática híbrida.
   - Coordenadas georreferenciadas exactas.
   - Campos de obligatoriedad: Categoría Táctica y Comentario descriptivo.

---

## 3. Especificación de Metadatos (Gobernanza Estricta)

Toda evidencia cartográfica consolidada en el expediente electrónico cuenta con la siguiente firma técnica inalterable:

```json
{
  "source": "MAP_CAPTURE",
  "visualType": "STATIC_MAP_CONTEXT",
  "geometryType": "POLYGON" | "LINE",
  "captureMethod": "VERTEX_ADD" | "VERTEX_EDIT",
  "captureContext": "map_geometry_change",
  "createdFrom": "ProjectMap",
  "streetViewCategory": "hideout" | "graffiti" | "denue_interest" | "other",
  "streetViewSource": "Google Maps Static API",
  "analysisType": "MAP_CAPTURE",
  "validado": true,
  "relation": {
    "type": "GEOMETRY_UPDATE",
    "previousPhotoId": "xxx"
  }
}
```

> [!IMPORTANT]
> **No Contaminación**: Los metadatos de mapa están totalmente segregados de Street View. El campo `source` es estrictamente `MAP_CAPTURE` y el `visualType` es `STATIC_MAP_CONTEXT`. Bajo ninguna circunstancia se catalogan como `STREET_VIEW` para preservar la precisión funcional de la Fase 7.10.
> **Preservación Histórica**: La edición de vértices no sobrescribe evidencias previas. Se crea un nuevo registro relacionado que apunta al identificador de la evidencia previa (`relation.previousPhotoId`) para garantizar trazabilidad forense ininterrumpible.

---

## 4. Integración y Capping ADR-011

Las capturas cartográficas consolidadas ingresan directamente al expediente y son sometidas a las reglas de control de saturación de informes de **ADR-011**:
- Se conservan de manera segura el 100% de las capturas cargadas en la base de datos de Firestore.
- El visualizador y el exportador de reportes limitan dinámicamente la salida a un máximo de **4** evidencias por categoría táctica (`hideout`, `graffiti`, etc.) para asegurar reportes limpios de cluttering de geointeligencia.

---

## 5. Pruebas de Integración y Verificación

La suite de pruebas automatizadas se localiza en:
📄 **[scripts/validate_map_capture_governance.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/scripts/validate_map_capture_governance.ts)**

Cubre los siguientes casos de prueba críticos:
* **Caso 1 (Polygon Edit)**: Verificación de coordenadas y URL estática satelital híbrida.
* **Caso 2 (Line Edit)**: Verificación de corredores lineales y adición de vértices.
* **Caso 3 (Temporal Ribbon / Cancel)**: Remoción exitosa de candidatos de la cintilla temporal sin afectar el expediente.
* **Caso 4 (Album Insertion)**: Consolidación exitosa con la firma completa de metadatos, incluyendo trazabilidad de relación histórica.
* **Caso 5 (No Contaminación Street View)**: Garantiza segregación absoluta de campos de `STREET_VIEW` protegiendo las políticas institucionales.
