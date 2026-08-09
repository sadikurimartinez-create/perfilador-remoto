const fs = require("fs");

module.exports = {

metadata:{
    description:"Integra OSINT Normalization Layer dentro del Dual Execution Engine",
    risk:"high",
    files:[
        "src/utils/osintDualExecutionEngine.ts"
    ]
},


async up(){

const content = `

import { runOSINTBridge } from "./osintEngineBridge";
import { runLegacyOSINT } from "./osintLegacyAdapter";
import { compareOSINTResults } from "./osintComparisonEngine";
import { normalizeOSINTResult } from "./osintNormalizationLayer";


export async function runOSINTDualExecution(
project:any
){

const legacyRaw =
await runLegacyOSINT(project);


const adapterRaw =
await runOSINTBridge(project);


const legacy =
normalizeOSINTResult(
legacyRaw
);


const adapter =
normalizeOSINTResult(
adapterRaw
);


const comparison =
compareOSINTResults(
[
...Array(legacy.records)
],
[
...Array(adapter.records)
]
);


return {

engine:
"OSINT_DUAL_EXECUTION_ENGINE_V2",

legacy,

adapter,

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
"OSINT Normalized Dual Engine integrado correctamente"
);

}

};