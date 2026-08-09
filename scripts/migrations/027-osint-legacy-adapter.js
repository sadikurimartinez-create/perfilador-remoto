const fs = require("fs");

module.exports = {

metadata:{
    description:"Crea adaptador seguro para consumo del OSINT Engine Legacy",
    risk:"high",
    files:[
        "src/utils/osintLegacyAdapter.ts"
    ]
},


async up(){

const content = `

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

`;


fs.writeFileSync(

"src/utils/osintLegacyAdapter.ts",

content

);


console.log(
"OSINT Legacy Adapter creado correctamente"
);

}

};