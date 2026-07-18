"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { PageHead, Badge, Empty, Money } from "@/components/ui";
import { Field, Modal } from "@/components/form";
import { can } from "@/lib/roles";
import { useRealtime } from "@/lib/useRealtime";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

const BLANK = {
  name: "", contact_person: "", designation: "", email: "", phone: "",
  package_tier: "starter", monthly_fee: 0, start_date: format(new Date(), "yyyy-MM-dd"),
  end_date: "", status: "active", assigned_to: "", notes: "",
};

export default function Clients() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(BLANK);
  const editable = can(profile?.role || null, "crm"); // ceo + sales_manager manage clients

  async function load() {
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    setRows(data || []);
    const { data: t } = await supabase.from("profiles").select("id,full_name,role");
    setTeam(t || []);
  }
  useEffect(() => { load(); }, []);
  useRealtime(["clients"], load);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, monthly_fee: Number(form.monthly_fee), assigned_to: form.assigned_to || null, end_date: form.end_date || null };
    const { error } = await supabase.from("clients").insert(payload);
    if (error) { alert("Could not save client: " + error.message); return; }
    setForm(BLANK); setOpen(false); load();
  }

  const name = (id: string) => team.find((t) => t.id === id)?.full_name || "—";
  const isCeo = profile?.role === "ceo";

  async function remove(id: string, label: string) {
    if (!confirm(`Delete client "${label}"? This cannot be undone.`)) return;
    await supabase.from("clients").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <PageHead title="Clients" sub="Every retainer client and what they pay."
        action={editable ? <button className="btn btn-gold" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Add client</button> : undefined} />
      {rows.length === 0 ? <Empty text="No clients yet." /> :
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr>{["Client","Tier","Monthly fee","Status","Start","End","Assigned","Contact",""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-panel2/50">
                  <td className="td font-semibold">{c.name}</td>
                  <td className="td capitalize">{c.package_tier}</td>
                  <td className="td"><Money n={c.monthly_fee} /></td>
                  <td className="td"><Badge value={c.status} /></td>
                  <td className="td whitespace-nowrap text-muted">{c.start_date ? format(new Date(c.start_date), "dd MMM yy") : "—"}</td>
                  <td className="td whitespace-nowrap text-muted">{c.end_date ? format(new Date(c.end_date), "dd MMM yy") : "—"}</td>
                  <td className="td text-muted">{name(c.assigned_to)}</td>
                  <td className="td text-muted">{c.contact_person}{c.phone ? ` · ${c.phone}` : ""}</td>
                  <td className="td text-right">{isCeo && <button onClick={() => remove(c.id, c.name)} className="text-muted hover:text-red-400" title="Delete client"><Trash2 className="w-4 h-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

      {open && (
        <Modal title="Add client" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Client / company name" full><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Package tier">
              <select className="input" value={form.package_tier} onChange={(e) => setForm({ ...form, package_tier: e.target.value })}>
                <option value="starter">Starter</option><option value="growth">Growth</option><option value="premium">Premium</option><option value="custom">Custom</option><option value="projects">By Projects</option>
              </select>
            </Field>
            <Field label="Monthly fee (SAR)"><input type="number" className="input" value={form.package_tier === 'projects' ? 0 : form.monthly_fee} disabled={form.package_tier === 'projects'} onChange={(e) => setForm({ ...form, package_tier: form.package_tier, monthly_fee: form.package_tier === 'projects' ? 0 : Number(e.target.value) })} /></Field>
            <Field label="Start date"><input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="Contract end date"><input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="paused">Paused</option><option value="churned">Churned</option>
              </select>
            </Field>
            <Field label="Contact person"><input className="input" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Assigned to">
              <select className="input" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">— unassigned —</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </Field>
            <Field label="Notes" full><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-gold">Save client</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
