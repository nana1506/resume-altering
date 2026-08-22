'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { fetchWithAuth } from '@/lib/api';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  headline?: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  bio?: string;
  role: string;
  status: string;
  terms_agreed: boolean;
  terms_agreed_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => null,
  signOut: async () => {},
});

const ADMIN_EMAIL = 'isnan.rizqikurniawan@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProfile = useCallback(async (currentUser: User | null): Promise<UserProfile | null> => {
    if (!currentUser) {
      setProfile(null);
      return null;
    }
    try {
      const data: UserProfile = await fetchWithAuth('/api/user/profile');
      setProfile(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      // Fallback local profile structure
      const fallback: UserProfile = {
        id: currentUser.id,
        email: currentUser.email || '',
        role: currentUser.email === ADMIN_EMAIL ? 'admin' : 'user',
        status: 'active',
        terms_agreed: false,
      };
      setProfile(fallback);
      return fallback;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user ?? null;
    return await fetchProfile(currentUser);
  }, [supabase, fetchProfile]);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        if (isMounted) {
          setUser(currentUser);
        }
        if (currentUser) {
          await fetchProfile(currentUser);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (isMounted) {
        setUser(currentUser);
      }
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        if (isMounted) {
          setProfile(null);
        }
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isAdmin = Boolean(
    profile?.role === 'admin' ||
    user?.email === ADMIN_EMAIL ||
    profile?.email === ADMIN_EMAIL
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
