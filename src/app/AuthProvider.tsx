"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db, initializeFirebase } from "../firebaseClient";
import { doc, getDoc, collection, query, where, getDocs, Firestore } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  countries?: string[];
  businessUnit?: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userProfile: UserProfile | null;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  userProfile: null,
  signOutUser: async () => {} 
});

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const signOutUser = async () => {
    try {
      if (!auth) throw new Error('Auth is not initialized');
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Function to fetch user profile
  const fetchUserProfile = async (firebaseUser: User): Promise<UserProfile | null> => {
    if (!db) throw new Error('Firestore is not initialized');

        try {
          // First try to get user profile by UID (new method)
      const userDoc = await getDoc(doc(db as Firestore, "users", firebaseUser.uid));
          
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('Found user profile by UID:', userData);
        return {
          id: userDoc.id,
          email: userData.email,
          role: userData.role,
          countries: userData.countries,
          businessUnit: userData.businessUnit,
          name: userData.name
        };
      }

            // Fallback: search by email for existing users (old method)
            const usersQuery = query(
              collection(db as Firestore, "users"), 
              where("email", "==", firebaseUser.email)
            );
            const querySnapshot = await getDocs(usersQuery);
            
            if (!querySnapshot.empty) {
              const userData = querySnapshot.docs[0].data();
        console.log('Found user profile by email:', userData);
        return {
          id: querySnapshot.docs[0].id,
          email: userData.email,
          role: userData.role,
          countries: userData.countries,
          businessUnit: userData.businessUnit,
          name: userData.name
        };
      }

              console.warn("No user profile found for:", firebaseUser.email);
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw error;
    }
  };

  // Separate effect for Firebase initialization and auth state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let unsubscribe: () => void;

    const initialize = async () => {
      try {
        setLoading(true);
        const { auth: initializedAuth, db: initializedDb } = await initializeFirebase();
        
        if (!initializedAuth || !initializedDb) {
          throw new Error('Firebase services not initialized properly');
        }

        unsubscribe = onAuthStateChanged(initializedAuth, async (firebaseUser) => {
          console.log('Auth state changed:', firebaseUser?.email);
          setUser(firebaseUser);
          
          if (firebaseUser) {
            try {
              const profile = await fetchUserProfile(firebaseUser);
              setUserProfile(profile);
              
              if (!profile) {
                console.error('No user profile found after authentication');
                await signOutUser();
                return;
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
              setInitializationError('Failed to load user profile');
        }
      } else {
        setUserProfile(null);
        if (pathname !== '/login') {
          router.replace('/login');
        }
      }
      
      setLoading(false);
    });
      } catch (error) {
        console.error('Error during initialization:', error);
        setInitializationError('Failed to initialize application');
        setLoading(false);
      }
    };

    initialize();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [pathname, router]);

  if (initializationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Initialization Error</h2>
          <p className="text-gray-600">{initializationError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, userProfile, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider; 