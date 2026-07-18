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
  const [profiles, setProfiles] = useState<Record<string, string>>({}); // id -> role
  const [activeClients, setActiveClients] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ label: "", amount: 0, category: "other" });

  async function load() {
    const { data: p } = await supabase
      .from("payments")
      .select("amount,status,period,clients(brought_by)")
      .eq("period", month);
    setPayments(p || []);
    const { data: c } = await supabase.from("costs").select("*").eq("month", month).order("created_at");
    setCosts(c || []);
    const { data: profs } = await supabase.from("profiles").select("id,role");
    const map: Record<string, string> = {};
    (profs || []).forEach((p: any) => { map[p.id] = p.role; });
    setProfiles(map);
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
      { label: "Office rent", amount: 2500, category: "rent" },
      { label: "Electricity", amount: 500, category: "electricity" },
      { label: "Software & subscriptions", amount: 1500, category: "subscriptions" },
    ];
    if (editors > 0) rows.push({ label: `Video/content editors (${editors} × 4,000)`, amount: editors * 4000, category: "salary" });
    await supabase.from("costs").insert(rows.map((r) => ({ ...r, month })));
    load();
  }

  const commission = useMemo(() => {
    const paidPayments = payments.filter((p) => p.status === "paid");

    const clientBroughtBy = (client: any) => client?.brought_by ?? null;

    // Bucket revenue by brought_by role
    let salesRev = 0; // brought_by is sales_manager
    let ceoRev = 0;   // brought_by is ceo, sales_manager, or NULL

    paidPayments.forEach((p) => {
      const bb = clientBroughtBy(p.clients);
      const role = bb ? profiles[bb] : null;
      const amount = Number(p.amount || 0);
      if (role === "sales_manager") {
        salesRev += amount;
      } else {
        // ceo, other role, or null → CEO bucket
        ceoRev += amount;
      }
    });

    const totalCosts = costs.reduce((a, c) => a + Number(c.amount || 0), 0);

    // Cost allocation: deduct from CEO bucket first
    const ceoCost = Math.min(totalCosts, ceoRev);
    const salesCost = totalCosts - ceoCost;

    // Sales manager profit base
    const profitBase = Math.max(salesRev - salesCost, 0);

    // Commission rate based on HIS revenue only
    const rate = salesRev > 100000 ? 0.25 : 0.20;

    const grossCommission = rate * profitBase;
    const extraPayout = Math.max(grossCommission - 3000, 0);
    const smTotalComp = 3000 + extraPayout;

    // CEO net
    const ceoNetBeforeZakat = (ceoRev - ceoCost) + (salesRev - salesCost - smTotalComp);
    const zakat = Math.max(Math.round(ceoNetBeforeZakat * 0.025), 0);

    return {
      salesRev,
      ceoRev,
      totalCosts,
      ceoCost,
      salesCost,
      profitBase,
      rate,
      grossCommission,
      smTotalComp,
      ceoNetBeforeZakat,
      zakat,
      totalCollected: salesRev + ceoRev,
    };
  }, [payments, costs, profiles]);

  return (
    <div>
      <PageHead title="Finance" sub="Revenue, costs and the automatic profit-share calculation."
        action={
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="bg-ink border border-line rounded-lg px-3 py-2 text-sm" />
        } />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Collected revenue" value={<Money n={commission.totalCollected} />} />
        <Stat label="Total costs" value={<Money n={commission.totalCosts} />} />
        <Stat label="Net profit" value={<Money n={commission.totalCollected - commission.totalCosts} />} tone={commission.totalCollected - commission.totalCosts >= 0 ? "teal" : "red"} />
        <Stat label="Sales manager comp" value={<Money n={commission.smTotalComp} />} tone="gold" />
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold">Profit-share breakdown — {format(new Date(month + "-01"), "MMMM yyyy")}</h3>
          <span className="text-xs text-muted">{activeClients} active clients · {Math.floor(activeClients / 4)} editor(s) by the 1-per-4 rule</span>
        </div>
        <div className="text-sm text-muted mb-4">Commission is 20% of profit from his own clients (25% in any month his sales pass SAR 100,000), against a SAR 3,000 monthly base + allowances.</div>
        <div className="space-y-1.5 text-sm">
          <Row label="Your sales" value={commission.ceoRev} />
          <Row label="Sales manager sales" value={commission.salesRev} />
          <div className="border-t border-line my-2" />
          <Row label="− Costs (from your side)" value={-commission.ceoCost} />
          {commission.salesCost > 0 && (
            <Row label="− Costs overflow (from his side)" value={-commission.salesCost} />
          )}
          <div className="border-t border-line my-2" />
          <Row label="His profit base" value={commission.profitBase} />
          <Row label={`Commission rate (${commission.rate * 100}%) + gross commission`} value={commission.grossCommission} tone="gold" />
          <Row label="− Base + allowances (3,000)" value={-3000} />
          <div className="border-t border-line my-2" />
          <Row label="= Extra payout" value={commission.grossCommission - 3000} />
          <Row label="= His total compensation" value={commission.smTotalComp} bold />
          <div className="border-t border-line my-2" />
          <Row label="= Your net before zakat" value={commission.ceoNetBeforeZakat} />
          <Row label="− Zakat 2.5%" value={-commission.zakat} />
          <div className="border-t border-line my-2" />
          <Row label="= Your net after zakat" value={commission.ceoNetBeforeZakat - commission.zakat} bold tone="teal" />
        </div>
        {commission.salesRev > 100000 && (
          <div className="mt-3 text-xs text-gold">Sales manager sales above SAR 100,000 — 25% rate applied.</div>
        )}
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
        {costs.length === 0 ? <div className="text-sm text-muted">No costs added for this month. Use "Add standard costs" to seed the agreed cost list.</div> :
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
