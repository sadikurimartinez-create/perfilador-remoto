# REPORT_QUALITY_GOVERNANCE_v1_1_1_CHANGELOG

## CONTROL DE CAMBIOS DE CERTIFICACIÓN CRIPTOGRÁFICA Y SEGURIDAD CEIPOL

Este documento registra las modificaciones realizadas sobre el Motor de Generación de Informes en su versión **v1.1.1 — Report Certification Engine**.

---

### 1. DETALLE DE MODIFICACIONES

#### COMPONENTE: `src/utils/reportCertificationEngine.ts` [NUEVO]
- **Cambio:** Introducción del motor de certificación con criptografía SHA-256. Implementa `DocumentHashGenerator` para serializar un payload analítico de forma canónica y determinista (alfabéticamente por claves), previniendo variaciones de timestamps y diferencias de zip del estándar Office Open XML.
- **Motivo:** Garantizar la inmutabilidad y trazabilidad analítica de los reportes emitidos. Cualquier alteración de hipótesis, conclusiones o calificaciones de calidad invalidará de forma inmediata la firma oficial.
- **Impacto:** Alto en seguridad documental. Cero regresiones en capas anteriores.

#### COMPONENTE: `src/lib/reportEngine.ts`
- **Cambio:** Integración pasiva de la orquestación del `ReportCertificationEngine` en la fase final de `DERIVE_LAYOUT`, justo después de la evaluación del `QualityAssuranceEngine` v1.1.0.
- **Motivo:** Automatizar la firma y el registro de certificación en el flujo general del sistema de inteligencia.
- **Impacto:** Bajo-Neutro. No altera la síntesis narrativa del reporte.

#### COMPONENTE: `src/lib/exportToWord.ts`
- **Cambio:** Incorporación del renderizado visual dinámico en el **ANEXO TÉCNICO C**:
  1. **Si el estado es CERTIFIED**: Inyecta una tabla formal de color verde esmeralda con el Sello Digital Institucional, identificador único de firma, Hash completo, metadatos y la representación del Código QR de validación con sus variables seguras no sensibles.
  2. **Si el estado es CERTIFICATION_BLOCKED**: Inyecta una franja visual de alto contraste con fondo salmón claro y bordes rojos alertando del veto de calidad del expediente, omitiendo cualquier código QR o firma digital.
- **Motivo:** Soportar la representación impresa verificable del estatus del reporte.
- **Impacto:** Alto en presentación visual y gobernanza institucional.

---

### 2. DIRECTRICES DE SEGURIDAD DEL CÓDIGO QR

- **Privacidad Absoluta:** El QR contiene exclusivamente información de control criptográfico: ID de certificado, hash de validez, algoritmo, versión del formato del certificado (`CEIPOL-CERT-v1`) y estatus final.
- **Cero Fugas:** Bajo ninguna circunstancia el QR incluye coordenadas de campo, nombres de analistas u operaciones operativas confidenciales.

---

### 3. EVALUACIÓN DE IMPACTO Y NO REGRESIÓN
- **Lógica Metodológica (ADR-011):** **100% Preservada** sin alteraciones.
- **Aseguramiento de Calidad v1.1.0:** Totalmente acoplado con la compuerta.
- **Pruebas de Certificación:** 6 pruebas unitarias exitosas (20/20 aserciones).
