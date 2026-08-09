const fs = require("fs");

module.exports = {

metadata:{
    description:"Crea motor operativo de ejecución dual OSINT Legacy vs Adapter",
    risk:"high",
    files:[
        "src/utils/osintDualExecutionEngine.ts"
    ]
},


async up(){

const content = `

import { runOSINTBridge } from "./osintEngineBridge";
import { compareOSINTResults } from "./osintComparisonEngine";


export async function runOSINTDualExecution(project:any){

const legacyResult = [];

const adapterResult =
await runOSINTBridge(project);


const comparison =
compareOSINTResults(
legacyResult,
adapterResult.providers
);


return {

engine:
"OSINT_DUAL_EXECUTION_ENGINE",

legacy:
legacyResult,

adapter:
adapterResult,

comparison,

rollbackAvailable:true,

timestamp:
new Date().toISOString()

};

}

`;


fs.writeFileSync(

"src/utils/osintDualExecutionEngine.ts",

content

);


console.log(
"OSINT Dual Execution Engine operativo creado"
);


}

};