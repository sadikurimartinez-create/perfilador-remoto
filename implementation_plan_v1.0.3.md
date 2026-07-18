# Plan de Implementación — Motor de Renderizado de Tablas Documentales (v1.0.3)

Este plan de implementación propone la creación de una capa especializada de renderizado de tablas (`DocumentTableRenderer`) para transformar de forma nativa tablas en formato Markdown (generadas por los modelos de IA y motores analíticos) en tablas estructuradas de Microsoft Word (`docx.Table`) con la identidad corporativa de la SSPE-CEIPOL, resolviendo el problema actual de despliegue de texto plano desestructurado.

---

## User Review Required

> [!IMPORTANT]
> **Neutralidad Metodológica y Preservación de Datos:**
> Este cambio no altera ni modifica de ninguna manera el HIE (HIE Engine), el ADR-011 (Hypothesis Ledger), ni los motores analíticos estadísticos certificados. Se enfoca de manera exclusiva en la capa editorial y de presentación documental de los dictámenes generados.

> [!TIP]
> **Gobernanza Defensiva para Tablas Corruptas:**
> En caso de que una tabla Markdown generada por la IA sufra de corrupción estructural (ej. diferente número de columnas en encabezados y filas), el motor aplicará un **Fallback de Texto Seguro**, imprimiendo el contenido de manera legible sin bloquear el proceso de exportación del dictamen.

---

## Open Questions

*No hay preguntas abiertas pendientes.* El diseño cubre de manera exhaustiva los criterios de calidad documental de la institución.

---

## Proposed Changes

La solución se dividirá de forma modular en tres componentes:

### 1. Extensión del Parser Editorial

#### [MODIFY] [editorialStructureEngine.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/editorialStructureEngine.ts)
- **Cambio:**
  - Agregar `"TABLE"` a la unión de tipos en `EditorialBlock["type"]`.
  - Modificar el ciclo principal de `parse()` para interceptar y acumular líneas que comiencen con `|` y tengan una estructura de tabla Markdown válida (ej. encabezado y segunda línea con separadores de tipo `|---|`).
  - Consumir secuencialmente todas las líneas de la tabla en un solo bloque de tipo `"TABLE"`, guardando el texto completo en `block.text`.
  - Esto garantiza que `assertSemanticPreservation()` pase con **0% de desviación**, manteniendo la preservación absoluta de información analítica.

---

### 2. Creación del Renderizador Especializado

#### [NEW] [documentTableRenderer.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/utils/documentTableRenderer.ts)
- **Responsabilidad:** Detectar, parsear, validar y renderizar tablas Markdown en tablas nativas de `docx`.
- **Estructura Interna:**
  - `isMarkdownTable(text: string): boolean`: Detecta si un fragmento de texto representa una tabla Markdown estructurada.
  - `parseMarkdownTable(markdown: string): ParsedTable`: Divide los encabezados, analiza la alineación (izquierda, derecha, centro) de cada columna en función de los separadores de la segunda línea, y segmenta las filas de celdas.
  - `validateTableStructure(parsed: ParsedTable): boolean`: Verifica que exista al menos una fila de encabezados y que cada fila contenga exactamente el mismo número de columnas que el encabezado.
  - `renderMarkdownTable(markdown: string): Table | Paragraph`: Orquesta el proceso. Si la tabla pasa la validación estructural, genera una `docx.Table` institucional; en caso de corrupción, retorna un párrafo de texto normal como fallback de seguridad.
- **Diseño Estético Institucional CEIPOL:**
  - **Encabezados:** Negritas, texto blanco (`"FFFFFF"`), fondo azul institucional (`"0D2B52"`), tipografía Calibri, alineación correspondiente.
  - **Cuerpo:** Tipografía Calibri, tamaño de fuente 10pt (`size: 20`) o 10.5pt para máxima legibilidad, alineación según configuración de columna.
  - **Zebra Striping (Sombreado Alterno):** Filas alternas con un fondo sutil gris-azul (`"F8FAFC"`) para mejorar el contraste.
  - **Bordes:** Borde exterior en azul institucional (`"0D2B52"`, tamaño 8) e interior en gris suave (`"E2E8F0"`, tamaño 4).
- **Controles de Maquetación de Página:**
  - **Evitar rupturas de filas (`cantSplit: true`):** Evita que una celda se corte horizontalmente en el salto de página, manteniendo el contenido de la fila íntegro.
  - **Repetición de Encabezado (`header: true`):** Repite de forma automática los encabezados de la tabla en cada página subsiguiente si la tabla se extiende más allá de una página.

---

### 3. Integración en el Flujo de Compilación Documental

#### [MODIFY] [exportToWord.ts](file:///C:/Users/sadi7/OneDrive/Desktop/ECOSISTEMA%20SAI/PERFIL%20REMOTO/src/lib/exportToWord.ts)
- **Cambio:**
  - Importar `renderMarkdownTable` desde `@/utils/documentTableRenderer`.
  - Modificar la firma de tipo de `renderEditorialText` para que retorne `any[]` o `(Paragraph | Table)[]`.
  - Agregar un caso `"TABLE"` en el switch de tipo de bloque dentro de `renderEditorialText`:
    ```typescript
    case "TABLE":
      if (block.text) {
        paragraphs.push(renderMarkdownTable(block.text) as any);
      }
      break;
    ```
  - Esto integra las tablas nativas de forma transparente en todos los capítulos del reporte que utilicen el motor editorial estructural (Capítulo 1, Capítulo 2, etc.), logrando una excelente modularidad con cero modificaciones a la estructura de capítulos existente.

---

## Verification Plan

### Automated Tests
Desarrollaremos un script de prueba exhaustivo en **`scratch/test_documentTableRenderer.ts`** para evaluar de forma aislada los cuatro escenarios requeridos:

- **Caso 1 (Tabla Simple):** Verifica el parseo correcto de una tabla estándar y la aplicación de los estilos corporativos de CEIPOL.
- **Caso 2 (Alineación y Números):** Evalúa el reconocimiento de alineación en los separadores (`:---`, `:---:`, `---:`) y su aplicación en la celda correspondiente.
- **Caso 3 (Control de Salto de Página):** Comprueba que las propiedades de repetición de encabezado (`header: true`) y prevención de rupturas de fila (`cantSplit: true`) estén correctamente asignadas.
- **Caso 4 (Markdown Corrupto):** Valida que una tabla mal formada (con desalineación de columnas) se renderice de forma segura mediante un fallback de párrafo de texto continuo sin lanzar excepciones que detengan el proceso.

Comando para ejecutar pruebas:
```powershell
npx tsx scratch/test_documentTableRenderer.ts
```

Verificación estática global:
```powershell
npx tsc --noEmit
```

### Manual Verification
1. Ejecutar la auditoría de producción mediante `npx tsx scratch/audit_geronimo_e2e.ts`.
2. Validar que la compilación de la Avenida Gerónimo de la Cueva complete con éxito el 100% de las fases y emita el certificado `CERTIFIED`.
3. Abrir el dictamen Word generado y comprobar la presentación visual premium de las tablas nativas sin remanentes de marcas de tuberías (`|`).
