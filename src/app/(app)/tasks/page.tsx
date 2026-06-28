"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { PageHead, Badge, Empty } from "@/components/ui";
import { Field, Modal } from "@/components/form";
import { Plus } from "lucide-react";
import { format } from "date-fns";

const COLS = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];
const BLANK = { title: "", description: "", assigned_to: "", client_id: "", priority: "normal", due_date: "" };

export default function Tasks() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(BLANK);
  const manager = profile?.role === "ceo" || profile?.role === "account_manager";

  async function load() {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    setRows(data || []);
    const { data: t } = await supabase.from("profiles").select("id,full_name");
    setTeam(t || []);
    const { data: c } = await supabase.from("clients").select("id,name");
    setClients(c || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("tasks").insert({
      ...form, assigned_to: form.assigned_to || null, client_id: form.client_id || null,
      due_date: form.due_date || null, created_by: profile?.id,
    });
    setForm(BLANK); setOpen(false); load();
  }
  async function move(id: string, status: string) {
    await supabase.from("tasks").update({ status }).eq("id", id); load();
  }
  const name = (id: string) => team.find((t) => t.id === id)?.full_name || "—";
  const cname = (id: string) => clients.find((c) => c.id === id)?.name;

  return (
    <div>
      <PageHead title="Tasks" sub={manager ? "Assign and track work across the team." : "Your assigned tasks."}
        action={manager ? <button className="btn btn-gold" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> New task</button> : undefined} />
      {rows.length === 0 ? <Empty text="No tasks yet." /> :
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLS.map((col) => (
            <div key={col.key} className="card p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="font-semibold text-sm">{col.label}</span>
                <span className="text-xs text-muted">{rows.filter((r) => r.status === col.key).length}</span>
              </div>
              <div className="space-y-2">
                {rows.filter((r) => r.status === col.key).map((t) => (
                  <div key={t.id} className="bg-panel2 border border-line rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm">{t.title}</div>
                      <Badge value={t.priority} />
                    </div>
                    {t.description && <div className="text-xs text-muted mt-1">{t.description}</div>}
                    <div className="text-[11px] text-muted mt-2 flex flex-wrap gap-x-2">
                      <span>{name(t.assigned_to)}</span>
                      {cname(t.client_id) && <span>· {cname(t.client_id)}</span>}
                      {t.due_date && <span>· due {format(new Date(t.due_date), "dd MMM")}</span>}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {COLS.filter((c) => c.key !== t.status).map((c) => (
                        <button key={c.key} onClick={() => move(t.id, c.key)} className="text-[11px] px-2 py-0.5 rounded border border-line text-muted hover:text-white hover:border-gold">→ {c.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {rows.filter((r) => r.status === col.key).length === 0 && <div className="text-xs text-muted px-1 py-3">None</div>}
              </div>
            </div>
          ))}
        </div>}

      {open && (
        <Modal title="New task" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Title" full><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
            <Field label="Description" full><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Assign to">
              <select className="input" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">— unassigned —</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </Field>
            <Field label="Client (optional)">
              <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                <option value="">— none —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
              </select>
            </Field>
            <Field label="Due date"><input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-gold">Create task</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
