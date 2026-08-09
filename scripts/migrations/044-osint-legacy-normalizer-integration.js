const fs = require("fs");

module.exports = {

metadata:{
    description:"Integra cálculo inteligente de registros dentro del OSINT Normalization Layer",
    risk:"high",
    files:[
        "src/utils/osintNormalizationLayer.ts"
    ]
},


async up(){


const patch = `

// OSINT Legacy Normalization Integration

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
&& value.length > 0
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
"scripts/osintLegacyNormalizerIntegrated.ts",
patch
);


console.log(
"OSINT Legacy Normalizer Integration preparado"
);


}

};