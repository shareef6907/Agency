"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Clapperboard } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.replace("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={signIn} className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gold flex items-center justify-center">
            <Clapperboard className="w-6 h-6 text-ink" />
          </div>
          <div>
            <div className="text-lg font-bold leading-tight">Studio OS</div>
            <div className="text-xs text-muted">Agency operations</div>
          </div>
        </div>
        <label className="label">Email</label>
        <input className="input mb-3" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" required />
        <label className="label">Password</label>
        <input className="input mb-4" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        {err && <div className="text-red-400 text-sm mb-3">{err}</div>}
        <button className="btn btn-gold w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-xs text-muted mt-4 text-center">
          Accounts are created by the CEO. Ask for your login.
        </p>
      </form>
    </div>
  );
}
