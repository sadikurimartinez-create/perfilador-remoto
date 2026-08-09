const fs = require("fs");


module.exports = {

metadata:{
    description:"Crea conector entre OSINT Narrative Intelligence Layer y Report Engine Chapter Builder",
    risk:"high",
    files:[
        "src/utils/osintNarrativeReportConnector.ts"
    ]
},


async up(){


const content = `

import {
OSINTNarrativeBlock
} from "./osintNarrativeIntelligenceLayer";



export interface OSINTReportChapter {


chapterTitle:string;


executiveSummary:string;


analyticalFindings:Array<string>;


confidenceLevel:string;


operationalConclusion:string;


metadata:{


source:string;


generatedAt:string;


};


}



export function createOSINTReportChapter(
narrative:OSINTNarrativeBlock
):OSINTReportChapter{


return {


chapterTitle:
narrative.title,



executiveSummary:
narrative.executiveNarrative,



analyticalFindings:
narrative.keyFindings,



confidenceLevel:
narrative.confidenceStatement,



operationalConclusion:
narrative.operationalAssessment,



metadata:{


source:
"OSINT_DUAL_EXECUTION_ENGINE_V4",


generatedAt:
new Date().toISOString()


}


};


}

`;



fs.writeFileSync(

"src/utils/osintNarrativeReportConnector.ts",

content

);



const registry = {


engine:
"OSINT_NARRATIVE_REPORT_CONNECTOR",


source:
"OSINTNarrativeIntelligenceLayer",


target:
"Report Engine Chapter Builder",


output:[

"Chapter Title",

"Executive Summary",

"Analytical Findings",

"Confidence Level",

"Operational Conclusion"

],


status:
"READY_FOR_RUNTIME_INTEGRATION",


createdAt:
new Date().toISOString()

};



fs.writeFileSync(

"scripts/osintNarrativeReportConnector.json",

JSON.stringify(
registry,
null,
2
)

);



console.log(
"OSINT Narrative Report Connector creado correctamente"
);


}

};