import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD3LGcmPieAnJuGrNUyIRTQw3bQ1Gzsjj0",
  authDomain: "loxconnect-pro.firebaseapp.com",
  projectId: "loxconnect-pro",
  storageBucket: "loxconnect-pro.firebasestorage.app",
  messagingSenderId: "767888928675",
  appId: "1:767888928675:web:e4c6bb3914fc97ecf4b416",
  measurementId: "G-5P1C1YTGQT"
};

// Initialize Firebase only on the client side
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  try {
    // Initialize Firebase app if not already initialized
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    
    // Initialize services
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);

    // Enable persistence only on the client side
    if (db) {
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
          console.warn('The current browser does not support persistence.');
        }
      });
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }
} else {
  // For SSR, provide mock implementations
  app = undefined;
  db = undefined;
  auth = undefined;
  storage = undefined;
}

export { app, db, auth, storage }; 