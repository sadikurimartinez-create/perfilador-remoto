

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

