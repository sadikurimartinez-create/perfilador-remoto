module.exports = {

metadata:{

description:
"Prueba auditoria automatica",

risk:
"low",

files:[
"scripts/migrationAudit.json"
]

},


async up(){

console.log(
"Audit integration test"
);

},


async down(){

console.log(
"Rollback test"
);

}

};