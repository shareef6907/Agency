"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/lib/roles";

type Profile = { id: string; full_name: string; role: Role; active: boolean };
type Ctx = { profile: Profile | null; loading: boolean; signOut: () => void };
const AuthCtx = createContext<Ctx>({ profile: null, loading: true, signOut: () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setProfile(null); setLoading(false); router.replace("/login"); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setProfile(data as Profile); setLoading(false);
  }

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) { setProfile(null); router.replace("/login"); }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    router.replace("/login");
  }

  return <AuthCtx.Provider value={{ profile, loading, signOut }}>{children}</AuthCtx.Provider>;
}
