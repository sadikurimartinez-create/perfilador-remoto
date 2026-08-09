

import {
compareOSINTResults
} from "./osintComparisonEngine";


export async function runOSINTValidation(
legacyResults:any,
adapterResults:any
){

const comparison =
compareOSINTResults(
legacyResults,
adapterResults
);


return {

test:
"OSINT_MIGRATION_VALIDATION",

legacy:
{
records:
comparison.legacyCount
},

adapter:
{
records:
comparison.adapterCount
},

difference:
comparison.difference,

decision:
comparison.status,

timestamp:
comparison.timestamp

};

}

