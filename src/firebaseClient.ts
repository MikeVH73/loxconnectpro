import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, Firestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
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
    
    // Initialize Firestore with persistence settings
    db = initializeFirestore(app, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      experimentalForceLongPolling: true,
    });

    // Initialize other services
    auth = getAuth(app);
    storage = getStorage(app);

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