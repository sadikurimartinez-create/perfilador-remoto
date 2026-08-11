\# ADR-013 — Document Engine Architecture v1.0



\## Estado



PROPUESTO



\## Fecha



2026-08-11



\## Contexto



El Sistema de Inteligencia Criminal SSPE-CEIPOL Perfilador Remoto cuenta actualmente con motores especializados para generación narrativa, gobernanza editorial, validación estructural y exportación documental.



Componentes existentes:



\- IntelligenceNarrativeSynthesisEngine

\- IntelligenceReportStructureEngine

\- ReportQualityGate

\- ReportCertificationEngine

\- IntelligenceLayoutEngine

\- exportToWord.ts

\- generación PDF programática



Actualmente la responsabilidad documental se encuentra distribuida dentro de reportEngine.ts y los módulos de exportación.



Esta arquitectura genera acoplamiento entre:



1\. Construcción del análisis de inteligencia.

2\. Validación editorial.

3\. Renderizado físico del documento.



\## Problema



El ReportEngine concentra responsabilidades que deben estar separadas:



\- Generación de inteligencia.

\- Control de calidad.

\- Preparación documental.

\- Renderizado Word.

\- Renderizado PDF.



Esto dificulta:



\- Evolución del diseño institucional.

\- Control editorial.

\- Incorporación de nuevos formatos.

\- Auditoría del ciclo documental.



\## Decisión



Crear una capa independiente denominada:



Document Engine v1.0



Responsable exclusivamente de transformar un payload certificado de inteligencia en un paquete documental listo para renderización.



\## Arquitectura propuesta



ReportEngine



↓



DocumentEngine



↓



Renderers:



\- Word Renderer

\- PDF Renderer



\## Principios



1\. No modificar la narrativa certificada.

2\. No alterar evidencias.

3\. No modificar reglas de gobernanza existentes.

4\. No sustituir IntelligenceReportStructureEngine.

5\. No sustituir ReportQualityGate.

6\. Mantener compatibilidad con exportación actual.



\## Contrato inicial



Entrada:



\- IntelligenceEditorialPayload

\- IntelligenceBriefing

\- StructureAudit

\- CertificationState



Salida:



DocumentPackage



Contendrá:



\- metadata institucional

\- capítulos estructurados

\- bloques editoriales

\- evidencias asociadas

\- elementos visuales

\- certificación



\## Componentes fuera de alcance



Esta fase NO modifica:



\- HIE Engine

\- ACE Engine

\- Evidence Governance Engine

\- OSINT Engine

\- GEOINT Engine

\- exportToWord.ts



\## Plan de implementación



Fase 1:

Crear interfaces y estructura base.



Fase 2:

Integrar DocumentEngine como capa intermedia.



Fase 3:

Migrar renderizadores existentes.



Fase 4:

Auditoría E2E.



\## Estado esperado



El sistema deberá conservar exactamente la misma salida funcional mientras mejora la separación arquitectónica.

