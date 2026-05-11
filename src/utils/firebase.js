import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCAqJz_PuowqC7Dw1crByf2GkcvrjQy-_U",
  authDomain: "mags-2048.firebaseapp.com",
  projectId: "mags-2048",
  storageBucket: "mags-2048.firebasestorage.app",
  messagingSenderId: "241369797969",
  appId: "1:241369797969:android:73769c6497a3f77ef3af70"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);