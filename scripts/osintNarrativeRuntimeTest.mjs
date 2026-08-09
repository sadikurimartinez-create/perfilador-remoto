

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

