const fs = require("fs");


module.exports = {

metadata:{
    description:"Crea ejecutor TSX para pruebas reales del OSINT Dual Engine",
    risk:"high",
    files:[
        "scripts/osintTSXRuntimeExecutor.mjs"
    ]
},


async up(){


const executor = `

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

`;


fs.writeFileSync(

"scripts/osintTSXRuntimeExecutor.mjs",

executor

);


console.log(
"OSINT TSX Runtime Executor creado"
);


}

};