

import { runOSINTBridge } from "./osintEngineBridge";
import { runLegacyOSINT } from "./osintLegacyAdapter";
import { compareOSINTResults } from "./osintComparisonEngine";
import { normalizeOSINTResult } from "./osintNormalizationLayer";
import { compareOSINTSemantics } from "./osintSemanticComparisonEngine";


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
legacy,
adapter
);


const semanticComparison =
compareOSINTSemantics(
legacy,
adapter
);


return {

engine:
"OSINT_DUAL_EXECUTION_ENGINE_V4",


legacy,


adapter,


comparison,

semanticComparison,


numericDecision:
comparison.decision,


operationalDecision:
semanticComparison.decision,


rollbackAvailable:true,


timestamp:
new Date().toISOString()

};

}

