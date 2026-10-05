import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, loginWithGoogle, loginAsGuest, logoutUser, handleFirestoreError, OperationType } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  uid: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  uid: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInGuest: async () => {},
  signOut: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guestId] = useState<string>(() => {
    let stored = localStorage.getItem('zoya_local_guest_uid');
    if (!stored) {
      stored = 'guest_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('zoya_local_guest_uid', stored);
    }
    return stored;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Sync user profile document to Cloud Firestore
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Zoya Explorer',
              photoURL: currentUser.photoURL || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } else {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || snap.data()?.displayName || 'Zoya Explorer',
              photoURL: currentUser.photoURL || '',
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        } catch (e) {
          // If Firestore is temporarily unreachable, do not crash
          console.warn('[Auth] Could not sync user profile to Firestore:', e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignInGoogle = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        console.error('[Auth] Sign in with Google error:', err);
      }
    }
  };

  const handleSignInGuest = async () => {
    try {
      await loginAsGuest();
    } catch (err) {
      console.error('[Auth] Sign in as Guest error:', err);
    }
  };

  const handleSignOut = async () => {
    await logoutUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        uid: user?.uid || guestId,
        loading,
        signInWithGoogle: handleSignInGoogle,
        signInGuest: handleSignInGuest,
        signOut: handleSignOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
