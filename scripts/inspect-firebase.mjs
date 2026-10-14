import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDyWPFvO_MDqJbRdMjIv0WUJP4wO93dFnA",
  authDomain: "whisperledger-94715.firebaseapp.com",
  projectId: "whisperledger-94715",
  storageBucket: "whisperledger-94715.firebasestorage.app",
  messagingSenderId: "1064792050841",
  appId: "1:1064792050841:web:9e30d27d9f6aa2e4fe3c08"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  console.log("Connecting to Firestore whisperledger-94715...");
  const collectionsToCheck = ["users", "households", "expenses", "settlements", "receivables"];
  
  for (const colName of collectionsToCheck) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`Collection [${colName}]: ${snap.docs.length} documents found`);
      snap.docs.slice(0, 3).forEach(doc => {
        console.log(`  - Doc ID: ${doc.id}`);
        console.log(`    Data preview:`, JSON.stringify(doc.data()).slice(0, 150));
      });
    } catch (err) {
      console.log(`Collection [${colName}] error:`, err.message);
    }
  }
  process.exit(0);
}

inspect();
