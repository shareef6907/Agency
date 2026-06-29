"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/lib/useRealtime";
import { PageHead, Empty } from "@/components/ui";
import { Field, Modal } from "@/components/form";
import { ROLE_LABEL, Role } from "@/lib/roles";
import { UserPlus, Trash2 } from "lucide-react";

const ROLES: Role[] = ["ceo", "sales_manager", "account_manager", "editor", "accountant"];
const BLANK = { full_name: "", email: "", password: "", role: "editor" as Role };

export default function Team() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(BLANK);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { profile: me } = useAuth();

  async function load() {
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);
  useRealtime(["profiles"], load);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(json.error || "Failed"); return; }
    setForm(BLANK); setOpen(false); load();
  }

  async function remove(id: string, name: string) {
    if (id === me?.id) { alert("You can't delete your own account."); return; }
    if (!confirm(`Remove ${name}? Their login will stop working immediately.`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error || "Failed to remove"); return; }
    load();
  }

  return (
    <div>
      <PageHead title="Team" sub="Create and manage employee accounts."
        action={<button className="btn btn-gold" onClick={() => setOpen(true)}><UserPlus className="w-4 h-4" /> Add employee</button>} />
      {rows.length === 0 ? <Empty text="No team members yet." /> :
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr>{["Name","Role","Status",""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="td font-semibold">{p.full_name || "—"}</td>
                  <td className="td text-gold">{ROLE_LABEL[p.role as Role]}</td>
                  <td className="td">{p.active ? <span className="text-teal text-sm">Active</span> : <span className="text-muted text-sm">Inactive</span>}</td>
                  <td className="td text-right">{p.id !== me?.id && <button onClick={() => remove(p.id, p.full_name || "this user")} className="text-muted hover:text-red-400" title="Remove employee"><Trash2 className="w-4 h-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

      {open && (
        <Modal title="Add employee" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Full name" full><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></Field>
            <Field label="Email"><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <Field label="Password"><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></Field>
            <Field label="Role" full>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            {msg && <div className="sm:col-span-2 text-red-400 text-sm">{msg}</div>}
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-gold" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
