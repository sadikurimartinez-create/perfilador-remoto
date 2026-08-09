module.exports = {

metadata: {

id:"002-test-metadata",

description:
"Prueba de sistema de gobernanza de migraciones",

author:
"CEIPOL Development Governance",

risk:
"low"

},


async up(){

console.log(
"Metadata funcionando correctamente"
);

},


async down(){

console.log(
"Rollback ejecutado"
);

}

};