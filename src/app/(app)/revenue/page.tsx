"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHead, Money, Empty } from "@/components/ui";
import { useRealtime } from "@/lib/useRealtime";
import { format } from "date-fns";

export default function Revenue() {
  const [payments, setPayments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeMember, setActiveMember] = useState<string | null>(null); // null = All

  async function load() {
    const { data: p } = await supabase
      .from("payments")
      .select("id, amount, status, period, paid_date, clients(name, brought_by)")
      .eq("status", "paid");
    setPayments(p || []);
    const { data: profs } = await supabase.from("profiles").select("id, full_name, role");
    setProfiles(profs || []);
  }
  useEffect(() => { load(); }, []);
  useRealtime(["payments", "clients"], load);

  // Resolve credited member: NULL brought_by → CEO profile id
  const ceoId = useMemo(() => profiles.find((p) => p.role === "ceo")?.id ?? null, [profiles]);
  const creditOf = (payment: any) => {
    const bb = payment.clients?.brought_by ?? null;
    return bb ?? ceoId;
  };

  // Profile id → display name
  const nameOf = (id: string | null) => {
    if (!id) return null;
    return profiles.find((p) => p.id === id)?.full_name || null;
  };

  // Filter pills: All + ceo + sales_manager
  const members = useMemo(
    () => [
      { id: null, label: "All" },
      ...profiles.filter((p) => p.role === "ceo" || p.role === "sales_manager").map((p) => ({ id: p.id, label: p.full_name })),
    ],
    [profiles]
  );

  // Payments filtered by active member
  const filtered = useMemo(() => {
    if (activeMember === null) return payments;
    return payments.filter((p) => creditOf(p) === activeMember);
  }, [payments, activeMember, ceoId]);

  // Unique periods, newest first
  const periods = useMemo(() => {
    const sorted = [...new Set(filtered.map((p) => p.period))].sort().reverse();
    return sorted;
  }, [filtered]);

  // Pivot: period → { memberId → amount }
  const pivot = useMemo(() => {
    const rows: Record<string, Record<string, number>> = {};
    filtered.forEach((p) => {
      const period = p.period;
      const member = creditOf(p);
      const amt = Number(p.amount || 0);
      if (!rows[period]) rows[period] = {};
      rows[period][member] = (rows[period][member] || 0) + amt;
    });
    return rows;
  }, [filtered, ceoId]);

  // Lifetime totals per member
  const lifetime = useMemo(() => {
    const totals: Record<string, number> = {};
    filtered.forEach((p) => {
      const member = creditOf(p);
      totals[member] = (totals[member] || 0) + Number(p.amount || 0);
    });
    return totals;
  }, [filtered, ceoId]);

  const grandTotal = Object.values(lifetime).reduce((a, b) => a + b, 0);

  // Member columns (same order as pills, skip "All")
  const memberCols = members.slice(1);

  function exportCSV() {
    const header = ["Paid date", "Period", "Client", "Brought by", "Amount"];
    const rows = [...filtered].sort((a, b) => (b.paid_date || "").localeCompare(a.paid_date || ""))
      .map((p) => [
        String(p.paid_date || "").replace(/"/g, '""'),
        String(p.period).replace(/"/g, '""'),
        String(p.clients?.name || "").replace(/"/g, '""'),
        String(nameOf(creditOf(p)) || "CEO").replace(/"/g, '""'),
        String(p.amount),
      ]);
    const csv = [header.map((h) => `"${h.replace(/"/g, '""')}"`), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "revenue.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHead
        title="Revenue"
        sub="All collected payments — lifetime, by month and by member."
        action={
          <button onClick={exportCSV} className="btn btn-gold text-sm">Export CSV</button>
        }
      />

      {/* Member filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {members.map((m) => (
          <button
            key={m.id ?? "all"}
            onClick={() => setActiveMember(m.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
              activeMember === m.id
                ? "bg-gold text-ink border-gold"
                : "border-line text-muted hover:text-white hover:border-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty text="No paid payments yet." />
      ) : (
        <>
          {/* Pivot table */}
          <div className="card overflow-x-auto mb-8">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="th text-left">Period</th>
                  {memberCols.map((m) => (
                    <th key={m.id} className="th text-right">{m.label}</th>
                  ))}
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => {
                  const row = pivot[period] || {};
                  const total = Object.values(row).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={period} className="border-t border-line">
                      <td className="td">{formatPeriod(period)}</td>
                      {memberCols.map((m) => (
                        <td key={m.id} className="td text-right">
                          {row[m.id] ? <Money n={row[m.id]} /> : "—"}
                        </td>
                      ))}
                      <td className="td text-right font-medium"><Money n={total} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gold font-bold">
                  <td className="td">Lifetime</td>
                  {memberCols.map((m) => (
                    <td key={m.id} className="td text-right"><Money n={lifetime[m.id] || 0} /></td>
                  ))}
                  <td className="td text-right"><Money n={grandTotal} /></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Detail table */}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  {["Paid date", "Period", "Client", "Brought by", "Amount"].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => (b.paid_date || "").localeCompare(a.paid_date || ""))
                  .map((p) => {
                    const credited = creditOf(p);
                    return (
                      <tr key={p.id} className="border-t border-line">
                        <td className="td whitespace-nowrap text-muted">
                          {p.paid_date ? format(new Date(p.paid_date), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="td whitespace-nowrap text-muted">{p.period}</td>
                        <td className="td font-medium">{p.clients?.name || "—"}</td>
                        <td className="td text-muted">{nameOf(credited) || "—"}</td>
                        <td className="td text-right"><Money n={p.amount} /></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function formatPeriod(period: string) {
  try {
    return format(new Date(period + "-01"), "MMM yyyy");
  } catch {
    return period;
  }
}
