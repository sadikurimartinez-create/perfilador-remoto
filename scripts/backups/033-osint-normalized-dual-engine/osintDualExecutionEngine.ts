

import { runOSINTBridge } from "./osintEngineBridge";
import { runLegacyOSINT } from "./osintLegacyAdapter";
import { compareOSINTResults } from "./osintComparisonEngine";


export async function runOSINTDualExecution(project:any){

const legacyResult = await runLegacyOSINT(project);

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

