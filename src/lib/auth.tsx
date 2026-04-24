import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

export type ProfileRole = "Employee" | "Manager" | "Admin";
export type Profile = {
  id: string;
  email: string;
  name: string;
  role: ProfileRole;
  dept?: string;
  face_registered?: boolean;
  face_descriptor?: number[];
  password?: string;
  branch_id?: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin?: boolean;
  isManager?: boolean;
  isDevMode?: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(user: User | null) {
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,name,role,dept,face_registered,face_descriptor,branch_id")
    .eq("id", user.id)
    .single();

  if (error && !data) {
    // If profile doesn't exist, try to create it (though the trigger should handle this)
    const name = user.user_metadata?.full_name || user.email || "Unknown";
    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        name,
        role: "Employee",
        face_registered: false,
      })
      .select("id,email,name,role,dept,face_registered,face_descriptor,branch_id")
      .single();
    
    if (insertError) {
      console.error("Error creating profile:", insertError);
      return null;
    }
    return (inserted as Profile) ?? null;
  }

  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // 1. Check manual session first
      const savedSession = localStorage.getItem("sb_custom_session");
      if (savedSession) {
        try {
          const { profile: p } = JSON.parse(savedSession);
          if (mounted) {
            setProfile(p);
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem("sb_custom_session");
        }
      }

      // 2. Fallback to Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        setUser(session.user);
        const fetchedProfile = await fetchProfile(session.user);
        if (mounted) setProfile(fetchedProfile);
      }
      if (mounted) setLoading(false);
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      // If we have a manual session, don't let Supabase Auth override it for nulls
      if (localStorage.getItem("sb_custom_session")) {
        if (event === 'SIGNED_OUT') {
           return;
        }
      }

      if (session?.user) {
        setUser(session.user);
        const p = await fetchProfile(session.user);
        if (mounted) setProfile(p);
      } else if (!localStorage.getItem("sb_custom_session")) {
        setUser(null);
        setProfile(null);
      }
      
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    let userId = profile?.id || user?.id;
    if (!userId) return;
    
    setLoading(true);
    const { data } = await supabase.rpc('get_profile_by_id', { p_id: userId }).maybeSingle();
    if (data) {
      setProfile(data as Profile);
      if (localStorage.getItem("sb_custom_session")) {
        localStorage.setItem("sb_custom_session", JSON.stringify({
          profile: data,
          timestamp: Date.now(),
        }));
      }
    }
    setLoading(false);
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signIn: async (email: string, password: string) => {
        setLoading(true);
        
        // Custom Login Logic: Use RPC to bypass RLS for non-authenticated users
        const { data: profileData, error: profileError } = await supabase
          .rpc('check_credentials', { p_email: email, p_password: password })
          .maybeSingle();

        if (!profileError && profileData) {
          const profile = profileData as Profile;
          setProfile(profile);
          localStorage.setItem("sb_custom_session", JSON.stringify({
            profile: profile,
            timestamp: Date.now(),
          }));
          setLoading(false);
          return;
        }

        // Fallback to Supabase Auth if custom check fails
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          setLoading(false);
          throw new Error("Invalid login credentials. Please check your email and password.");
        }
      },
      signUp: async (email: string, password: string, fullName: string) => {
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        
        if (error) {
          setLoading(false);
          throw error;
        }

        if (data.user) {
          await supabase
            .from("profiles")
            .update({ password })
            .eq("id", data.user.id);
        }
      },
      signOut: async () => {
        setLoading(true);
        localStorage.removeItem("sb_custom_session");
        await supabase.auth.signOut().catch(() => {});
        setUser(null);
        setProfile(null);
        setLoading(false);
      },
      refreshProfile,
      isAdmin: profile?.role?.toLowerCase() === "admin",
      isManager: profile?.role?.toLowerCase() === "manager",
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
