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
    // App Check is now enabled with hardcoded reCAPTCHA key to avoid process.env issues
    const enableAppCheck = true;
    const recaptchaKey = "6LfXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // TODO: Replace with actual reCAPTCHA Enterprise site key from Firebase Console
    
    if (enableAppCheck && app && recaptchaKey && recaptchaKey !== "6LfXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX") {
      // dynamic import to avoid hard dependency when disabled
      import('firebase/app-check').then(async ({ initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, onTokenChanged }) => {
        try {
          const appCheck = initializeAppCheck(app as any, {
            provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
            isTokenAutoRefreshEnabled: true,
          });
          // Optional debug logging when explicitly enabled
          const debug = false;
          if (debug) {
            try {
              const token = await getToken(appCheck, /* forceRefresh */ true);
              // eslint-disable-next-line no-console
              console.log('[AppCheck] initial token obtained:', !!token?.token);
            } catch (err) {
              console.warn('[AppCheck] getToken failed', err);
            }
            onTokenChanged(appCheck, (t) => {
              // eslint-disable-next-line no-console
              console.log('[AppCheck] token changed:', !!t?.token);
            });
          }
        } catch (e) {
          console.warn('App Check initialization failed (continuing without it):', e);
        }
      }).catch(() => {
        // no-op
      });
    } else if (enableAppCheck && recaptchaKey === "6LfXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX") {
      console.warn('[App Check] Please replace the placeholder reCAPTCHA key with your actual site key from Firebase Console');
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