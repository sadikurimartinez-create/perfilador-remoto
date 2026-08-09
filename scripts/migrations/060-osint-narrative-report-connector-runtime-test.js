const fs = require("fs");


module.exports = {

metadata:{
    description:"Ejecuta prueba runtime del OSINT Narrative Report Connector",
    risk:"high",
    files:[
        "scripts/osintNarrativeReportConnectorTest.mjs"
    ]
},


async up(){


const content = `

import { runOSINTDualExecution }
from "../src/utils/osintDualExecutionEngine.ts";


import { createOSINTNarrativeBlock }
from "../src/utils/osintNarrativeIntelligenceLayer.ts";


import { createOSINTReportChapter }
from "../src/utils/osintNarrativeReportConnector.ts";



const project = {

locationName:
"Aguascalientes",

latitude:
21.8818,

longitude:
-102.2915,

query:
"criminalidad"

};



try{


const dualResult =
await runOSINTDualExecution(project);



const narrative =
createOSINTNarrativeBlock(
dualResult.intelligenceOutput
);



const chapter =
createOSINTReportChapter(
narrative
);



console.log(

JSON.stringify(

{

status:
"OSINT_REPORT_CONNECTOR_RUNTIME_SUCCESS",

engine:
dualResult.engine,

decision:
dualResult.operationalDecision,

chapter

},

null,

2

)

);


}

catch(error){


console.error(

JSON.stringify(

{

status:
"OSINT_REPORT_CONNECTOR_RUNTIME_ERROR",

message:
error.message

},

null,

2

)

);


}

`;



fs.writeFileSync(

"scripts/osintNarrativeReportConnectorTest.mjs",

content

);



const registry = {


engine:
"OSINT_NARRATIVE_REPORT_CONNECTOR_RUNTIME_TEST",


source:
"OSINTNarrativeIntelligenceLayer",


target:
"Report Engine Chapter Builder",


testFile:
"scripts/osintNarrativeReportConnectorTest.mjs",


validation:[

"Narrative generation",

"Chapter creation",

"Report compatibility"

],


status:
"READY_FOR_EXECUTION",


createdAt:
new Date().toISOString()

};



fs.writeFileSync(

"scripts/osintNarrativeReportConnectorRuntimeTest.json",

JSON.stringify(
registry,
null,
2
)

);



console.log(
"OSINT Narrative Report Connector Runtime Test creado correctamente"
);


}

};