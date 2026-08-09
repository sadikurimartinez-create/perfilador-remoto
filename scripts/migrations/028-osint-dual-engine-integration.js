const fs = require("fs");

module.exports = {

metadata:{
    description:"Integra OSINT Legacy Adapter dentro del Dual Execution Engine",
    risk:"high",
    files:[
        "src/utils/osintDualExecutionEngine.ts"
    ]
},


async up(){

const file =
"src/utils/osintDualExecutionEngine.ts";


let content =
fs.readFileSync(
file,
"utf8"
);


content =
content.replace(
'import { runOSINTBridge } from "./osintEngineBridge";',
'import { runOSINTBridge } from "./osintEngineBridge";\nimport { runLegacyOSINT } from "./osintLegacyAdapter";'
);


content =
content.replace(
'const legacyResult = [];',
'const legacyResult = await runLegacyOSINT(project);'
);


fs.writeFileSync(
file,
content
);


console.log(
"OSINT Dual Engine integrado correctamente"
);


}

};