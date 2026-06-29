"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHead, Money } from "@/components/ui";
import { Field, Modal } from "@/components/form";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { useRealtime } from "@/lib/useRealtime";
import { format } from "date-fns";

const CAT = ["salary", "rent", "electricity", "subscriptions", "other"];

export default function Finance() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [payments, setPayments] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [activeClients, setActiveClients] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ label: "", amount: 0, category: "other" });

  async function load() {
    const { data: p } = await supabase.from("payments").select("amount,status,period").eq("period", month);
    setPayments(p || []);
    const { data: c } = await supabase.from("costs").select("*").eq("month", month).order("created_at");
    setCosts(c || []);
    const { count } = await supabase.from("clients").select("*", { count: "exact", head: true }).eq("status", "active");
    setActiveClients(count || 0);
  }
  useEffect(() => { load(); }, [month]);
  useRealtime(["payments","costs","clients"], load);

  async function addCost(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("costs").insert({ ...form, amount: Number(form.amount), month });
    setForm({ label: "", amount: 0, category: "other" }); setOpen(false); load();
  }
  async function delCost(id: string) { await supabase.from("costs").delete().eq("id", id); load(); }

  async function seedDefaults() {
    const editors = Math.floor(activeClients / 4);
    const rows = [
      { label: "Sales manager (base + allowances)", amount: 3000, category: "salary" },
      { label: "Office rent", amount: 2500, category: "rent" },
      { label: "Electricity", amount: 500, category: "electricity" },
      { label: "Software & subscriptions", amount: 1500, category: "subscriptions" },
    ];
    if (editors > 0) rows.push({ label: `Video/content editors (${editors} × 4,000)`, amount: editors * 4000, category: "salary" });
    await supabase.from("costs").insert(rows.map((r) => ({ ...r, month })));
    load();
  }

  const revenue = useMemo(() => payments.filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.amount || 0), 0), [payments]);
  const totalCost = useMemo(() => costs.reduce((a, c) => a + Number(c.amount || 0), 0), [costs]);
  const profit = revenue - totalCost;
  const rate = revenue > 100000 ? 0.25 : 0.20;
  const share = profit > 0 ? Math.round(profit * rate) : 0;
  const ownerNetBeforeZakat = profit - share;
  const zakat = ownerNetBeforeZakat > 0 ? Math.round(ownerNetBeforeZakat * 0.025) : 0;
  const ownerNet = ownerNetBeforeZakat - zakat;

  return (
    <div>
      <PageHead title="Finance" sub="Revenue, costs and the automatic profit-share calculation."
        action={
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="bg-ink border border-line rounded-lg px-3 py-2 text-sm" />
        } />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Collected revenue" value={<Money n={revenue} />} />
        <Stat label="Total costs" value={<Money n={totalCost} />} />
        <Stat label="Net profit" value={<Money n={profit} />} tone={profit >= 0 ? "teal" : "red"} />
        <Stat label={`Sales manager share (${rate * 100}%)`} value={<Money n={share} />} tone="gold" />
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold">Profit-share breakdown — {format(new Date(month + "-01"), "MMMM yyyy")}</h3>
          <span className="text-xs text-muted">{activeClients} active clients · {Math.floor(activeClients / 4)} editor(s) by the 1-per-4 rule</span>
        </div>
        <div className="text-sm text-muted mb-4">Rate is 20% of profit, rising to 25% in any month revenue passes SAR 100,000.</div>
        <div className="space-y-1.5 text-sm">
          <Row label="Collected revenue" value={revenue} />
          <Row label="− Total running costs" value={-totalCost} />
          <div className="border-t border-line my-2" />
          <Row label="= Net profit" value={profit} bold />
          <Row label={`Sales manager share (${rate * 100}%)`} value={-share} tone="gold" />
          <Row label="= Your net before zakat" value={ownerNetBeforeZakat} />
          <Row label="− Zakat (2.5% estimate)" value={-zakat} />
          <div className="border-t border-line my-2" />
          <Row label="= Your net after zakat" value={ownerNet} bold tone="teal" />
        </div>
        {revenue > 100000 && <div className="mt-3 text-xs text-gold">Revenue above SAR 100,000 — 25% rate applied.</div>}
        <div className="mt-2 text-xs text-muted">Zakat shown as a simple 2.5% monthly estimate on your net, taken from your share only (it does not affect the sales manager). ZATCA assesses zakat annually on your full zakat base — treat this as a monthly reserve, not the final bill. No VAT applied.</div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Costs for this month</h3>
          <div className="flex gap-2">
            {costs.length === 0 && <button onClick={seedDefaults} className="btn btn-ghost text-sm"><Wand2 className="w-4 h-4" /> Add standard costs</button>}
            <button onClick={() => setOpen(true)} className="btn btn-gold text-sm"><Plus className="w-4 h-4" /> Add cost</button>
          </div>
        </div>
        {costs.length === 0 ? <div className="text-sm text-muted">No costs added for this month. Use “Add standard costs” to seed the agreed cost list.</div> :
          <table className="w-full">
            <thead><tr>{["Cost","Category","Amount",""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id}>
                  <td className="td">{c.label}</td>
                  <td className="td text-muted capitalize">{c.category}</td>
                  <td className="td"><Money n={c.amount} /></td>
                  <td className="td text-right"><button onClick={() => delCost(c.id)} className="text-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>}
      </div>

      {open && (
        <Modal title="Add cost" onClose={() => setOpen(false)}>
          <form onSubmit={addCost} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Label" full><input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></Field>
            <Field label="Amount (SAR)"><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
            <Field label="Category">
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CAT.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-gold">Add cost</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: any) {
  const c = tone === "teal" ? "text-teal" : tone === "gold" ? "text-gold" : tone === "red" ? "text-red-400" : "text-white";
  return <div className="card p-5"><div className="text-sm text-muted">{label}</div><div className={`text-2xl font-bold mt-1 ${c}`}>{value}</div></div>;
}
function Row({ label, value, bold, tone }: any) {
  const c = tone === "teal" ? "text-teal" : tone === "gold" ? "text-gold" : "";
  return (
    <div className={`flex items-center justify-between ${bold ? "font-bold" : ""} ${c}`}>
      <span>{label}</span><span><Money n={value} /></span>
    </div>
  );
}
