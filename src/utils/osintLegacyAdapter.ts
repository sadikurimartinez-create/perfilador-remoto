

import { runOSINTScan } from "./osintEngine";


export async function runLegacyOSINT(
project:any
){

const result =
await runOSINTScan(project);


return {

source:
"OSINT_LEGACY_ENGINE",

records:
Array.isArray(result)
?
result.length
:
0,

payload:
result,

timestamp:
new Date().toISOString()

};

}

