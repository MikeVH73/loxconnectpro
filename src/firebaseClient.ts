import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { FirebaseError } from 'firebase/app';

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

console.log('Firebase configuration:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '(present)' : '(missing)',
});

// Initialize Firebase
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

try {
  // Initialize Firebase only if it hasn't been initialized already
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    // Only initialize analytics on the client side
    if (typeof window !== 'undefined') {
      getAnalytics(app);
    }
    console.log('Firebase app initialized successfully');
  } else {
    app = getApps()[0];
    console.log('Using existing Firebase app');
  }
  
  // Initialize services
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  console.log('Firebase services initialized');

} catch (error) {
  console.error('Error initializing Firebase:', error);
  if (error instanceof FirebaseError) {
    throw new Error(`Failed to initialize Firebase: ${error.message}`);
  } else {
    throw new Error('Failed to initialize Firebase: Unknown error');
  }
}

if (!db || !auth || !storage) {
  throw new Error('Firebase services not initialized properly');
}

export { db, auth, storage }; 