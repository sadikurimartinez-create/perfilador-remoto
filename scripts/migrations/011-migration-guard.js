module.exports = {

metadata: {

description:
"Implementa sistema de bloqueo y autorización según nivel de riesgo de cambios",

risk:
"high",

files:[
"scripts/migrationGuard.json"
]

},


async up(){

const fs = require("fs");


const guard = {


engine:
"Migration Guard",


version:
"1.0",


rules:[


{
risk:"low",

action:
"ALLOW",

requirements:[]
},


{
risk:"medium",

action:
"ALLOW_WITH_AUDIT",

requirements:[

"backup",

"hash",

"audit"

]

},


{
risk:"high",

action:
"REQUIRE_APPROVAL",

requirements:[

"backup",

"hash",

"audit",

"manual_confirmation"

]

},


{
risk:"critical",

action:
"BLOCK",

requirements:[

"security_review",

"administrator_approval"

]

}


],


decisionExamples:[


{

file:
"src/utils/osintEngine.ts",

risk:
"medium",

decision:
"ALLOW_WITH_AUDIT"

},


{

file:
"src/lib/providers/orchestrator.ts",

risk:
"high",

decision:
"REQUIRE_APPROVAL"

},


{

file:
"firebase/config.ts",

risk:
"critical",

decision:
"BLOCK"

}


]


};



fs.writeFileSync(

"scripts/migrationGuard.json",

JSON.stringify(
guard,
null,
2
)

);



console.log(
"Migration Guard creado correctamente"
);


}

};