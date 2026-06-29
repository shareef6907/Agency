"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { can } from "@/lib/roles";
import { PageHead, Money } from "@/components/ui";
import { useRealtime } from "@/lib/useRealtime";
import { Users, Briefcase, CreditCard, CheckSquare } from "lucide-react";

export default function Dashboard() {
  const { profile } = useAuth();
  const [s, setS] = useState<any>({ clients: 0, mrr: 0, pending: 0, visits: 0, myTasks: 0, leads: 0, accIncome: 0, accExpense: 0, accNet: 0 });

  async function loadStats() {
      if (!profile) return;
      const out: any = {};
      if (can(profile.role, "clients")) {
        const { data } = await supabase.from("clients").select("monthly_fee,status");
        const active = (data || []).filter((c: any) => c.status === "active");
        out.clients = active.length;
        out.mrr = active.reduce((a: number, c: any) => a + Number(c.monthly_fee || 0), 0);
      }
      if (can(profile.role, "payments")) {
        const { data } = await supabase.from("payments").select("amount,status").neq("status", "paid");
        out.pending = (data || []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
      }
      if (can(profile.role, "crm")) {
        const { count } = await supabase.from("sales_visits").select("*", { count: "exact", head: true });
        out.visits = count || 0;
        const { count: leads } = await supabase.from("sales_visits").select("*", { count: "exact", head: true }).eq("status", "interested");
        out.leads = leads || 0;
      }
      if (can(profile.role, "tasks")) {
        const { count } = await supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done");
        out.myTasks = count || 0;
      }
      if (can(profile.role, "accounting")) {
        const ym = new Date().toISOString().slice(0, 7);
        const { data: txd } = await supabase.from("acc_transactions").select("kind,amount,tx_date");
        const mt = (txd || []).filter((t: any) => (t.tx_date || "").startsWith(ym));
        out.accIncome = mt.filter((t: any) => t.kind === "income").reduce((a: number, t: any) => a + Number(t.amount || 0), 0);
        out.accExpense = mt.filter((t: any) => t.kind === "expense").reduce((a: number, t: any) => a + Number(t.amount || 0), 0);
        out.accNet = out.accIncome - out.accExpense;
      }
      setS((p) => ({ ...p, ...out }));
  }
  useEffect(() => { loadStats(); /* eslint-disable-next-line */ }, [profile]);
  useRealtime(["clients","payments","sales_visits","tasks"], loadStats);

  if (!profile) return null;
  const cards = [];
  if (can(profile.role, "clients")) {
    cards.push({ label: "Active clients", value: s.clients, icon: Users });
    cards.push({ label: "Monthly recurring", value: <Money n={s.mrr} />, icon: Briefcase });
  }
  if (can(profile.role, "payments")) cards.push({ label: "Pending payments", value: <Money n={s.pending} />, icon: CreditCard });
  if (can(profile.role, "crm")) {
    cards.push({ label: "Total visits logged", value: s.visits, icon: Briefcase });
    cards.push({ label: "Interested leads", value: s.leads, icon: Users });
  }
  if (can(profile.role, "tasks")) cards.push({ label: "Open tasks", value: s.myTasks, icon: CheckSquare });
  if (can(profile.role, "accounting")) {
    cards.push({ label: "Income this month", value: <Money n={s.accIncome || 0} />, icon: Briefcase });
    cards.push({ label: "Expenses this month", value: <Money n={s.accExpense || 0} />, icon: CreditCard });
    cards.push({ label: "Net this month", value: <Money n={s.accNet || 0} />, icon: Briefcase });
  }

  return (
    <div>
      <PageHead title={`Welcome, ${profile.full_name?.split(" ")[0] || ""}`} sub="Here's where things stand today." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">{c.label}</span>
                <Icon className="w-5 h-5 text-gold" />
              </div>
              <div className="text-3xl font-bold mt-2">{c.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
