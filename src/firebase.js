import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB1JPkTQ7ByA9ddiidsFWDAlKv8cR9Ijks",
  authDomain: "chatapp-56ac3.firebaseapp.com",
  projectId: "chatapp-56ac3",
  storageBucket: "chatapp-56ac3.appspot.com",
  messagingSenderId: "829996504113",
  appId: "1:829996504113:web:6fd7a1f8005052fce1f110",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth();
export const provider = new GoogleAuthProvider();
export const storage = getStorage(app);
