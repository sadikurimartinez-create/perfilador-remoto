

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

