"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHead, Badge, Empty, Money } from "@/components/ui";
import { Field, Modal } from "@/components/form";
import { Plus } from "lucide-react";
import { format } from "date-fns";

const BLANK = { client_id: "", amount: 0, period: format(new Date(), "yyyy-MM"), due_date: "", status: "pending", notes: "" };

export default function Payments() {
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(BLANK);

  async function load() {
    const { data } = await supabase.from("payments").select("*, clients(name)").order("due_date", { ascending: true });
    setRows(data || []);
    const { data: c } = await supabase.from("clients").select("id,name,monthly_fee");
    setClients(c || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("payments").insert({ ...form, amount: Number(form.amount), due_date: form.due_date || null });
    setForm(BLANK); setOpen(false); load();
  }
  async function mark(id: string, status: string) {
    await supabase.from("payments").update({ status, paid_date: status === "paid" ? format(new Date(), "yyyy-MM-dd") : null }).eq("id", id);
    load();
  }

  const totals = useMemo(() => {
    const pending = rows.filter((r) => r.status !== "paid").reduce((a, r) => a + Number(r.amount || 0), 0);
    const collected = rows.filter((r) => r.status === "paid").reduce((a, r) => a + Number(r.amount || 0), 0);
    const overdue = rows.filter((r) => r.status === "overdue").reduce((a, r) => a + Number(r.amount || 0), 0);
    return { pending, collected, overdue };
  }, [rows]);

  return (
    <div>
      <PageHead title="Payments" sub="Who has paid and what's still pending."
        action={<button className="btn btn-gold" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Add payment</button>} />
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card p-4"><div className="text-xs text-muted">Collected</div><div className="text-2xl font-bold text-teal"><Money n={totals.collected} /></div></div>
        <div className="card p-4"><div className="text-xs text-muted">Pending</div><div className="text-2xl font-bold text-gold"><Money n={totals.pending} /></div></div>
        <div className="card p-4"><div className="text-xs text-muted">Overdue</div><div className="text-2xl font-bold text-red-400"><Money n={totals.overdue} /></div></div>
      </div>
      {rows.length === 0 ? <Empty text="No payments recorded yet." /> :
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead><tr>{["Client","Period","Amount","Due","Status","Action"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-panel2/50">
                  <td className="td font-semibold">{p.clients?.name || "—"}</td>
                  <td className="td text-muted">{p.period}</td>
                  <td className="td"><Money n={p.amount} /></td>
                  <td className="td whitespace-nowrap text-muted">{p.due_date ? format(new Date(p.due_date), "dd MMM yy") : "—"}</td>
                  <td className="td"><Badge value={p.status} /></td>
                  <td className="td">
                    <select value={p.status} onChange={(e) => mark(p.id, e.target.value)} className="bg-ink border border-line rounded px-2 py-1 text-xs">
                      <option value="pending">pending</option><option value="paid">paid</option><option value="overdue">overdue</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

      {open && (
        <Modal title="Add payment" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Client" full>
              <select className="input" value={form.client_id} onChange={(e) => {
                const cl = clients.find((c) => c.id === e.target.value);
                setForm({ ...form, client_id: e.target.value, amount: cl?.monthly_fee || form.amount });
              }} required>
                <option value="">— select client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Period (YYYY-MM)"><input className="input" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></Field>
            <Field label="Amount (SAR)"><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
            <Field label="Due date"><input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
              </select>
            </Field>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-gold">Save payment</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
