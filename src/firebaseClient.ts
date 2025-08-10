import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore, CACHE_SIZE_UNLIMITED, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
// App Check imports are optional; guarded by feature flag
// We keep them in a dynamic import to avoid affecting SSR bundling

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
    // Use hardcoded values for client-side to avoid process.env issues
    const firebaseConfig = {
      apiKey: "AIzaSyD3LGcmPieAnJuGrNUyIRTQw3bQ1Gzsjj0",
      authDomain: "loxconnect-pro.firebaseapp.com",
      projectId: "loxconnect-pro",
      storageBucket: "loxconnect-pro.firebasestorage.app",
      messagingSenderId: "767888928675",
      appId: "1:767888928675:web:e4c6bb3914fc97ecf4b416",
      measurementId: "G-5P1C1YTGQT"
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

    // Optional: Initialize App Check (feature-flagged, non-breaking)
    // Set NEXT_PUBLIC_ENABLE_APP_CHECK=true and NEXT_PUBLIC_RECAPTCHA_KEY in env to enable
    const enableAppCheck = (typeof process !== 'undefined') && (process as any)?.env?.NEXT_PUBLIC_ENABLE_APP_CHECK === 'true';
    const recaptchaKey = (typeof process !== 'undefined') && (process as any)?.env?.NEXT_PUBLIC_RECAPTCHA_KEY;
    if (enableAppCheck && app && recaptchaKey) {
      // dynamic import to avoid hard dependency when disabled
      import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
        try {
          initializeAppCheck(app as any, {
            provider: new ReCaptchaEnterpriseProvider(recaptchaKey as string),
            isTokenAutoRefreshEnabled: true,
          });
        } catch (e) {
          console.warn('App Check initialization failed (continuing without it):', e);
        }
      }).catch(() => {
        // no-op
      });
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