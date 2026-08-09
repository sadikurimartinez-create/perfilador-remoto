module.exports = {

metadata: {

description:
"Implementa motor automático de análisis de impacto de archivos modificados",

risk:
"medium",

files:[
"scripts/autoImpactReport.json"
]

},


async up(){

const fs = require("fs");


const registryPath =
"scripts/changeImpactRegistry.json";


if(!fs.existsSync(registryPath)){

throw new Error(
"No existe Change Impact Registry"
);

}


const registry =
JSON.parse(
fs.readFileSync(
registryPath,
"utf8"
)
);



function analyzeFile(file){


let result = {

file,

impact:
"unknown",

risk:
"low",

requiresBackup:false,

requiresAudit:false

};



for(const rule of registry.rules){


if(file.includes(rule.pattern)){


result.impact =
rule.impact;


result.risk =
rule.risk;


result.requiresBackup =
true;


result.requiresAudit =
rule.risk !== "low";


break;


}

}


return result;


}



const testFiles = [

"src/utils/osintEngine.ts",

"src/components/OsintEnginePanel.tsx",

"src/lib/providers/orchestrator.ts",

"firebase/config.ts"

];



const report = {


engine:
"Auto Impact Scanner",

version:
"1.0",


analysisDate:
new Date().toISOString(),


changes:
testFiles.map(analyzeFile)


};



fs.writeFileSync(

"scripts/autoImpactReport.json",

JSON.stringify(
report,
null,
2
)

);



console.log(
"Auto Impact Scanner ejecutado correctamente"
);


}

};