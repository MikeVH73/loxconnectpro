import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD3LGcmPieAnJuGrNUyIRTQw3bQ1Gzsjj0",
  authDomain: "loxconnect-pro.firebaseapp.com",
  projectId: "loxconnect-pro",
  storageBucket: "loxconnect-pro.appspot.com",
  messagingSenderId: "767888928675",
  appId: "1:767888928675:web:abcdef123456",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); 