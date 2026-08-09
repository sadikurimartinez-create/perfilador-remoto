import {
OSINTIntelligenceOutput
} from "./osintIntelligenceOutputContract";


export interface OSINTNarrativeBlock {

title:string;

executiveNarrative:string;

keyFindings:Array<string>;

confidenceStatement:string;

operationalAssessment:string;

}



export function createOSINTNarrativeBlock(
input:OSINTIntelligenceOutput
):OSINTNarrativeBlock{


const confidence =
input.confidence?.overall || 0;


const semanticDepth =
input.confidence?.semantic || 0;


const territorial =
input.coverage?.territorial || 0;



return {


title:
"Análisis OSINT Territorial y de Inteligencia",



executiveNarrative:

`El análisis OSINT ejecutado mediante el motor ${input.engine} permitió integrar información proveniente de fuentes abiertas y proveedores especializados.

La evaluación semántica determinó una profundidad de inteligencia de ${semanticDepth}/100 y una relevancia territorial de ${territorial}/100.

La información obtenida presenta un nivel de confianza global de ${confidence}/100 y debe ser considerada dentro de un proceso de correlación con otras fuentes de inteligencia institucional.`,



keyFindings:[

`Decisión operacional: ${input.decision}`,

`Profundidad semántica: ${semanticDepth}/100`,

`Cobertura territorial: ${territorial}/100`,

`Fuentes analizadas: ${input.sources?.length || 0}`

],



confidenceStatement:

`Nivel de confianza calculado: ${confidence}/100`,



operationalAssessment:

input.decision === "SEMANTICALLY_VALIDATED"

?

"Los resultados presentan consistencia suficiente para incorporarse como elemento analítico dentro del informe de inteligencia."

:

"Los resultados requieren revisión adicional antes de considerarse evidencia analítica principal."


};


}