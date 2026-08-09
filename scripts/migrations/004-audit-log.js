module.exports = {

metadata: {

description:
"Implementa registro de auditoría de migraciones",

risk:
"low",

files:[
"scripts/migrationAudit.json"
]

},


async up(){

const fs = require("fs");
const path = require("path");


const auditFile =
path.join(
__dirname,
"..",
"migrationAudit.json"
);


if(!fs.existsSync(auditFile)){

fs.writeFileSync(
auditFile,
JSON.stringify(
{
migrations:[]
},
null,
2
)
);

}


console.log(
"Migration audit registry created"
);


},


async down(){

console.log(
"Rollback audit registry"
);

}

};