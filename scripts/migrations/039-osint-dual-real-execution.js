const fs = require("fs");

const {
executeOSINTDualRuntime
} = require("../osintRuntimeBridge");


module.exports = {

metadata:{
    description:"Ejecuta prueba real del OSINT Dual Engine V3 con runtime TypeScript",
    risk:"high",
    files:[
        "scripts/osintDualRealExecutionResult.json"
    ]
},


async up(){

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


let result;


try{


result =
await executeOSINTDualRuntime(
project
);



}
catch(error){


result = {

status:
"EXECUTION_ERROR",

error:
error.message,

timestamp:
new Date().toISOString()

};


}



fs.writeFileSync(

"scripts/osintDualRealExecutionResult.json",

JSON.stringify(
result,
null,
2
)

);



console.log(
"OSINT Dual Real Execution finalizada"
);


}

};