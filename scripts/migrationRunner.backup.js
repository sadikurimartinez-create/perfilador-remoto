const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const STATE_FILE = path.join(__dirname, "migrationState.json");
const AUDIT_FILE = path.join(__dirname, "migrationAudit.json");
const BACKUP_DIR = path.join(__dirname, "backups");

function loadState() {
    if (!fs.existsSync(STATE_FILE)) {
        return { applied: [] };
    }

    const content = fs.readFileSync(
        STATE_FILE,
        "utf8"
    );

    if (!content.trim()) {
        return { applied: [] };
    }

    return JSON.parse(content);
}


function saveState(state) {
    fs.writeFileSync(
        STATE_FILE,
        JSON.stringify(state, null, 2)
    );
}

function writeAudit(entry){

    let audit = {
        migrations:[]
    };


    if(fs.existsSync(AUDIT_FILE)){

        const content =
        fs.readFileSync(
            AUDIT_FILE,
            "utf8"
        );


        if(content.trim()){
            audit = JSON.parse(content);
        }

    }


    audit.migrations.push(entry);


    fs.writeFileSync(
        AUDIT_FILE,
        JSON.stringify(
            audit,
            null,
            2
        )
    );

}

function createBackup(id, files){

    if(!files || files.length === 0){
        return;
    }

    const migrationBackup =
        path.join(
            BACKUP_DIR,
            id
        );

    if(!fs.existsSync(migrationBackup)){
        fs.mkdirSync(
            migrationBackup,
            {recursive:true}
        );
    }


    files.forEach(file=>{

        if(fs.existsSync(file)){

            const destination =
                path.join(
                    migrationBackup,
                    path.basename(file)
                );


            fs.copyFileSync(
                file,
                destination
            );


            console.log(
                "Backup creado:",
                destination
            );
        }

    });

}

function restoreBackup(id){

    const migrationBackup =
        path.join(
            BACKUP_DIR,
            id
        );


    if(!fs.existsSync(migrationBackup)){

        console.error(
            "❌ No existe backup para:",
            id
        );

        return false;
    }


    const files =
        fs.readdirSync(
            migrationBackup
        );


    files.forEach(file=>{

        const source =
            path.join(
                migrationBackup,
                file
            );


        const destination =
            path.join(
                process.cwd(),
                file
            );


        fs.copyFileSync(
            source,
            destination
        );


        console.log(
            "Restaurado:",
            destination
        );

    });


    return true;

}

async function runMigration(id) {

    const state = loadState();

    if (state.applied.includes(id)) {
        console.log(`⚠️ Migración ${id} ya aplicada`);
        return;
    }


    const migrationFile = path.join(
        MIGRATIONS_DIR,
        `${id}.js`
    );


    if (!fs.existsSync(migrationFile)) {
        console.error(
            `❌ No existe la migración: ${migrationFile}`
        );
        process.exit(1);
    }


    console.log(
        `🚀 Ejecutando migración ${id}`
    );


    try {

        const migration =
            require(migrationFile);

if (migration.metadata) {

    console.log(
        "📋 Migración:",
        migration.metadata.description
    );

    console.log(
        "⚠️ Riesgo:",
        migration.metadata.risk
    );

}

        if(
    migration.metadata &&
    migration.metadata.files
){

    createBackup(
        id,
        migration.metadata.files
    );

}


await migration.up();


        state.applied.push(id);

saveState(state);


writeAudit({

    migration:id,

    date:new Date().toISOString(),

    risk:
    migration.metadata?.risk || "unknown",

    description:
    migration.metadata?.description || "",

    files:
    migration.metadata?.files || [],

    status:"success"

});


        console.log(
            `✅ Migración ${id} completada`
        );


    } catch(error) {

        console.error(
            "❌ Error:",
            error
        );

        process.exit(1);
    }
}


const command = process.argv[2];
const id = process.argv[3] || process.argv[2];


if (!command) {

console.log(
"Uso:"
);

console.log(
"node scripts/migrationRunner.js nombre_migracion"
);

console.log(
"node scripts/migrationRunner.js rollback nombre_migracion"
);

process.exit(1);

}


if(command === "rollback"){

console.log(
`🔄 Ejecutando rollback de ${id}`
);


const restored = restoreBackup(id);


if(restored){

console.log(
`✅ Rollback ${id} completado`
);

}else{

console.log(
`❌ Rollback ${id} no pudo ejecutarse`
);

}


process.exit(0);

}


runMigration(command);