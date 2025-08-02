import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore, CACHE_SIZE_UNLIMITED, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Initialize Firebase only on the client side
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

function initializeFirebase() {
  if (!isBrowser) {
    return { app: undefined, db: undefined, auth: undefined, storage: undefined };
  }

  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    };

    // Check if any required config is missing
    const missingVars = Object.entries(firebaseConfig)
      .filter(([key, value]) => !value && key !== 'measurementId')
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.warn('Missing Firebase configuration:', missingVars);
      return { app: undefined, db: undefined, auth: undefined, storage: undefined };
    }

    // Initialize Firebase app if not already initialized
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }

    // Initialize Firestore with settings
    if (!db && app) {
      db = initializeFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        experimentalForceLongPolling: true,
      });

      // Enable offline persistence
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
          console.warn('The current browser doesn\'t support all of the features required to enable persistence');
        }
      });
    }

    // Initialize Auth
    if (!auth && app) {
      auth = getAuth(app);
    }

    // Initialize Storage
    if (!storage && app) {
      storage = getStorage(app);
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