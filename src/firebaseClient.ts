import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: "G-5P1C1YTGQT"
};

// Initialize Firebase only on the client side
let app: FirebaseApp | undefined = undefined;
let db: Firestore | undefined = undefined;
let auth: Auth | undefined = undefined;
let storage: FirebaseStorage | undefined = undefined;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

function initializeFirebase() {
  if (!isBrowser) {
    return { app: undefined, db: undefined, auth: undefined, storage: undefined };
  }

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

    return { app, db, auth, storage };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return { app: undefined, db: undefined, auth: undefined, storage: undefined };
  }
}

// Initialize Firebase if we're in the browser
if (isBrowser) {
  const { app: initializedApp, db: initializedDb, auth: initializedAuth, storage: initializedStorage } = initializeFirebase();
  app = initializedApp;
  db = initializedDb;
  auth = initializedAuth;
  storage = initializedStorage;
}

export { app, db, auth, storage }; 