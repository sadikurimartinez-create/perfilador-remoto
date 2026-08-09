

import { runOSINTDualExecution } 
from "../src/utils/osintDualExecutionEngine.ts";


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


const result =
await runOSINTDualExecution(project);


console.log(
JSON.stringify(
result,
null,
2
)
);


}

catch(error){


console.error(
JSON.stringify(
{
status:"ERROR",
message:error.message
},
null,
2
)
);


}

