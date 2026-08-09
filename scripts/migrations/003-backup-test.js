module.exports = {

metadata: {

description:
"Prueba de sistema de backups",

risk:
"low",

files:[
"scripts/migrationState.json"
]

},


async up(){

console.log(
"Ejecutando prueba backup"
);


},


async down(){

console.log(
"Rollback prueba backup"
);

}

};