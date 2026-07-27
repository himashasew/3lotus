import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getAuth,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { initializeApp } from 'firebase/app';

const AuthContext = createContext(null);

// Role hierarchy (higher number = more access)
export const ROLES = {
  CLIENT: { level: 1, label: 'Client' },
  DELIVERY: { level: 2, label: 'Delivery' },
  KITCHEN: { level: 3, label: 'Kitchen Staff' },
  SALES: { level: 4, label: 'Sales' },
  MANAGER: { level: 5, label: 'Manager' },
  ADMIN: { level: 6, label: 'Admin' },
  DEVELOPER: { level: 7, label: 'Developer' },
};

// Secondary app for creating users without logging out the current user
const secondaryApp = initializeApp(auth.app.options, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data());
        } else {
          // First-ever user becomes Developer
          const defaultProfile = {
            email: firebaseUser.email,
            displayName: firebaseUser.email.split('@')[0],
            role: 'DEVELOPER',
            createdAt: new Date().toISOString(),
          };
          await setDoc(profileRef, defaultProfile);
          setUserProfile(defaultProfile);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  // Create a new user without logging out the current admin/developer
  const createNewUser = async (email, password, role, displayName) => {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = userCredential.user;
    // Save profile to Firestore
    await setDoc(doc(db, 'users', newUser.uid), {
      email,
      displayName: displayName || email.split('@')[0],
      role,
      createdAt: new Date().toISOString(),
    });
    // Sign out of secondary auth so it doesn't persist
    await signOut(secondaryAuth);
    return newUser;
  };

  const hasAccess = (requiredRole) => {
    if (!userProfile) return false;
    const userRoleLevel = ROLES[userProfile.role]?.level || 0;
    const requiredLevel = ROLES[requiredRole]?.level || 0;
    return userRoleLevel >= requiredLevel;
  };

  const value = {
    user,
    userProfile,
    loading,
    login,
    logout,
    createNewUser,
    hasAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
