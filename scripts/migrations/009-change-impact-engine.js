module.exports = {

metadata: {

description:
"Implementa motor de análisis de impacto de cambios",

risk:
"medium",

files:[
"scripts/changeImpactRegistry.json"
]

},


async up(){

const fs = require("fs");


const registry = {

version:"1.0",

engine:
"Change Impact Analyzer",

rules:[

{
pattern:"src/components",
impact:"frontend",
risk:"medium"
},

{
pattern:"src/app/api",
impact:"backend-api",
risk:"high"
},

{
pattern:"src/lib/providers",
impact:"provider-layer",
risk:"high"
},

{
pattern:"src/utils",
impact:"logic-engine",
risk:"medium"
},

{
pattern:"firebase",
impact:"database",
risk:"critical"
}

]

};


fs.writeFileSync(

"scripts/changeImpactRegistry.json",

JSON.stringify(
registry,
null,
2
)

);


console.log(
"Change Impact Analyzer Registry creado"
);


}

};