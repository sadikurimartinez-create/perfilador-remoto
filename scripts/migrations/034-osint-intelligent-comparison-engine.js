const fs = require("fs");

module.exports = {

metadata:{
    description:"Actualiza OSINT Comparison Engine con evaluación inteligente de confianza y decisiones operacionales",
    risk:"high",
    files:[
        "src/utils/osintComparisonEngine.ts"
    ]
},


async up(){

const content = `

export interface OSINTComparisonResult {

legacyCount:number;

adapterCount:number;

difference:number;

confidenceDelta:number;

averageConfidence:number;

decision:string;

status:string;

timestamp:string;

}


export function compareOSINTResults(
legacy:any,
adapter:any
):OSINTComparisonResult{


const legacyCount =
legacy?.records || 0;


const adapterCount =
adapter?.records || 0;


const difference =
adapterCount - legacyCount;


const confidenceDelta =
(adapter?.confidence || 0) -
(legacy?.confidence || 0);


const averageConfidence =
Math.round(
(
(adapter?.confidence || 0) +
(legacy?.confidence || 0)
) / 2
);


let decision =
"REVIEW_REQUIRED";


if(
difference === 0 &&
averageConfidence >= 70
){

decision =
"APPROVED";

}


if(
adapterCount === 0
){

decision =
"ROLLBACK_TO_LEGACY";

}


return {

legacyCount,

adapterCount,

difference,

confidenceDelta,

averageConfidence,

decision,

status:
decision === "APPROVED"
?
"VALIDATED"
:
"VALIDATION_REQUIRED",

timestamp:
new Date().toISOString()

};

}

`;

fs.writeFileSync(
"src/utils/osintComparisonEngine.ts",
content
);


console.log(
"OSINT Intelligent Comparison Engine actualizado correctamente"
);

}

};