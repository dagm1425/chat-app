import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBTqeOPtEwJRlGq5RLhBPose9KYuCL74Q4",
  authDomain: "chat-d98aa.firebaseapp.com",
  databaseURL:
    "https://chat-d98aa-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chat-d98aa",
  storageBucket: "chat-d98aa.appspot.com",
  messagingSenderId: "1042380119445",
  appId: "1:1042380119445:web:10f5ae24435bbf288b6a9c",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const rtDb = getDatabase();
export const auth = getAuth();
export const provider = new GoogleAuthProvider();
export const storage = getStorage(app);
