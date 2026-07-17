# Auditoría Previa e Inventario Visual — UI-05.5.C

## Consolas Operativas y Captura de Evidencia (CEIPOL Design System)

**Gobernanza UX / CEIPOL Design System**  
**Proyecto:** Perfilador Remoto SSPE-CEIPOL  
**Área de Intervención:** `ExecutiveDashboard.tsx` + `CaptureAndAddPhoto.tsx`  
**Estado:** 🟢 **AUTORIZADO PARA PLANIFICACIÓN**

---

# 1. Propósito de la Intervención

Este documento de pre-auditoría establece de forma rigurosa la línea base visual de los componentes `ExecutiveDashboard.tsx` (Consola Ejecutiva) y `CaptureAndAddPhoto.tsx` (Módulo de Carga GPS in-situ). El objetivo es catalogar y programar la remoción de la deuda visual acumulada sin alterar la lógica de captura, coordenadas EXIF, telemetrías ni consultas a la base de datos de Firestore.

---

# 2. Inventario de Componentes y Deuda Visual

## Componente A: `src/components/ExecutiveDashboard.tsx`

### Estado Actual:
*   **Contenedor Base (Línea 72):** Usa un fondo opaco sólido estándar de Tailwind (`bg-slate-950 border border-slate-700 rounded-xl`). Carece del patrón glassmorphic CEIPOL.
*   **Botón de Entrenamiento IA (Línea 79):** Botón plano con color de desarrollo (`bg-purple-700 hover:bg-purple-600 text-white rounded-lg`). Usa una llamada `alert()` nativa bloqueante para indicar el estado del feature.
*   **Tarjetas Métricas (Líneas 147-194):** 4 tarjetas apiladas verticalmente usando un fondo gris estándar (`bg-slate-800 rounded-lg p-4`). Ocupan espacio excesivo sin estructura de panel.
*   **Contenedores de Gráficos (Líneas 199 y 234):** Dos divs de tamaño fijo apilados verticalmente con fondo gris sólido (`bg-slate-800`). No aprovechan la estructura de dos columnas horizontales en pantallas grandes.

---

## Componente B: `src/components/CaptureAndAddPhoto.tsx`

### Estado Actual:
*   **Banner de Validación de Geometría (Línea 418):** Un div con bordes planos y colores básicos de Tailwind (`border border-amber-500 bg-amber-950/40 p-3`). No aprovecha el sistema dinámico de `<CEIPOLCard variant="alert">`.
*   **Alerta de Carga de Evidencia Complementaria (Línea 406):** Emplea un diálogo `alert()` nativo del navegador tras finalizar la carga de documentos de gabinete.
*   **Sección de Ingreso Manual (Línea 474):** Tarjeta con estilos planos (`border border-sky-500 bg-slate-800`) y 3 botones rústicos estándar (`Obtener Mi Ubicación Actual`, `Guardar y Subir`, `Cancelar`).
*   **Contenedor Principal (Línea 449):** Sección rústica con borde plano (`card p-4 md:p-6 space-y-4`).

---

# 3. Plan de Homologación Visual (Propuesta Técnica)

### Componente A: `ExecutiveDashboard.tsx`
1.  **Inyección de `CEIPOLToast`:** Agregar el estado reactivo `toast` y el componente correspondiente al final de la renderización.
2.  **Migración de Botones de IA:** Convertir el disparador del modelo de IA a un `<CEIPOLButton>` con inyección de toast informativo en vez de la alerta nativa.
3.  **Modernización de Métricas en Rejilla:** Reestructurar las 4 tarjetas métricas a un formato grid adaptativo (`grid grid-cols-2 lg:grid-cols-4`) con fondos translúcidos y textos de alta densidad técnica.
4.  **Rejilla de Gráficos:** Convertir los dos bloques de gráficos en un diseño colateral (`grid grid-cols-1 lg:grid-cols-2`) usando `<CEIPOLCard variant="glass">` para unificar el aspecto con el resto de las consolas operativas.

### Componente B: `CaptureAndAddPhoto.tsx`
1.  **Integración de `CEIPOLToast`:** Agregar soporte para notificaciones flotantes en el flujo de carga in-situ (erradicando la alerta de la línea 406).
2.  **Actualización de Banners de Geometría:** Reemplazar el cuadro de advertencia manual por `<CEIPOLCard variant="alert">` con bordes ámbar.
3.  **Rediseño de Entrada Manual:** Homologar la consola de coordenadas manuales usando un contenedor translúcido y migrando los 3 botones a variantes oficiales de `<CEIPOLButton>`.

---

# 4. Restricciones y Reglas de Oro (Cero Alteración Operativa)

*   ❌ **NO** modificar la lógica de captura mediante input de archivo ni el disparador de cámara del móvil (`capture="environment"`).
*   ❌ **NO** alterar la extracción de metadatos `exifr` ni la validación cruzada con tolerancia de 100 metros.
*   ❌ **NO** alterar los permisos del sensor de geolocalización física ni la latencia del timeout (40s).
*   ❌ **NO** modificar llamadas a APIs ni almacenamiento en Firebase Storage.

---

# 5. Plan de Verificación

*   [ ] Ejecución de `npx tsc --noEmit` para verificar tipos.
*   [ ] Ejecución de `npm run build` para asegurar la empaquetación limpia de Next.js.
