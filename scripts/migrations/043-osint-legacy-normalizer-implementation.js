const fs = require("fs");

module.exports = {

metadata:{
    description:"Implementa cálculo inteligente de registros del OSINT Legacy Engine",
    risk:"high",
    files:[
        "src/utils/osintNormalizationLayer.ts"
    ]
},


async up(){


const implementation = `

// OSINT Legacy Normalization Enhancement

export function calculateLegacyRecords(input:any){

if(!input){
    return 0;
}


const sources = [

"serp",
"news",
"gnews",
"newsdata",
"thenews",
"denue",
"reddit",
"x",
"webOSINT",
"googlePlaces",
"streetViewAnalysis",
"mapaVinculos"

];


return sources.reduce(
(total,source)=>{

const value =
input.payload?.[source];


if(
Array.isArray(value)
&&
value.length > 0
){
return total + value.length;
}


if(
value &&
typeof value === "object"
){
return total + 1;
}


return total;

},
0
);

}

`;

fs.writeFileSync(
"scripts/osintLegacyNormalizerImplementation.ts",
implementation
);


console.log(
"OSINT Legacy Normalizer Implementation generado"
);


}

};