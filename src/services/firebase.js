import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCD6VfKRuPQrnfPPArBG2CKMFqVJi9z6qM",
  authDomain: "lotus-crm-262f3.firebaseapp.com",
  projectId: "lotus-crm-262f3",
  storageBucket: "lotus-crm-262f3.firebasestorage.app",
  messagingSenderId: "711136681085",
  appId: "1:711136681085:web:25ccc68cfe9e0b6df96514"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
