"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { PageHead, Badge, Empty } from "@/components/ui";
import { Field, Modal } from "@/components/form";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay,
  addMonths, startOfWeek, endOfWeek,
} from "date-fns";
import { Plus, Table2, CalendarDays, Columns3, ChevronLeft, ChevronRight, X } from "lucide-react";

type Visit = {
  id: string; visit_date: string; company_name: string; contact_person: string;
  designation: string; email: string; phone: string; comments: string;
  status: "interested" | "potential" | "not_interested"; created_by: string;
};
const BLANK = {
  visit_date: format(new Date(), "yyyy-MM-dd"), company_name: "", contact_person: "",
  designation: "", email: "", phone: "", comments: "", status: "potential",
};

export default function CRM() {
  const { profile } = useAuth();
  const [view, setView] = useState<"table" | "calendar" | "pipeline">("table");
  const [rows, setRows] = useState<Visit[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(BLANK);
  const [month, setMonth] = useState(new Date());

  async function load() {
    const { data } = await supabase.from("sales_visits").select("*").order("visit_date", { ascending: false });
    setRows((data as Visit[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("sales_visits").insert({ ...form, created_by: profile?.id });
    setForm(BLANK); setOpen(false); load();
  }
  async function setStatus(id: string, status: string) {
    await supabase.from("sales_visits").update({ status }).eq("id", id); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this visit?")) return;
    await supabase.from("sales_visits").delete().eq("id", id); load();
  }

  const counts = useMemo(() => ({
    interested: rows.filter((r) => r.status === "interested").length,
    potential: rows.filter((r) => r.status === "potential").length,
    not_interested: rows.filter((r) => r.status === "not_interested").length,
  }), [rows]);

  return (
    <div>
      <PageHead title="Sales CRM" sub="Daily visits, pipeline and follow-ups."
        action={<button className="btn btn-gold" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Log visit</button>} />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Interested" n={counts.interested} tone="teal" />
        <Stat label="Potential" n={counts.potential} tone="gold" />
        <Stat label="Not interested" n={counts.not_interested} tone="red" />
      </div>

      <div className="flex gap-1 mb-4">
        <Tab on={view === "table"} onClick={() => setView("table")} icon={Table2} label="Table" />
        <Tab on={view === "calendar"} onClick={() => setView("calendar")} icon={CalendarDays} label="Calendar" />
        <Tab on={view === "pipeline"} onClick={() => setView("pipeline")} icon={Columns3} label="Pipeline" />
      </div>

      {view === "table" && (
        rows.length === 0 ? <Empty text="No visits logged yet. Tap “Log visit”." /> :
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead><tr>
              {["Date","Company","Contact","Designation","Email","Phone","Comments","Status",""].map((h) => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-panel2/50">
                  <td className="td whitespace-nowrap">{format(new Date(r.visit_date), "dd MMM")}</td>
                  <td className="td font-semibold">{r.company_name}</td>
                  <td className="td">{r.contact_person}</td>
                  <td className="td text-muted">{r.designation}</td>
                  <td className="td text-muted">{r.email}</td>
                  <td className="td whitespace-nowrap">{r.phone}</td>
                  <td className="td max-w-[220px] text-muted">{r.comments}</td>
                  <td className="td">
                    <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}
                      className="bg-ink border border-line rounded px-2 py-1 text-xs">
                      <option value="interested">interested</option>
                      <option value="potential">potential</option>
                      <option value="not_interested">not interested</option>
                    </select>
                  </td>
                  <td className="td"><button onClick={() => remove(r.id)} className="text-muted hover:text-red-400 text-xs">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "calendar" && <Calendar rows={rows} month={month} setMonth={setMonth} />}

      {view === "pipeline" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["interested","potential","not_interested"] as const).map((st) => (
            <div key={st} className="card p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <Badge value={st} /><span className="text-xs text-muted">{rows.filter((r) => r.status === st).length}</span>
              </div>
              <div className="space-y-2">
                {rows.filter((r) => r.status === st).map((r) => (
                  <div key={r.id} className="bg-panel2 border border-line rounded-lg p-3">
                    <div className="font-semibold text-sm">{r.company_name}</div>
                    <div className="text-xs text-muted">{r.contact_person}{r.designation ? ` · ${r.designation}` : ""}</div>
                    {r.comments && <div className="text-xs text-muted mt-1 line-clamp-2">{r.comments}</div>}
                    <div className="text-[11px] text-muted mt-2">{format(new Date(r.visit_date), "dd MMM yyyy")}</div>
                  </div>
                ))}
                {rows.filter((r) => r.status === st).length === 0 && <div className="text-xs text-muted px-1 py-3">None</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal onClose={() => setOpen(false)} title="Log a visit">
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className="input" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} required /></Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="potential">Potential</option><option value="interested">Interested</option><option value="not_interested">Not interested</option>
              </select>
            </Field>
            <Field label="Company name" full><input className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required /></Field>
            <Field label="Contact person"><input className="input" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
            <Field label="Designation"><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Comments on the meeting" full><textarea className="input" rows={3} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-gold">Save visit</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Calendar({ rows, month, setMonth }: any) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <button className="btn btn-ghost px-2 py-1" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="w-4 h-4" /></button>
        <div className="font-semibold">{format(month, "MMMM yyyy")}</div>
        <button className="btn btn-ghost px-2 py-1" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dayVisits = rows.filter((r: Visit) => isSameDay(new Date(r.visit_date), d));
          const dim = d.getMonth() !== month.getMonth();
          return (
            <div key={d.toISOString()} className={`min-h-[78px] rounded-lg border border-line p-1 ${dim ? "opacity-40" : ""}`}>
              <div className="text-[11px] text-muted px-1">{format(d, "d")}</div>
              <div className="space-y-0.5 mt-0.5">
                {dayVisits.slice(0, 3).map((v: Visit) => (
                  <div key={v.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${v.status === "interested" ? "bg-teal/25 text-teal" : v.status === "potential" ? "bg-gold/25 text-gold" : "bg-red-500/15 text-red-400"}`} title={v.company_name}>
                    {v.company_name}
                  </div>
                ))}
                {dayVisits.length > 3 && <div className="text-[10px] text-muted px-1">+{dayVisits.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, n, tone }: { label: string; n: number; tone: string }) {
  const c = tone === "teal" ? "text-teal" : tone === "gold" ? "text-gold" : "text-red-400";
  return <div className="card p-4"><div className="text-xs text-muted">{label}</div><div className={`text-2xl font-bold ${c}`}>{n}</div></div>;
}
function Tab({ on, onClick, icon: Icon, label }: any) {
  return <button onClick={onClick} className={`btn ${on ? "btn-gold" : "btn-ghost"}`}><Icon className="w-4 h-4" /> {label}</button>;
}
