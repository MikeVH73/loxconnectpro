import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD3LGcmPieAnJuGrNUyIRTQw3bQ1Gzsjj0",
  authDomain: "loxconnect-pro.firebaseapp.com",
  projectId: "loxconnect-pro",
  storageBucket: "loxconnect-pro.firebasestorage.app",
  messagingSenderId: "767888928675",
  appId: "1:767888928675:web:e4c6bb3914fc97ecf4b416",
  measurementId: "G-5P1C1YTGQT"
};

// Initialize Firebase only on client side
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

const initializeFirebase = async () => {
  if (typeof window === 'undefined') {
    return { app: undefined, auth: undefined, db: undefined, storage: undefined };
  }

try {
    // Initialize Firebase app if not already initialized
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  
  // Initialize services
    auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

    return { app, auth, db, storage };
} catch (error) {
  console.error('Error initializing Firebase:', error);
    throw error;
  }
};

// Initialize Firebase on import in client
if (typeof window !== 'undefined') {
  initializeFirebase().catch(console.error);
}

export { app, auth, db, storage, initializeFirebase }; 