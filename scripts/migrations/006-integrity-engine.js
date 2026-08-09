const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


module.exports = {

metadata: {

description:
"Implementa registro de integridad criptográfica de migraciones",

risk:
"low",

files: [
"scripts/migrationIntegrity.json"
]

},


async up(){

const file =
path.join(
process.cwd(),
"scripts",
"migrationIntegrity.json"
);


if(!fs.existsSync(file)){

fs.writeFileSync(
file,
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
"Migration integrity registry created"
);


}

};