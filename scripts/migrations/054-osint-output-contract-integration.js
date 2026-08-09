const fs = require("fs");


module.exports = {

metadata:{
    description:"Integra OSINT Intelligence Output Contract dentro del Dual Engine V4",
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


// Agregar import del contrato

if(
!content.includes("osintIntelligenceOutputContract")
){

content =
content.replace(
'import { compareOSINTSemantics } from "./osintSemanticComparisonEngine";',
'import { compareOSINTSemantics } from "./osintSemanticComparisonEngine";\nimport { createOSINTIntelligenceOutput } from "./osintIntelligenceOutputContract";'
);

}


// Agregar generación de output

if(
!content.includes("intelligenceOutput")
){

content =
content.replace(
`const semanticComparison =
compareOSINTSemantics(
legacy,
adapter
);`,
`const semanticComparison =
compareOSINTSemantics(
legacy,
adapter
);


const intelligenceOutput =
createOSINTIntelligenceOutput({

engine:
"OSINT_DUAL_EXECUTION_ENGINE_V4",

operationalDecision:
semanticComparison.decision,

semanticComparison,

adapter,

legacy

});`
);

}


// Exponer salida contractual

if(
!content.includes("intelligenceOutput,")
){

content =
content.replace(
"semanticComparison,",
"semanticComparison,\n\nintelligenceOutput,"
);

}


fs.writeFileSync(
file,
content
);



const registry = {

engine:
"OSINT_OUTPUT_CONTRACT_INTEGRATION",


target:
"OSINT_DUAL_EXECUTION_ENGINE_V4",


contract:
"OSINTIntelligenceOutput",


consumerReady:[

"Report Engine",

"Intelligence Narrative Engine",

"GeoInt Module",

"Evidence Governance Engine"

],


status:
"INTEGRATED_READY_FOR_REPORT_ENGINE",


createdAt:
new Date().toISOString()

};



fs.writeFileSync(

"scripts/osintOutputContractIntegration.json",

JSON.stringify(
registry,
null,
2
)

);



console.log(
"OSINT Output Contract integrado correctamente"
);


}

};