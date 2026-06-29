"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { PageHead, Money, Empty, Badge } from "@/components/ui";
import { Field, Modal } from "@/components/form";
import { useRealtime } from "@/lib/useRealtime";
import { format } from "date-fns";
import {
  Plus, Wallet, TrendingUp, TrendingDown, Receipt, BookOpen, Download, Trash2, Check,
} from "lucide-react";

type Tx = {
  id: string; tx_date: string; kind: "income" | "expense"; category: string;
  description: string; amount: number; method: string; client_id: string | null; notes: string;
};
type Invoice = {
  id: string; number: string; client_id: string | null; client_name: string;
  issue_date: string; due_date: string | null; amount: number; status: string; notes: string;
};

const INCOME_CATS = ["Client payment", "Project / one-off", "Other income"];
const EXPENSE_CATS = ["Salaries", "Office rent", "Utilities", "Software & subscriptions",
  "Equipment", "Marketing & ads", "Travel & transport", "Bank fees", "Zakat", "Other"];
const METHODS = ["bank", "cash", "benefit", "other"];

const TXB = {
  tx_date: format(new Date(), "yyyy-MM-dd"), kind: "expense", category: "Other",
  description: "", amount: 0, method: "bank", client_id: "", notes: "",
};

export default function Accounting() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"overview" | "ledger" | "invoices">("overview");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [tx, setTx] = useState<Tx[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(TXB);
  const [invOpen, setInvOpen] = useState(false);
  const [inv, setInv] = useState<any>(null);

  async function load() {
    const { data: t } = await supabase.from("acc_transactions").select("*").order("tx_date", { ascending: true });
    setTx((t as Tx[]) || []);
    const { data: i } = await supabase.from("invoices").select("*").order("issue_date", { ascending: false });
    setInvoices((i as Invoice[]) || []);
    const { data: c } = await supabase.from("clients").select("id,name,monthly_fee");
    setClients(c || []);
  }
  useEffect(() => { load(); }, []);
  useRealtime(["acc_transactions", "invoices", "clients"], load);

  // ---- transactions ----
  async function saveTx(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, amount: Number(form.amount), client_id: form.client_id || null, created_by: profile?.id };
    const { error } = await supabase.from("acc_transactions").insert(payload);
    if (error) { alert("Could not save: " + error.message); return; }
    setForm(TXB); setOpen(false); load();
  }
  async function delTx(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await supabase.from("acc_transactions").delete().eq("id", id); load();
  }
  function openAdd(kind: "income" | "expense") {
    setForm({ ...TXB, kind, category: kind === "income" ? "Client payment" : "Other" });
    setOpen(true);
  }

  // ---- invoices ----
  function openInvoice() {
    const next = "INV-" + String(invoices.length + 1).padStart(4, "0");
    setInv({ number: next, client_id: "", client_name: "", issue_date: format(new Date(), "yyyy-MM-dd"),
      due_date: "", amount: 0, status: "sent", notes: "" });
    setInvOpen(true);
  }
  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...inv, amount: Number(inv.amount), client_id: inv.client_id || null, due_date: inv.due_date || null, created_by: profile?.id };
    const { error } = await supabase.from("invoices").insert(payload);
    if (error) { alert("Could not save invoice: " + error.message); return; }
    setInvOpen(false); setInv(null); load();
  }
  async function setInvStatus(iv: Invoice, status: string) {
    await supabase.from("invoices").update({ status }).eq("id", iv.id);
    // when marked paid, record it as income in the ledger
    if (status === "paid") {
      await supabase.from("acc_transactions").insert({
        tx_date: format(new Date(), "yyyy-MM-dd"), kind: "income", category: "Client payment",
        description: `Invoice ${iv.number}${iv.client_name ? " · " + iv.client_name : ""}`,
        amount: Number(iv.amount), method: "bank", client_id: iv.client_id, created_by: profile?.id,
      });
    }
    load();
  }
  async function delInvoice(id: string) {
    if (!confirm("Delete this invoice?")) return;
    await supabase.from("invoices").delete().eq("id", id); load();
  }

  // ---- computed ----
  const inMonth = (d: string) => (d || "").startsWith(month);
  const monthTx = useMemo(() => tx.filter((t) => inMonth(t.tx_date)), [tx, month]);
  const income = monthTx.filter((t) => t.kind === "income").reduce((a, t) => a + Number(t.amount || 0), 0);
  const expense = monthTx.filter((t) => t.kind === "expense").reduce((a, t) => a + Number(t.amount || 0), 0);
  const net = income - expense;
  const zakat = net > 0 ? Math.round(net * 0.025) : 0;
  const cashBalance = tx.reduce((a, t) => a + (t.kind === "income" ? 1 : -1) * Number(t.amount || 0), 0);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    monthTx.filter((t) => t.kind === "expense").forEach((t) => { m[t.category] = (m[t.category] || 0) + Number(t.amount || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [monthTx]);

  // running balance for ledger (all-time, then filter view)
  const ledgerRows = useMemo(() => {
    let bal = 0;
    const all = [...tx].sort((a, b) => (a.tx_date < b.tx_date ? -1 : a.tx_date > b.tx_date ? 1 : 0));
    const withBal = all.map((t) => { bal += (t.kind === "income" ? 1 : -1) * Number(t.amount || 0); return { ...t, balance: bal }; });
    return withBal.filter((t) => inMonth(t.tx_date)).reverse();
  }, [tx, month]);

  function exportCSV() {
    const header = ["Date", "Type", "Category", "Description", "Method", "Amount (SAR)"];
    const lines = monthTx.map((t) => [t.tx_date, t.kind, t.category, '"' + (t.description || "").replace(/"/g, "'") + '"', t.method, t.amount].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `accounting-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const invTotals = useMemo(() => ({
    outstanding: invoices.filter((i) => i.status !== "paid").reduce((a, i) => a + Number(i.amount || 0), 0),
    paid: invoices.filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.amount || 0), 0),
  }), [invoices]);

  return (
    <div>
      <PageHead title="Accounting" sub="Income, expenses, invoices and financial overview."
        action={<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-ink border border-line rounded-lg px-3 py-2 text-sm" />} />

      <div className="flex flex-wrap gap-1 mb-5">
        <Tab on={tab === "overview"} onClick={() => setTab("overview")} icon={Wallet} label="Overview" />
        <Tab on={tab === "ledger"} onClick={() => setTab("ledger")} icon={BookOpen} label="Transactions" />
        <Tab on={tab === "invoices"} onClick={() => setTab("invoices")} icon={Receipt} label="Invoices" />
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI label="Income (month)" value={<Money n={income} />} tone="teal" icon={TrendingUp} />
            <KPI label="Expenses (month)" value={<Money n={expense} />} tone="red" icon={TrendingDown} />
            <KPI label="Net profit (month)" value={<Money n={net} />} tone={net >= 0 ? "teal" : "red"} icon={Wallet} />
            <KPI label="Cash balance (all-time)" value={<Money n={cashBalance} />} tone="gold" icon={Wallet} />
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-3">Profit &amp; loss — {format(new Date(month + "-01"), "MMMM yyyy")}</h3>
            <div className="space-y-1.5 text-sm">
              <Row label="Total income" value={income} />
              <Row label="− Total expenses" value={-expense} />
              <div className="border-t border-line my-2" />
              <Row label="= Net profit" value={net} bold tone={net >= 0 ? "teal" : "red"} />
              <Row label="− Zakat reserve (2.5% estimate)" value={-zakat} />
            </div>
            <p className="text-xs text-muted mt-3">Zakat shown as a 2.5% monthly reserve estimate; ZATCA assesses annually on your full zakat base. No VAT applied.</p>
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-3">Expenses by category</h3>
            {byCategory.length === 0 ? <div className="text-sm text-muted">No expenses recorded this month.</div> :
              <div className="space-y-2">
                {byCategory.map(([cat, amt]) => {
                  const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1"><span>{cat}</span><span className="text-muted"><Money n={amt} /> · {pct}%</span></div>
                      <div className="h-2 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-gold" style={{ width: pct + "%" }} /></div>
                    </div>
                  );
                })}
              </div>}
          </div>
        </div>
      )}

      {tab === "ledger" && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button className="btn btn-gold" onClick={() => openAdd("income")}><Plus className="w-4 h-4" /> Add income</button>
            <button className="btn btn-ghost" onClick={() => openAdd("expense")}><Plus className="w-4 h-4" /> Add expense</button>
            <button className="btn btn-ghost ml-auto" onClick={exportCSV}><Download className="w-4 h-4" /> Export CSV</button>
          </div>
          {ledgerRows.length === 0 ? <Empty text="No transactions this month." /> :
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr>{["Date", "Type", "Category", "Description", "Method", "Amount", "Balance", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody>
                  {ledgerRows.map((t: any) => (
                    <tr key={t.id} className="hover:bg-panel2/50">
                      <td className="td whitespace-nowrap">{format(new Date(t.tx_date), "dd MMM")}</td>
                      <td className="td"><span className={t.kind === "income" ? "text-teal" : "text-red-400"}>{t.kind}</span></td>
                      <td className="td">{t.category}</td>
                      <td className="td text-muted max-w-[220px]">{t.description}</td>
                      <td className="td text-muted capitalize">{t.method}</td>
                      <td className={`td whitespace-nowrap font-semibold ${t.kind === "income" ? "text-teal" : "text-red-400"}`}>{t.kind === "income" ? "+" : "−"}<Money n={t.amount} /></td>
                      <td className="td whitespace-nowrap text-muted"><Money n={t.balance} /></td>
                      <td className="td text-right"><button onClick={() => delTx(t.id)} className="text-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </div>
      )}

      {tab === "invoices" && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card p-4"><div className="text-xs text-muted">Outstanding</div><div className="text-2xl font-bold text-gold"><Money n={invTotals.outstanding} /></div></div>
            <div className="card p-4"><div className="text-xs text-muted">Paid (all-time)</div><div className="text-2xl font-bold text-teal"><Money n={invTotals.paid} /></div></div>
          </div>
          <div className="flex mb-4"><button className="btn btn-gold ml-auto" onClick={openInvoice}><Plus className="w-4 h-4" /> New invoice</button></div>
          {invoices.length === 0 ? <Empty text="No invoices yet." /> :
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead><tr>{["Number", "Client", "Issued", "Due", "Amount", "Status", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody>
                  {invoices.map((iv) => (
                    <tr key={iv.id} className="hover:bg-panel2/50">
                      <td className="td font-semibold">{iv.number}</td>
                      <td className="td">{iv.client_name || "—"}</td>
                      <td className="td whitespace-nowrap text-muted">{format(new Date(iv.issue_date), "dd MMM yy")}</td>
                      <td className="td whitespace-nowrap text-muted">{iv.due_date ? format(new Date(iv.due_date), "dd MMM yy") : "—"}</td>
                      <td className="td"><Money n={iv.amount} /></td>
                      <td className="td">
                        <select value={iv.status} onChange={(e) => setInvStatus(iv, e.target.value)} className="bg-ink border border-line rounded px-2 py-1 text-xs">
                          <option value="draft">draft</option><option value="sent">sent</option><option value="paid">paid</option><option value="overdue">overdue</option>
                        </select>
                      </td>
                      <td className="td text-right"><button onClick={() => delInvoice(iv.id)} className="text-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          <p className="text-xs text-muted mt-2">Marking an invoice “paid” automatically records the amount as income in your transactions.</p>
        </div>
      )}

      {open && (
        <Modal title={form.kind === "income" ? "Add income" : "Add expense"} onClose={() => setOpen(false)}>
          <form onSubmit={saveTx} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className="input" value={form.tx_date} onChange={(e) => setForm({ ...form, tx_date: e.target.value })} required /></Field>
            <Field label="Type">
              <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, category: e.target.value === "income" ? "Client payment" : "Other" })}>
                <option value="income">Income</option><option value="expense">Expense</option>
              </select>
            </Field>
            <Field label="Category">
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {(form.kind === "income" ? INCOME_CATS : EXPENSE_CATS).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Amount (SAR)"><input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
            <Field label="Method">
              <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {METHODS.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
              </select>
            </Field>
            <Field label="Client (optional)">
              <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                <option value="">— none —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Description" full><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-gold">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {invOpen && inv && (
        <Modal title="New invoice" onClose={() => setInvOpen(false)}>
          <form onSubmit={saveInvoice} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Invoice number"><input className="input" value={inv.number} onChange={(e) => setInv({ ...inv, number: e.target.value })} required /></Field>
            <Field label="Client">
              <select className="input" value={inv.client_id} onChange={(e) => {
                const c = clients.find((x) => x.id === e.target.value);
                setInv({ ...inv, client_id: e.target.value, client_name: c?.name || "", amount: c?.monthly_fee || inv.amount });
              }}>
                <option value="">— select / manual —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Issue date"><input type="date" className="input" value={inv.issue_date} onChange={(e) => setInv({ ...inv, issue_date: e.target.value })} required /></Field>
            <Field label="Due date"><input type="date" className="input" value={inv.due_date} onChange={(e) => setInv({ ...inv, due_date: e.target.value })} /></Field>
            <Field label="Amount (SAR)"><input type="number" step="0.01" className="input" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: e.target.value })} required /></Field>
            <Field label="Status">
              <select className="input" value={inv.status} onChange={(e) => setInv({ ...inv, status: e.target.value })}>
                <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
              </select>
            </Field>
            <Field label="Notes" full><input className="input" value={inv.notes} onChange={(e) => setInv({ ...inv, notes: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setInvOpen(false)}>Cancel</button>
              <button className="btn btn-gold">Save invoice</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function KPI({ label, value, tone, icon: Icon }: any) {
  const c = tone === "teal" ? "text-teal" : tone === "gold" ? "text-gold" : tone === "red" ? "text-red-400" : "text-white";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between"><span className="text-sm text-muted">{label}</span><Icon className="w-5 h-5 text-gold" /></div>
      <div className={`text-2xl font-bold mt-1 ${c}`}>{value}</div>
    </div>
  );
}
function Row({ label, value, bold, tone }: any) {
  const c = tone === "teal" ? "text-teal" : tone === "red" ? "text-red-400" : "";
  return <div className={`flex items-center justify-between ${bold ? "font-bold" : ""} ${c}`}><span>{label}</span><span><Money n={value} /></span></div>;
}
function Tab({ on, onClick, icon: Icon, label }: any) {
  return <button onClick={onClick} className={"btn " + (on ? "btn-gold" : "btn-ghost")}><Icon className="w-4 h-4" /> {label}</button>;
}
