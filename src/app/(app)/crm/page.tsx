"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { PageHead, Badge, Empty } from "@/components/ui";
import { Field, Modal } from "@/components/form";
import { useRealtime } from "@/lib/useRealtime";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay,
  addMonths, startOfWeek, endOfWeek,
} from "date-fns";
import {
  Plus, CalendarPlus, Table2, CalendarDays, Columns3, CalendarClock,
  ChevronLeft, ChevronRight, Check, Trash2, Phone, MapPin, Users2,
} from "lucide-react";

type Visit = {
  id: string; visit_date: string; company_name: string; contact_person: string;
  designation: string; email: string; phone: string; comments: string;
  status: "interested" | "potential" | "not_interested"; created_by: string;
};
type Meeting = {
  id: string; company_name: string; contact_person: string; meeting_at: string;
  type: "meeting" | "call" | "visit"; comments: string; outcome: string;
  status: "scheduled" | "done" | "cancelled"; created_by: string;
};
const BLANK = {
  visit_date: format(new Date(), "yyyy-MM-dd"), company_name: "", contact_person: "",
  designation: "", email: "", phone: "", comments: "", status: "potential",
};
const MBLANK = {
  company_name: "", contact_person: "",
  meeting_at: format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'10:00"),
  type: "meeting", comments: "",
};

export default function CRM() {
  const { profile } = useAuth();
  const [view, setView] = useState<"table" | "calendar" | "meetings" | "pipeline">("table");
  const [rows, setRows] = useState<Visit[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [open, setOpen] = useState(false);
  const [mtgOpen, setMtgOpen] = useState(false);
  const [form, setForm] = useState<any>(BLANK);
  const [mform, setMform] = useState<any>(MBLANK);
  const [month, setMonth] = useState(new Date());

  async function load() {
    const { data: v } = await supabase.from("sales_visits").select("*").order("visit_date", { ascending: false });
    setRows((v as Visit[]) || []);
    const { data: m } = await supabase.from("meetings").select("*").order("meeting_at", { ascending: true });
    setMeetings((m as Meeting[]) || []);
  }
  useEffect(() => { load(); }, []);
  useRealtime(["sales_visits", "meetings"], load);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("sales_visits").insert({ ...form, created_by: profile?.id });
    if (error) { alert("Could not save visit: " + error.message); return; }
    setForm(BLANK); setOpen(false); load();
  }
  async function setStatus(id: string, status: string) {
    await supabase.from("sales_visits").update({ status }).eq("id", id); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this visit?")) return;
    await supabase.from("sales_visits").delete().eq("id", id); load();
  }

  async function saveMeeting(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("meetings").insert({ ...mform, created_by: profile?.id });
    if (error) { alert("Could not schedule meeting: " + error.message); return; }
    setMform(MBLANK); setMtgOpen(false); load();
  }
  async function meetingDone(m: Meeting) {
    const note = window.prompt("How did it go? Add a note (optional):", m.outcome || "");
    await supabase.from("meetings").update({ status: "done", outcome: note || m.outcome || "" }).eq("id", m.id);
    load();
  }
  async function meetingDelete(id: string) {
    if (!confirm("Delete this meeting?")) return;
    await supabase.from("meetings").delete().eq("id", id); load();
  }

  const counts = useMemo(() => ({
    interested: rows.filter((r) => r.status === "interested").length,
    potential: rows.filter((r) => r.status === "potential").length,
    not_interested: rows.filter((r) => r.status === "not_interested").length,
  }), [rows]);

  const now = new Date();
  const upcoming = useMemo(() => meetings
    .filter((m) => m.status === "scheduled" && new Date(m.meeting_at) >= now)
    .sort((a, b) => +new Date(a.meeting_at) - +new Date(b.meeting_at)), [meetings]);
  const past = useMemo(() => meetings
    .filter((m) => !(m.status === "scheduled" && new Date(m.meeting_at) >= now))
    .sort((a, b) => +new Date(b.meeting_at) - +new Date(a.meeting_at)), [meetings]);

  return (
    <div>
      <PageHead title="Sales CRM" sub="Visits, scheduled meetings, pipeline and follow-ups."
        action={
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setMtgOpen(true)}><CalendarPlus className="w-4 h-4" /> Schedule meeting</button>
            <button className="btn btn-gold" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Log visit</button>
          </div>
        } />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Interested" n={counts.interested} tone="teal" />
        <Stat label="Potential" n={counts.potential} tone="gold" />
        <Stat label="Not interested" n={counts.not_interested} tone="red" />
        <Stat label="Upcoming meetings" n={upcoming.length} tone="gold" />
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        <Tab on={view === "table"} onClick={() => setView("table")} icon={Table2} label="Visits" />
        <Tab on={view === "meetings"} onClick={() => setView("meetings")} icon={CalendarClock} label="Meetings" />
        <Tab on={view === "calendar"} onClick={() => setView("calendar")} icon={CalendarDays} label="Calendar" />
        <Tab on={view === "pipeline"} onClick={() => setView("pipeline")} icon={Columns3} label="Pipeline" />
      </div>

      {view === "table" && (
        rows.length === 0 ? <Empty text="No visits logged yet. Tap Log visit." /> :
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

      {view === "meetings" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-gold" /> Upcoming meetings</h3>
            {upcoming.length === 0 ? <Empty text="No upcoming meetings. Tap Schedule meeting." /> :
              <div className="space-y-2">
                {upcoming.map((m) => <MeetingCard key={m.id} m={m} onDone={() => meetingDone(m)} onDel={() => meetingDelete(m.id)} upcoming />)}
              </div>}
          </div>
          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2"><Check className="w-4 h-4 text-teal" /> Past meetings</h3>
            {past.length === 0 ? <Empty text="No past meetings yet." /> :
              <div className="space-y-2">
                {past.map((m) => <MeetingCard key={m.id} m={m} onDone={() => meetingDone(m)} onDel={() => meetingDelete(m.id)} />)}
              </div>}
          </div>
        </div>
      )}

      {view === "calendar" && <Calendar rows={rows} meetings={meetings} month={month} setMonth={setMonth} />}

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

      {mtgOpen && (
        <Modal onClose={() => setMtgOpen(false)} title="Schedule a meeting">
          <form onSubmit={saveMeeting} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Company name" full><input className="input" value={mform.company_name} onChange={(e) => setMform({ ...mform, company_name: e.target.value })} required /></Field>
            <Field label="Contact person"><input className="input" value={mform.contact_person} onChange={(e) => setMform({ ...mform, contact_person: e.target.value })} /></Field>
            <Field label="Type">
              <select className="input" value={mform.type} onChange={(e) => setMform({ ...mform, type: e.target.value })}>
                <option value="meeting">Meeting</option><option value="call">Call</option><option value="visit">Visit</option>
              </select>
            </Field>
            <Field label="Date and time" full><input type="datetime-local" className="input" value={mform.meeting_at} onChange={(e) => setMform({ ...mform, meeting_at: e.target.value })} required /></Field>
            <Field label="Notes / agenda" full><textarea className="input" rows={3} value={mform.comments} onChange={(e) => setMform({ ...mform, comments: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setMtgOpen(false)}>Cancel</button>
              <button className="btn btn-gold">Schedule</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function MeetingCard({ m, onDone, onDel, upcoming }: { m: Meeting; onDone: () => void; onDel: () => void; upcoming?: boolean }) {
  const Icon = m.type === "call" ? Phone : m.type === "visit" ? MapPin : Users2;
  const dt = new Date(m.meeting_at);
  return (
    <div className={`card p-4 ${upcoming ? "border-l-4 border-l-gold" : "opacity-90"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-gold shrink-0" />
            <span className="font-semibold truncate">{m.company_name}</span>
            {m.status === "done" && <Badge value="done" />}
            {m.status === "cancelled" && <Badge value="not_interested" />}
          </div>
          <div className="text-xs text-muted mt-1">
            {format(dt, "EEE dd MMM yyyy · h:mm a")}{m.contact_person ? ` · ${m.contact_person}` : ""} · {m.type}
          </div>
          {m.comments && <div className="text-sm text-muted mt-2">{m.comments}</div>}
          {m.outcome && <div className="text-sm mt-2"><span className="text-teal font-semibold">Outcome: </span><span className="text-muted">{m.outcome}</span></div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {m.status === "scheduled" && <button onClick={onDone} className="btn btn-ghost text-xs px-2 py-1" title="Mark done"><Check className="w-4 h-4" /></button>}
          <button onClick={onDel} className="text-muted hover:text-red-400 p-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function Calendar({ rows, meetings, month, setMonth }: any) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <button className="btn btn-ghost px-2 py-1" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="w-4 h-4" /></button>
        <div className="font-semibold">{format(month, "MMMM yyyy")}</div>
        <button className="btn btn-ghost px-2 py-1" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-4 mb-3 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal/40 inline-block" /> visit</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gold inline-block" /> meeting</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dayVisits = rows.filter((r: Visit) => isSameDay(new Date(r.visit_date), d));
          const dayMtgs = meetings.filter((m: Meeting) => isSameDay(new Date(m.meeting_at), d));
          const dim = d.getMonth() !== month.getMonth();
          return (
            <div key={d.toISOString()} className={`min-h-[84px] rounded-lg border border-line p-1 ${dim ? "opacity-40" : ""}`}>
              <div className="text-[11px] text-muted px-1">{format(d, "d")}</div>
              <div className="space-y-0.5 mt-0.5">
                {dayMtgs.slice(0, 2).map((m: Meeting) => (
                  <div key={m.id} className="text-[10px] px-1 py-0.5 rounded truncate bg-gold/30 text-gold font-semibold" title={m.company_name + " " + format(new Date(m.meeting_at), "h:mm a")}>
                    {format(new Date(m.meeting_at), "HH:mm")} {m.company_name}
                  </div>
                ))}
                {dayVisits.slice(0, 2).map((v: Visit) => (
                  <div key={v.id} className="text-[10px] px-1 py-0.5 rounded truncate bg-teal/25 text-teal" title={v.company_name}>
                    {v.company_name}
                  </div>
                ))}
                {(dayVisits.length + dayMtgs.length) > 4 && <div className="text-[10px] text-muted px-1">+{dayVisits.length + dayMtgs.length - 4}</div>}
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
  return <div className="card p-4"><div className="text-xs text-muted">{label}</div><div className={"text-2xl font-bold " + c}>{n}</div></div>;
}
function Tab({ on, onClick, icon: Icon, label }: any) {
  return <button onClick={onClick} className={"btn " + (on ? "btn-gold" : "btn-ghost")}><Icon className="w-4 h-4" /> {label}</button>;
}
