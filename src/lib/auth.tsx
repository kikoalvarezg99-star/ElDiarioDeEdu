"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Role = "owner" | "dietitian" | "client";

export type Profile = {
  id: string;
  clinic_id: string;
  role: Role;
  first_name: string;
  last_name: string;
  phone: string | null;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** true mientras se comprueba la sesión o se carga el perfil */
  loading: boolean;
  isStaff: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialised, setInitialised] = useState(false);
  // id del usuario para el que ya se ha cargado el perfil
  const [profileFor, setProfileFor] = useState<string | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setProfileFor(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
    setProfileFor(uid);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitialised(true);
      void loadProfile(data.session?.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Evita llamar a Supabase dentro del propio callback
      setTimeout(() => {
        void loadProfile(s?.user.id);
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    await loadProfile(session?.user.id);
  }, [loadProfile, session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setProfileFor(null);
  }, []);

  const loading =
    !initialised || (!!session && profileFor !== session.user.id);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      isStaff: !!profile && profile.role !== "client",
      refresh,
      signOut,
    }),
    [session, profile, loading, refresh, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return v;
}
