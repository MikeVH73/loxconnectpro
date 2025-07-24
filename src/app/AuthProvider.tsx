'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, Firestore } from 'firebase/firestore';
import { auth, db } from '../firebaseClient';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  businessUnit?: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  error: null,
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user && db) {
        try {
          // Try to get user profile by UID first
          const userDoc = await getDoc(doc(db as Firestore, 'users', user.uid));
          
          if (userDoc.exists()) {
            setUserProfile({
              id: userDoc.id,
              ...userDoc.data()
            } as UserProfile);
          } else {
            // If no profile found by UID, try to find by email
            const userByEmailDoc = await getDoc(doc(db as Firestore, 'users', user.email || ''));
            
            if (userByEmailDoc.exists()) {
              setUserProfile({
                id: userByEmailDoc.id,
                ...userByEmailDoc.data()
              } as UserProfile);
            } else {
              // No profile found at all
              console.error('No user profile found');
              setError('No user profile found');
              auth.signOut();
            }
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setError('Error fetching user profile');
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthProvider; 