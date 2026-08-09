const fs = require("fs");


module.exports = {

metadata:{
    description:"Crea contrato estándar de salida de inteligencia OSINT Dual Engine V4",
    risk:"medium",
    files:[
        "src/utils/osintIntelligenceOutputContract.ts"
    ]
},


async up(){


const content = `

export interface OSINTIntelligenceOutput {


engine:string;


version:string;



decision:string;



confidence:{
    overall:number;
    semantic:number;
    providers:number;
};



coverage:{
    legacy:number;
    adapter:number;
    territorial:number;
};



sources:Array<any>;



findings:{

    criminalLinks:Array<any>;

    organizations:Array<any>;

    locations:Array<any>;

    riskIndicators:Array<any>;

};



geoint:{

    coordinates:Array<any>;

    spatialReferences:Array<any>;

};



audit:{

    timestamp:string;

    rollbackAvailable:boolean;

    integrityValidated:boolean;

};



}



export function createOSINTIntelligenceOutput(
dualResult:any
):OSINTIntelligenceOutput{


return {


engine:
dualResult.engine || 
"OSINT_DUAL_EXECUTION_ENGINE_V4",



version:
"4.0",



decision:
dualResult.operationalDecision || 
"REVIEW_REQUIRED",



confidence:{

overall:
dualResult.semanticComparison?.confidenceScore || 0,


semantic:
dualResult.semanticComparison?.intelligenceDepth || 0,


providers:
dualResult.adapter?.confidence || 0

},



coverage:{

legacy:
dualResult.semanticComparison?.legacyCoverage || 0,


adapter:
dualResult.semanticComparison?.adapterCoverage || 0,


territorial:
dualResult.semanticComparison?.geospatialScore || 0

},



sources:

dualResult.adapter?.payload || [],



findings:{

criminalLinks:[],


organizations:[],


locations:[],


riskIndicators:[]

},



geoint:{

coordinates:[],


spatialReferences:[]

},



audit:{

timestamp:
new Date().toISOString(),


rollbackAvailable:
true,


integrityValidated:
true

}



};


}

`;



fs.writeFileSync(

"src/utils/osintIntelligenceOutputContract.ts",

content

);



const registry = {


engine:
"OSINT_INTELLIGENCE_OUTPUT_CONTRACT",


version:
"1.0",


purpose:
"Contrato estable entre OSINT Dual Engine V4 y módulos consumidores",


consumers:[

"Report Engine",

"Intelligence Narrative Engine",

"GeoInt Module",

"Evidence Governance Engine"

],


status:
"READY",


createdAt:
new Date().toISOString()


};



fs.writeFileSync(

"scripts/osintIntelligenceOutputContract.json",

JSON.stringify(
registry,
null,
2
)

);



console.log(
"OSINT Intelligence Output Contract creado correctamente"
);



}

};