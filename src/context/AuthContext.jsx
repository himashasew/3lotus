import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, supabaseConfigured } from '../services/supabase';

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

const toProfile = (row) => ({
  email: row.email,
  displayName: row.display_name,
  role: row.role,
  fontSize: row.font_size,
  createdAt: row.created_at,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setProfileError(new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'));
      setLoading(false);
      return;
    }

    let cancelled = false;

    const applySession = async (session) => {
      if (!session?.user) {
        setUser(null);
        setUserProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      const authUser = session.user;
      // Hold the app on "Loading..." until the profile (and so the role) is known
      setLoading(true);
      setProfileError(null);
      setUser({ uid: authUser.id, email: authUser.email });

      const { data, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (cancelled) return;

      if (error) {
        console.error('Profile load error:', error);
        setUserProfile(null);
        setProfileError(error);
      } else if (!data) {
        setUserProfile(null);
        setProfileError(new Error('No profile exists for this account. Ask an administrator to recreate it.'));
      } else {
        setUserProfile(toProfile(data));
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refreshes keep the same user; no need to reload the profile
      if (event === 'TOKEN_REFRESHED') return;
      // Defer: awaiting supabase calls inside this callback can deadlock the auth client
      setTimeout(() => applySession(session), 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Apply font size preference
  useEffect(() => {
    if (userProfile?.fontSize) {
      let size = '16px'; // medium default
      if (userProfile.fontSize === 'small') size = '14px';
      if (userProfile.fontSize === 'large') size = '18px';
      document.documentElement.style.fontSize = size;
    } else {
      document.documentElement.style.fontSize = '16px';
    }
  }, [userProfile?.fontSize]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = () => supabase.auth.signOut();

  const changePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  // Creates a user through the server function so the current admin stays signed in
  const createNewUser = async (email, password, role, displayName) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'create', email, password, role, displayName }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not create user');
    return body;
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
    profileError,
    login,
    logout,
    changePassword,
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
