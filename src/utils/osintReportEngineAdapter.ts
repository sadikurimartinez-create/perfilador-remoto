

import {
OSINTIntelligenceOutput
} from "./osintIntelligenceOutputContract";



export interface OSINTReportSection {


title:string;


summary:string;


confidence:number;


sources:Array<any>;


territorialFindings:Array<any>;


networkFindings:Array<any>;


riskIndicators:Array<any>;


}



export function createOSINTReportSection(
input:OSINTIntelligenceOutput
):OSINTReportSection{


return {


title:
"Análisis OSINT e Inteligencia Territorial",



summary:

`Motor:
${input.engine}

Decisión operacional:
${input.decision}

Profundidad de inteligencia:
${input.confidence.semantic}/100

Cobertura territorial:
${input.coverage.territorial}/100`,



confidence:
input.confidence.overall,



sources:
input.sources || [],



territorialFindings:

input.findings.locations || [],



networkFindings:

input.findings.organizations || [],



riskIndicators:

input.findings.riskIndicators || []



};


}

