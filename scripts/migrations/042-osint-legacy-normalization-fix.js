const fs = require("fs");

module.exports = {

metadata:{
    description:"Corrige normalización de registros del OSINT Legacy Engine para comparación dual",
    risk:"high",
    files:[
        "src/utils/osintNormalizationLayer.ts"
    ]
},


async up(){


const report = {

engine:
"OSINT_LEGACY_NORMALIZATION_FIX",


problem:
"Legacy Engine genera objeto estructurado y el normalizador esperaba arreglo",


previousBehavior:{
    records:0,
    reason:"Array validation only"
},


newBehavior:{

sourcesCounted:[

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

],


calculation:
"Count non-empty intelligence sources"

},


expectedResult:

"Legacy records reflect real intelligence payload",


status:
"READY_FOR_IMPLEMENTATION",


createdAt:
new Date().toISOString()

};


fs.writeFileSync(

"scripts/osintLegacyNormalizationFix.json",

JSON.stringify(
report,
null,
2
)

);



console.log(
"OSINT Legacy Normalization Fix preparado"
);


}

};