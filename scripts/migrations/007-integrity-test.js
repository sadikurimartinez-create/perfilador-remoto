const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


function calculateHash(file){

    const content =
        fs.readFileSync(
            file,
            "utf8"
        );

    return crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");

}


module.exports = {

metadata: {

description:
"Prueba del motor SHA256 de integridad",

risk:
"low",

files:[
"scripts/integrity-test.txt"
]

},


async up(){

const testFile =
path.join(
process.cwd(),
"scripts",
"integrity-test.txt"
);


// Crear archivo inicial

fs.writeFileSync(
    testFile,
    "Version inicial"
);


const beforeHash =
calculateHash(testFile);


// Modificar archivo

fs.writeFileSync(
    testFile,
    "Version modificada por migracion 007"
);


const afterHash =
calculateHash(testFile);



const integrityFile =
path.join(
process.cwd(),
"scripts",
"migrationIntegrity.json"
);


let registry = {
    migrations:[]
};


if(fs.existsSync(integrityFile)){

registry =
JSON.parse(
fs.readFileSync(
integrityFile,
"utf8"
)
);

}



registry.migrations.push({

migration:
"007-integrity-test",

file:
"scripts/integrity-test.txt",

beforeHash,

afterHash,

changed:
beforeHash !== afterHash,

date:
new Date().toISOString()

});



fs.writeFileSync(
integrityFile,
JSON.stringify(
registry,
null,
2
)
);


console.log(
"SHA256 Integrity Test ejecutado"
);


console.log(
"Hash anterior:",
beforeHash
);


console.log(
"Hash nuevo:",
afterHash
);


}

};