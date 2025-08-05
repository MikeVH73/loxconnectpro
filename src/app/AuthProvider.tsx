'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, Firestore } from 'firebase/firestore';
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

  useEffect(() => {
    if (!isClient) return;

    let unsubscribe = () => {};

    const initializeAuth = async () => {
      // Wait a bit for Firebase to initialize
      let retries = 0;
      const maxRetries = 10;
      
      while (!auth || !db) {
        if (retries >= maxRetries) {
          setError('Firebase is not properly configured. Please check your environment variables.');
          setLoading(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user);

        if (user && db) {
          try {
            console.log('Auth state changed - user:', user.email, 'UID:', user.uid);
            
            // Try to get user profile by UID first
            const userDoc = await getDoc(doc(db as Firestore, 'users', user.uid));

            if (userDoc.exists()) {
              const userData = userDoc.data();
              console.log('Found user profile by UID:', userData);
              
              // Map database fields to UserProfile interface with better fallbacks
              setUserProfile({
                id: userDoc.id,
                email: userData.email || user.email || '',
                role: userData.role || 'user',
                businessUnit: userData.businessUnit || userData.countries?.[0] || '',
                countries: userData.countries || [],
                name: userData.displayName || userData.name || userData.email?.split('@')[0] || 'Unknown User'
              } as UserProfile);
            } else {
              // Fallback to email lookup - query by email field
              console.log('User profile not found by UID, trying email lookup for:', user.email);
              
              // Import the necessary Firestore functions
              const { collection, query, where, getDocs } = await import('firebase/firestore');
              
              try {
                const usersRef = collection(db as Firestore, 'users');
                const q = query(usersRef, where('email', '==', user.email));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  const userDoc = querySnapshot.docs[0];
                  const userData = userDoc.data();
                  console.log('Found user profile by email:', userData);
                  
                  // Map database fields to UserProfile interface with better fallbacks
                  setUserProfile({
                    id: userDoc.id,
                    email: userData.email || user.email || '',
                    role: userData.role || 'user',
                    businessUnit: userData.businessUnit || userData.countries?.[0] || '',
                    countries: userData.countries || [],
                    name: userData.displayName || userData.name || userData.email?.split('@')[0] || 'Unknown User'
                  } as UserProfile);
                } else {
                  console.error('No user profile found for email:', user.email);
                  // Don't sign out immediately, just set an error
                  setError('User profile not found. Please contact your administrator.');
                  // Don't sign out - let the user try to refresh
                }
              } catch (emailLookupError) {
                console.error('Error in email lookup:', emailLookupError);
                setError('Error fetching user profile');
                // Don't sign out - let the user try to refresh
              }
            }
          } catch (err) {
            console.error('Error fetching user profile:', err);
            setError('Error fetching user profile');
            // Don't sign out - let the user try to refresh
          }
        } else {
          setUserProfile(null);
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
      console.log('Retrying profile load for user:', user.email);
      
      // Try to get user profile by UID first
      const userDoc = await getDoc(doc(db as Firestore, 'users', user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('Found user profile by UID on retry:', userData);
        
        setUserProfile({
          id: userDoc.id,
          email: userData.email || user.email || '',
          role: userData.role || 'user',
          businessUnit: userData.businessUnit || userData.countries?.[0] || '',
          countries: userData.countries || [],
          name: userData.displayName || userData.name || userData.email?.split('@')[0] || 'Unknown User'
        } as UserProfile);
      } else {
        // Fallback to email lookup
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        
        const usersRef = collection(db as Firestore, 'users');
        const q = query(usersRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          console.log('Found user profile by email on retry:', userData);
          
          setUserProfile({
            id: userDoc.id,
            email: userData.email || user.email || '',
            role: userData.role || 'user',
            businessUnit: userData.businessUnit || userData.countries?.[0] || '',
            countries: userData.countries || [],
            name: userData.displayName || userData.name || userData.email?.split('@')[0] || 'Unknown User'
          } as UserProfile);
        } else {
          setError('User profile not found. Please contact your administrator.');
        }
      }
    } catch (err) {
      console.error('Error retrying profile load:', err);
      setError('Error fetching user profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application...</p>
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
            {error.includes('Firebase') && (
              <p className="text-sm mt-2">
                Please make sure all required environment variables are set in .env.local
              </p>
            )}
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