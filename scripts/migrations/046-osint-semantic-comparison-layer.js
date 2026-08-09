const fs = require("fs");


module.exports = {

metadata:{
    description:"Crea capa semántica de comparación OSINT Legacy vs Adapter",
    risk:"high",
    files:[
        "src/utils/osintSemanticComparisonEngine.ts"
    ]
},


async up(){


const content = `

export interface SemanticComparison {

legacyCoverage:number;

adapterCoverage:number;

confidenceScore:number;

geospatialScore:number;

intelligenceDepth:number;

decision:string;

timestamp:string;

}



export function compareOSINTSemantics(
legacy:any,
adapter:any
):SemanticComparison{


const legacyCoverage =
Math.min(
100,
(legacy?.records || 0) * 10
);


const adapterCoverage =
Math.min(
100,
(adapter?.records || 0) * 15
);



const confidenceScore =
Math.round(
(
(legacy?.confidence || 0)
+
(adapter?.confidence || 0)
)
/
2
);



const geospatialScore =
adapter?.records > 0
?
80
:
0;



const intelligenceDepth =
Math.round(
(
legacyCoverage +
adapterCoverage +
confidenceScore +
geospatialScore
)
/
4
);



let decision =
"REVIEW_REQUIRED";



if(
intelligenceDepth >= 75
){

decision =
"SEMANTICALLY_VALIDATED";

}



if(
confidenceScore < 50
){

decision =
"LOW_CONFIDENCE_REVIEW";

}



return {

legacyCoverage,

adapterCoverage,

confidenceScore,

geospatialScore,

intelligenceDepth,

decision,

timestamp:
new Date().toISOString()

};


}

`;



fs.writeFileSync(
"src/utils/osintSemanticComparisonEngine.ts",
content
);



const report = {

engine:
"OSINT_SEMANTIC_COMPARISON_LAYER",

purpose:
"Comparación basada en equivalencia de inteligencia y no únicamente volumen",

inputs:[
"OSINT Legacy Normalized",
"OSINT Adapter Normalized"
],

metrics:[
"coverage",
"confidence",
"geospatial relevance",
"intelligence depth"
],

status:
"READY",

createdAt:
new Date().toISOString()

};


fs.writeFileSync(
"scripts/osintSemanticComparisonLayer.json",
JSON.stringify(
report,
null,
2
)
);


console.log(
"OSINT Semantic Comparison Layer creado correctamente"
);


}

};