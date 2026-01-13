import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBrV1NuvPO-_CLtQPyOhR_ERsRvE2dxDlY",
  authDomain: "dmg-command-centre-native.firebaseapp.com",
  projectId: "dmg-command-centre-native",
  storageBucket: "dmg-command-centre-native.firebasestorage.app",
  messagingSenderId: "223535956454",
  appId: "1:223535956454:web:b25e5bc69d8a4a7f209627"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const COLLECTION_PATH = "artifacts/dmg-command-centre-native/public/data/creative_updates";