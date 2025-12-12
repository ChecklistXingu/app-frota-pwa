import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBV8uxPwRqfI-1wFCA2Me1jWcdvpLVL-CQ",
  authDomain: "app-frota-1ce38.firebaseapp.com",
  projectId: "app-frota-1ce38",
  storageBucket: "app-frota-1ce38.firebasestorage.app",
  messagingSenderId: "251084236580",
  appId: "1:251084236580:web:68bbeca5a23f59ad99b5b1",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
