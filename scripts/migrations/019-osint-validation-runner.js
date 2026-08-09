const fs = require("fs");

module.exports = {

metadata:{
    description:"Crea ejecutor de validación comparativa del OSINT Engine",
    risk:"high",
    files:[
        "src/utils/osintValidationRunner.ts"
    ]
},

async up(){

const runner = `

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

`;

fs.writeFileSync(
"src/utils/osintValidationRunner.ts",
runner
);


console.log(
"OSINT Validation Runner creado"
);

}

};