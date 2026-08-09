module.exports = {

metadata: {

id: "XXX",

description:
"Descripción del cambio",

author:
"CEIPOL Development Governance",

risk:
"medium",

files:[

]

},


async up(){

console.log(
"Ejecutando migración"
);

},


async down(){

console.log(
"Rollback de migración"
);

}

};