const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = {

metadata:{
    description:"Preparación controlada para modernización del OSINT Engine",
    risk:"high",
    files:[
        "src/utils/osintEngine.ts"
    ]
},

async up(){

const targetFile =
"src/utils/osintEngine.ts";


let hash="NOT_FOUND";


if(fs.existsSync(targetFile)){

    const content =
    fs.readFileSync(
        targetFile,
        "utf8"
    );

    hash =
    crypto
    .createHash("sha256")
    .update(content)
    .digest("hex");

}


const registry = {

    migration:
    "014-osint-migration-preparation",

    component:
    "OSINT Engine",

    targetFile,

    currentHash:
    hash,

    impact:
    {
        layer:"logic-engine",
        risk:"high",
        backupRequired:true,
        auditRequired:true,
        approvalRequired:true
    },

    dependencies:[
        "ApiOrchestrator",
        "ProviderResponse",
        "GeoDataNormalizerEngine",
        "OSINT Territorial V2",
        "Report Engine"
    ],

    status:
    "READY_FOR_MODERNIZATION",

    createdAt:
    new Date().toISOString()

};


fs.writeFileSync(
"scripts/osintMigrationRegistry.json",
JSON.stringify(
registry,
null,
2
)
);


console.log(
"OSINT Migration Registry creado"
);


}

};