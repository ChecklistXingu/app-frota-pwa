import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
export const storage = getStorage(app);

// Ativa persistência offline do Firestore
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Múltiplas abas abertas - persistência só funciona em uma
    console.warn("[Firestore] Persistência offline indisponível: múltiplas abas");
  } else if (err.code === "unimplemented") {
    // Navegador não suporta
    console.warn("[Firestore] Navegador não suporta persistência offline");
  }
});
