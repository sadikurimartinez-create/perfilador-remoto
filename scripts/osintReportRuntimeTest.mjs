

import { runOSINTDualExecution }
from "../src/utils/osintDualExecutionEngine.ts";


import { createOSINTReportSection }
from "../src/utils/osintReportEngineAdapter.ts";



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



const reportSection =
createOSINTReportSection(
dualResult.intelligenceOutput
);



console.log(

JSON.stringify(

{

status:
"REPORT_RUNTIME_SUCCESS",


engine:
dualResult.engine,


decision:
dualResult.operationalDecision,


reportSection


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
"REPORT_RUNTIME_ERROR",

message:
error.message

},

null,

2

)

);


}

