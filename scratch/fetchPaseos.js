process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyCX8sRh4Km8FLFz1XI-LtbkhzdfhXeAVpw",
  authDomain: "perfilador-remoto.firebaseapp.com",
  databaseURL: "https://perfilador-remoto-default-rtdb.firebaseio.com",
  projectId: "perfilador-remoto",
  storageBucket: "perfilador-remoto.firebasestorage.app",
  messagingSenderId: "1062636354921",
  appId: "1:1062636354921:web:89ebc4ad940d93015e91f8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    console.log("Fetching project 'Lwh3M1QJGc9HucZTwtWo' with TLS validation disabled...");
    const docRef = doc(db, "projects", "Lwh3M1QJGc9HucZTwtWo");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log("SUCCESS: Document retrieved!");
      const data = docSnap.data();
      console.log("Project Name:", data.projectName);
      console.log("Coordinates:", data.lat, ",", data.lng);
      console.log("Analysis Radius:", data.analysisRadius);
      console.log("Geometry Type:", data.geometryType);
      
      // Save data for further analysis
      const fs = require("fs");
      const path = require("path");
      fs.writeFileSync(
        path.join(__dirname, "paseos_project_data.json"),
        JSON.stringify(data, null, 2)
      );
      console.log("Project data saved to paseos_project_data.json");
    } else {
      console.log("ERROR: No such document 'Lwh3M1QJGc9HucZTwtWo'!");
    }
  } catch (e) {
    console.error("Error fetching document:", e);
  }
  process.exit(0);
}
run();
