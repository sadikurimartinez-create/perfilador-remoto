const fs = require("fs");


module.exports = {

metadata:{
    description:"Aplica cálculo inteligente de registros al OSINT Legacy Normalizer",
    risk:"high",
    files:[
        "src/utils/osintNormalizationLayer.ts"
    ]
},


async up(){


const target =
"src/utils/osintNormalizationLayer.ts";


let content =
fs.readFileSync(
target,
"utf8"
);


if(
content.includes("calculateLegacyRecords")
){

console.log(
"Legacy Normalizer ya contiene la función"
);

return;

}


const functionCode = `

function calculateLegacyRecords(input:any){

if(!input){
    return 0;
}

const sources=[
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


if(Array.isArray(value)){
return total + value.length;
}


if(value){
return total + 1;
}


return total;

},
0
);

}

`;


content =
functionCode + content;


content =
content.replace(
"records:\ninput.records || 0",
"records:\ncalculateLegacyRecords(input)"
);


fs.writeFileSync(
target,
content
);


console.log(
"OSINT Legacy Normalizer aplicado"
);


}

};