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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  error: null,
  signOutUser: async () => {},
  retryProfileLoad: async () => {},
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

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
      
      return {
        id: userDoc.id,
        email: userData.email || user.email || '',
        role: userData.role || 'user',
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
      
      // Update the document to use UID as document ID for consistency
      await setDoc(doc(db as Firestore, 'users', user.uid), {
        ...userData,
        uid: user.uid,
        email: user.email
      });
      
      return {
        id: user.uid,
        email: userData.email || user.email || '',
        role: userData.role || 'user',
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
      role: 'user',
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
        console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
        // Set loading immediately to prevent consumers from reading stale state
        setLoading(true);
        setUser(user);

        if (user && db) {
          try {
            setError(null);
            const profile = await ensureUserProfile(user);
            setUserProfile(profile);
            console.log('User profile loaded successfully:', profile);
          } catch (err) {
            console.error('Error ensuring user profile:', err);
            setError('Error loading user profile. Please try again.');
          }
        } else {
          setUserProfile(null);
          setError(null);
        }

        setLoading(false);
      });
    };

    initializeAuth();

    return () => unsubscribe();
  }, [isClient]);

  const signOutUser = async () => {
    if (!auth) {
      setError('Auth is not initialized');
      return;
    }

    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setError(null);
      window.location.href = '/login';
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Error signing out');
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
    <AuthContext.Provider value={{ user, userProfile, loading, error, signOutUser, retryProfileLoad }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;