const fs = require("fs");

module.exports = {

metadata:{
    description:"Crea puente controlado entre OSINT Engine actual y OSINT Adapter",
    risk:"high",
    files:[
        "src/utils/osintEngineBridge.ts"
    ]
},

async up(){

const bridge = `

import {
executeOSINTAdapter
} from "./osintAdapter";


export async function runOSINTBridge(
project:any
){

const params = {

location:
project?.locationName || "Aguascalientes",

lat:
project?.latitude || 21.8818,

lng:
project?.longitude || -102.2915,

query:
project?.query || "criminalidad"

};


const adapterResults =
await executeOSINTAdapter(
params
);


return {

engine:
"OSINT_BRIDGE_V1",

location:
params.location,

providers:
adapterResults,

timestamp:
new Date().toISOString()

};

}

`;

fs.writeFileSync(
"src/utils/osintEngineBridge.ts",
bridge
);


console.log(
"OSINT Engine Bridge creado"
);

}

};