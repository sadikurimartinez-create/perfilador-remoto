const fs = require("fs");


module.exports = {

metadata:{
    description:"Ejecuta integración runtime entre OSINT Intelligence Output y Narrative Intelligence Layer",
    risk:"high",
    files:[
        "scripts/osintNarrativeRuntimeTest.mjs"
    ]
},


async up(){


const content = `

import { runOSINTDualExecution }
from "../src/utils/osintDualExecutionEngine.ts";


import { createOSINTNarrativeBlock }
from "../src/utils/osintNarrativeIntelligenceLayer.ts";



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



console.log(

JSON.stringify(

{

status:
"NARRATIVE_RUNTIME_SUCCESS",


engine:
dualResult.engine,


decision:
dualResult.operationalDecision,


narrative

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
"NARRATIVE_RUNTIME_ERROR",

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

"scripts/osintNarrativeRuntimeTest.mjs",

content

);



const registry = {


engine:
"OSINT_NARRATIVE_RUNTIME_INTEGRATION",


source:
"OSINTIntelligenceOutput",


target:
"OSINTNarrativeIntelligenceLayer",


testFile:
"scripts/osintNarrativeRuntimeTest.mjs",


validation:[

"OSINT execution",

"Intelligence output generation",

"Narrative block creation"

],


status:
"READY_FOR_RUNTIME_TEST",


createdAt:
new Date().toISOString()

};



fs.writeFileSync(

"scripts/osintNarrativeRuntimeIntegration.json",

JSON.stringify(
registry,
null,
2
)

);



console.log(
"OSINT Narrative Runtime Integration preparado correctamente"
);


}

};