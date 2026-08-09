const fs = require("fs");

module.exports = {

metadata:{
    description:"Genera mapa de dependencias del OSINT Engine antes de modernización",
    risk:"high",
    files:[
        "src/utils/osintEngine.ts"
    ]
},

async up(){

const registry = {

    migration:
    "015-osint-dependency-map",

    engine:
    "OSINT Dependency Analyzer",

    target:
    "src/utils/osintEngine.ts",

    dependencies:[

        {
            file:"src/components/OsintEnginePanel.tsx",
            relation:"frontend-consumer",
            risk:"medium"
        },

        {
            file:"src/utils/osintTerritorialV2.ts",
            relation:"advanced-osint-engine",
            risk:"high"
        },

        {
            file:"src/lib/providers/orchestrator.ts",
            relation:"provider-execution-layer",
            risk:"high"
        },

        {
            file:"src/lib/providers/baseProvider.ts",
            relation:"response-contract",
            risk:"high"
        },

        {
            file:"src/utils/socialCorrelation.ts",
            relation:"social-analysis",
            risk:"medium"
        }

    ],

    protectedInterfaces:[

        "runOSINTScan(project)",

        "ProviderResponse",

        "NormalizedOSINTEvent"

    ],

    migrationRule:

    "No modificar contratos existentes sin crear adaptador",

    status:
    "DEPENDENCY_MAP_READY",

    createdAt:
    new Date().toISOString()

};


fs.writeFileSync(
"scripts/osintDependencyMap.json",
JSON.stringify(
registry,
null,
2
)
);


console.log(
"OSINT Dependency Map creado correctamente"
);


}

};