'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import { auth, db } from '../firebaseClient';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  businessUnit?: string;
  countries?: string[];
  name?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signOutUser: () => Promise<void>;
  retryProfileLoad: () => Promise<void>;
  isSigningOut: boolean;
  isCreatingUser: boolean;
  setIsCreatingUser: (creating: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userProfile: null,
  loading: true,
  error: null,
  signOutUser: async () => {},
  retryProfileLoad: async () => {},
  isSigningOut: false,
  isCreatingUser: false,
  setIsCreatingUser: () => {},
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Bulletproof user profile creation/loading
  const ensureUserProfile = async (user: User): Promise<UserProfile> => {
    if (!db) throw new Error('Firebase not initialized');

    console.log('Ensuring user profile for:', user.email, 'UID:', user.uid);

    // First, try to get existing profile by UID
    let userDoc = await getDoc(doc(db as Firestore, 'users', user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('Found existing profile by UID:', userData);
      
      // Normalize role: map deprecated 'user' -> 'Employee'
      const normalizedRole = userData.role === 'user' ? 'Employee' : (userData.role || 'Employee');
      if (normalizedRole !== userData.role) {
        try {
          await setDoc(doc(db as Firestore, 'users', user.uid), { role: normalizedRole }, { merge: true });
        } catch (e) {
          console.warn('Failed to persist role normalization', e);
        }
      }
      return {
        id: userDoc.id,
        email: userData.email || user.email || '',
        role: normalizedRole,
        businessUnit: userData.businessUnit || userData.countries?.[0] || '',
        countries: userData.countries || [],
        name: userData.displayName || userData.name || userData.email?.split('@')[0] || 'Unknown User'
      } as UserProfile;
    }

    // If not found by UID, try email lookup
    console.log('Profile not found by UID, trying email lookup...');
    const usersRef = collection(db as Firestore, 'users');
    const q = query(usersRef, where('email', '==', user.email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const existingDoc = querySnapshot.docs[0];
      const userData = existingDoc.data();
      console.log('Found existing profile by email:', userData);
      
      const normalizedRoleEmail = userData.role === 'user' ? 'Employee' : (userData.role || 'Employee');
      if (normalizedRoleEmail !== userData.role) {
        try {
          await setDoc(doc(db as Firestore, 'users', user.uid), { role: normalizedRoleEmail }, { merge: true });
        } catch (e) {
          console.warn('Failed to persist role normalization (email path)', e);
        }
      }
      return {
        id: user.uid,
        email: userData.email || user.email || '',
        role: normalizedRoleEmail,
        businessUnit: userData.businessUnit || userData.countries?.[0] || '',
        countries: userData.countries || [],
        name: userData.displayName || userData.name || userData.email?.split('@')[0] || 'Unknown User'
      } as UserProfile;
    }

    // If no profile exists, create a default one
    console.log('No profile found, creating default profile...');
    const defaultProfile = {
      displayName: user.displayName || user.email?.split('@')[0] || 'Unknown User',
      name: user.displayName || user.email?.split('@')[0] || 'Unknown User',
      email: user.email || '',
      role: 'Employee',
      countries: [],
      businessUnit: 'Unknown',
      uid: user.uid,
      createdAt: new Date()
    };

    await setDoc(doc(db as Firestore, 'users', user.uid), defaultProfile);
    
    console.log('Created default profile:', defaultProfile);
    
    return {
      id: user.uid,
      email: defaultProfile.email,
      role: defaultProfile.role,
      businessUnit: defaultProfile.businessUnit,
      countries: defaultProfile.countries,
      name: defaultProfile.name
    } as UserProfile;
  };

  useEffect(() => {
    if (!isClient) return;

    let unsubscribe = () => {};
    let loadingTimeout: NodeJS.Timeout | null = null;
    let authStateChangeCount = 0; // Track rapid auth state changes

    const initializeAuth = async () => {
      // Wait for Firebase to initialize
      let retries = 0;
      const maxRetries = 20; // Increased retries
      
      while (!auth || !db) {
        if (retries >= maxRetries) {
          setError('Firebase is not properly configured. Please check your environment variables.');
          setLoading(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 200)); // Increased delay
        retries++;
      }

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        authStateChangeCount++;
        console.log(`Auth state changed (${authStateChangeCount}):`, user ? `User: ${user.email}` : 'No user');
        
        // Prevent multiple simultaneous auth state changes during user creation
        if (isSigningOut) {
          console.log('Currently signing out, ignoring auth state change');
          return;
        }
        
        // Prevent processing auth changes during user creation
        if (isCreatingUser) {
          console.log('Currently creating user, ignoring auth state change');
          return;
        }
        
        // If we're getting rapid auth state changes (like during user creation), 
        // wait a bit longer before processing to avoid race conditions
        if (authStateChangeCount > 1) {
          console.log('Rapid auth state changes detected, waiting for stabilization...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Clear any existing timeout
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
        
        // Set loading immediately to prevent consumers from reading stale state
        setLoading(true);
        setUser(user);

        // Set a timeout to prevent infinite loading
        loadingTimeout = setTimeout(() => {
          console.warn('Auth loading timeout - forcing loading to false');
          setLoading(false);
        }, 15000); // Increased timeout to 15 seconds for user creation scenarios

        if (user && db) {
          try {
            setError(null);
            const profile = await ensureUserProfile(user);
            setUserProfile(profile);
            console.log('User profile loaded successfully:', profile);
          } catch (err) {
            console.error('Error ensuring user profile:', err);
            // If user doesn't have a profile (e.g., newly created user), sign them out
            // This prevents React errors from trying to render with incomplete user data
            if (err instanceof Error && err.message.includes('No profile found')) {
              console.log('User has no profile, signing out to prevent errors');
              if (auth) {
                await signOut(auth);
              }
              return;
            }
            setError('Error loading user profile. Please try again.');
            setUserProfile(null);
          }
        } else {
          setUserProfile(null);
          setError(null);
        }
      
        // Clear timeout and set loading to false
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
          loadingTimeout = null;
        }
        setLoading(false);
      });
    };

    initializeAuth();
    
    return () => {
      unsubscribe();
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [isClient, isSigningOut]);

  const signOutUser = async () => {
    if (!auth) {
      setError('Auth is not initialized');
      return;
    }

    try {
      // Set signing out state to prevent other components from interfering
      setIsSigningOut(true);
      setLoading(true);
      
      // Clear secure session cookie first (best-effort)
      try {
        await fetch('/api/auth/session', { method: 'DELETE' });
      } catch (e) {
        // ignore network errors; proceed to client sign out
      }
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Clear user state after successful sign-out
      setUser(null);
      setUserProfile(null);
      setError(null);
      
      // Use a more robust redirect method with longer delay
      setTimeout(() => {
        try {
          window.location.replace('/login');
        } catch (e) {
          // Fallback if replace fails
          window.location.href = '/login';
        }
      }, 200);
      
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Error signing out');
      // Even if there's an error, clear state and redirect to login
      setUser(null);
      setUserProfile(null);
      setLoading(false);
      setIsSigningOut(false);
      setTimeout(() => {
        try {
          window.location.replace('/login');
        } catch (e) {
          window.location.href = '/login';
        }
      }, 200);
    }
  };

  const retryProfileLoad = async () => {
    if (!user || !db) return;
    
    setError(null);
    setLoading(true);
    
    try {
      const profile = await ensureUserProfile(user);
      setUserProfile(profile);
      console.log('Profile load retry successful:', profile);
    } catch (err) {
      console.error('Error retrying profile load:', err);
      setError('Error loading user profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Avoid rendering children until auth has settled to prevent consumers from reading transient nulls
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-md mx-auto" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
          <div className="mt-4 space-x-2">
            <button
              onClick={retryProfileLoad}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, error, signOutUser, retryProfileLoad, isSigningOut, isCreatingUser, setIsCreatingUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthProvider; 