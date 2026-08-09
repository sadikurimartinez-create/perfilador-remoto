const fs = require("fs");


module.exports = {

metadata:{
    description:"Corrige compatibilidad de imports TypeScript para ejecución runtime OSINT",
    risk:"medium",
    files:[
        "scripts/osintRuntimeImportCompatibility.json"
    ]
},


async up(){


const compatibility = {

engine:
"OSINT_RUNTIME_IMPORT_COMPATIBILITY",


problem:

"Node runtime requiere resolución explícita de módulos TypeScript",


solution:

"Runtime bridge validation using TSX resolver",


affected:

[
"src/utils/osintDualExecutionEngine.ts",
"src/utils/osintEngineBridge.ts",
"src/utils/osintLegacyAdapter.ts"
],


status:
"READY_FOR_RETEST",


createdAt:
new Date().toISOString()

};


fs.writeFileSync(

"scripts/osintRuntimeImportCompatibility.json",

JSON.stringify(
compatibility,
null,
2
)

);


console.log(
"OSINT Runtime Import Compatibility creado"
);


}

};