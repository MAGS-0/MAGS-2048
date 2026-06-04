import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuration derived from your google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyCAqJz_PuowqC7Dw1crByf2GkcvrjQy-_U",
  authDomain: "mags-2048.firebaseapp.com",
  projectId: "mags-2048",
  storageBucket: "mags-2048.firebasestorage.app",
  messagingSenderId: "241369797969",
  appId: "1:241369797969:android:73769c6497a3f77ef3af70",
  databaseURL: "https://mags-2048-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);