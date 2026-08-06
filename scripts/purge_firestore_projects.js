const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

const serviceAccount = require(
  path.join(
    __dirname,
    "..",
    "serviceAccountKey.json"
  )
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const KEEP_PROJECT = "SdTUOZl87kiRQoH63gB5";

const SUBCOLLECTIONS = [
  "photos",
  "documents",
  "analyses",
  "sweeps"
];


async function deleteSubcollection(ref, name){

  const snap = await ref
    .collection(name)
    .get();

  for(const doc of snap.docs){

    await doc.ref.delete();

    console.log(
      "  Eliminado:",
      `${name}/${doc.id}`
    );

  }

}


async function purge(){

const snapshot =
await db.collection("projects").get();


let log=[];


for(const doc of snapshot.docs){

  if(doc.id === KEEP_PROJECT){

    console.log(
      "\nCONSERVADO:",
      doc.id
    );

    continue;
  }


  console.log(
    "\nPURGANDO:",
    doc.id,
    doc.data().name || "SIN NOMBRE"
  );


  for(const sub of SUBCOLLECTIONS){

    await deleteSubcollection(
      doc.ref,
      sub
    );

  }


  await doc.ref.delete();


  log.push({
    deletedProject: doc.id,
    name: doc.data().name || null,
    date:new Date().toISOString()
  });


}


fs.writeFileSync(
"purge_log.json",
JSON.stringify(log,null,2)
);


console.log(
"\n============================"
);

console.log(
"PURGA TERMINADA"
);

console.log(
"Conservado:",
KEEP_PROJECT
);

}


purge()
.catch(console.error);