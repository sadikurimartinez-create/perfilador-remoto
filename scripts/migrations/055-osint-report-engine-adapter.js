const fs = require("fs");


module.exports = {

metadata:{
    description:"Crea adaptador entre OSINT Intelligence Output Contract y Report Engine",
    risk:"high",
    files:[
        "src/utils/osintReportEngineAdapter.ts"
    ]
},


async up(){


const content = `

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

\`Motor:
\${input.engine}

Decisión operacional:
\${input.decision}

Profundidad de inteligencia:
\${input.confidence.semantic}/100

Cobertura territorial:
\${input.coverage.territorial}/100\`,



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

`;



fs.writeFileSync(

"src/utils/osintReportEngineAdapter.ts",

content

);



const registry = {


engine:
"OSINT_REPORT_ENGINE_ADAPTER",


source:
"OSINTIntelligenceOutput",


target:
"Report Engine",


output:

[

"Executive Summary",

"Territorial Analysis",

"Network Findings",

"Risk Indicators"

],


status:
"READY_FOR_INTEGRATION",


createdAt:
new Date().toISOString()

};



fs.writeFileSync(

"scripts/osintReportEngineAdapter.json",

JSON.stringify(
registry,
null,
2
)

);



console.log(
"OSINT Report Engine Adapter creado correctamente"
);


}

};