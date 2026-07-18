"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHead, Badge, Empty } from "@/components/ui";
import { Field, Modal } from "@/components/form";
import { Plus, Upload, Download, ExternalLink, Phone, Mail, MessageCircle, CheckCircle, XCircle, Calendar } from "lucide-react";
import { useRealtime } from "@/lib/useRealtime";
import { format, addDays } from "date-fns";

const CITIES = [
  "Riyadh","Jeddah","Khobar","Dammam","Dhahran","Mecca","Medina","Tabuk","Abha","Buraidah"
];

const INDUSTRIES = [
  "Restaurants & Cafés","Hotels & Hospitality","Real Estate","Events & Weddings",
  "Clinics & Medical","Gyms & Fitness","Salons & Beauty","Retail",
  "Education","Automotive","Construction","Other",
];

const BLANK = {
  company_name: "", city: "", industry: "Other", phone: "", whatsapp: "",
  email: "", website: "", instagram: "", assigned_to: "", notes: "",
};

export default function Prospects() {
  const [rows, setRows] = useState<any[]>([]);
  const [view, setView] = useState<"today"|"all">("today");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...BLANK, city: CITIES[0] });
  const [team, setTeam] = useState<any[]>([]);
  const [filters, setFilters] = useState({ city: "", industry: "", status: "", assigned: "", search: "" });
  const [batch, setBatch] = useState(10);
  const [profile, setProfile] = useState<any>(null);
  const fileRef = useRef<any>(null);

  async function load() {
    const { data } = await supabase
      .from("prospects")
      .select("*, profiles!assigned_to(full_name), profiles!created_by(full_name)")
      .order("created_at", { ascending: true });
    setRows(data || []);
    const { data: t } = await supabase.from("profiles").select("id, full_name, role")
      .in("role", ["ceo", "sales_manager"]);
    setTeam(t || []);
    const { data: me } = await supabase.from("profiles").select("*").limit(1);
    if (me?.[0]) setProfile(me[0]);
  }

  useEffect(() => { load(); }, []);
  useRealtime(["prospects"], load);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const followUps = useMemo(() =>
    rows.filter((p: any) => p.follow_up_date && p.follow_up_date <= today && p.status === "follow_up"),
  [rows, today]);

  const baseFiltered = useMemo(() => {
    let r = rows;
    if (filters.city) r = r.filter((p: any) => p.city === filters.city);
    if (filters.industry) r = r.filter((p: any) => p.industry === filters.industry);
    if (filters.assigned) r = r.filter((p: any) => p.assigned_to === filters.assigned);
    if (filters.search) r = r.filter((p: any) =>
      p.company_name?.toLowerCase().includes(filters.search.toLowerCase()));
    return r;
  }, [rows, filters]);

  const freshBatch = useMemo(() =>
    baseFiltered.filter((p: any) => p.status === "new").slice(0, batch),
  [baseFiltered, batch]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filters.city) r = r.filter((p: any) => p.city === filters.city);
    if (filters.industry) r = r.filter((p: any) => p.industry === filters.industry);
    if (filters.status) r = r.filter((p: any) => p.status === filters.status);
    if (filters.assigned) r = r.filter((p: any) => p.assigned_to === filters.assigned);
    if (filters.search) r = r.filter((p: any) =>
      p.company_name?.toLowerCase().includes(filters.search.toLowerCase()));
    return r;
  }, [rows, filters]);

  const name = (id: string) => team.find((t) => t.id === id)?.full_name || "—";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) { alert("Company name is required."); return; }
    const { error } = await supabase.from("prospects").insert({
      ...form,
      source: "manual",
      created_by: profile?.id,
    });
    if (error) { alert("Could not save: " + error.message); return; }
    setForm({ ...BLANK, city: CITIES[0] });
    setOpen(false);
    load();
  }

  async function handleOutcome(id: string, outcome: string, extra?: any) {
    const p = rows.find((r: any) => r.id === id);
    if (!p) return;
    const updates: any = { last_contacted_at: new Date().toISOString() };
    if (outcome === "no_answer") {
      Object.assign(updates, { status: "contacted", contact_count: (p.contact_count || 0) + 1 });
    } else if (outcome === "interested") {
      if (!extra?.follow_up_date) return;
      Object.assign(updates, { status: "follow_up", follow_up_date: extra.follow_up_date, contact_count: (p.contact_count || 0) + 1 });
    } else if (outcome === "meeting") {
      Object.assign(updates, { status: "meeting" });
    } else if (outcome === "rejected") {
      Object.assign(updates, { status: "rejected" });
    }
    await supabase.from("prospects").update(updates).eq("id", id);
    load();
  }

  async function handleConvert(id: string) {
    const p = rows.find((r: any) => r.id === id);
    if (!p || p.status === "converted") return;
    const { data: client, error } = await supabase.from("clients").insert({
      name: p.company_name,
      package_tier: "projects",
      monthly_fee: 0,
      status: "active",
      phone: p.phone,
      email: p.email,
      brought_by: p.assigned_to || profile?.id,
    }).select().single();
    if (error) { alert("Could not convert: " + error.message); return; }
    await supabase.from("prospects").update({
      status: "converted",
      converted_client_id: client.id,
    }).eq("id", id);
    load();
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      if (!lines.length) return;
      const header = lines[0].split(",").map((h: string) => h.trim().replace(/"/g, ""));
      const expected = ["company_name","city","industry","phone","whatsapp","email","website","notes"];
      if (header.join(",") !== expected.join(",")) {
        alert("Invalid CSV header. Expected: " + expected.join(","));
        return;
      }
      let imported = 0, skipped = 0;
      const toInsert: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map((v: string) => v.trim().replace(/"/g, ""));
        if (!vals[0]?.trim()) { skipped++; continue; }
        toInsert.push({
          company_name: vals[0],
          city: vals[1] || "",
          industry: vals[2] || "Other",
          phone: vals[3] || "",
          whatsapp: vals[4] || "",
          email: vals[5] || "",
          website: vals[6] || "",
          notes: vals[7] || "",
          source: "csv",
          created_by: profile?.id,
        });
        imported++;
      }
      if (toInsert.length) await supabase.from("prospects").insert(toInsert);
      alert(`Imported ${imported}, skipped ${skipped}.`);
      if (fileRef.current) fileRef.current.value = "";
      load();
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv = "company_name,city,industry,phone,whatsapp,email,website,notes\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prospects_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function canConvert(p: any) {
    return p.status === "meeting" || p.status === "follow_up";
  }

  return (
    <div>
      <PageHead title="Prospects" sub="Pipeline and daily outreach queue."
        action={<div className="flex gap-2">
          <button className="btn btn-ghost text-xs" onClick={downloadTemplate}><Download className="w-3 h-3" /> Template</button>
          <button className="btn btn-ghost text-xs" onClick={() => fileRef.current?.click()}><Upload className="w-3 h-3" /> Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button className="btn btn-gold" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Add Prospect</button>
        </div>}
      />

      <div className="flex gap-2 mb-5">
        <button className={`btn ${view === "today" ? "btn-gold" : "btn-ghost"}`} onClick={() => setView("today")}>Today</button>
        <button className={`btn ${view === "all" ? "btn-gold" : "btn-ghost"}`} onClick={() => setView("all")}>All</button>
      </div>

      {view === "today" ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gold mb-2">Follow-ups due</h3>
            {followUps.length === 0
              ? <div className="card p-6 text-center text-muted text-sm">No follow-ups due today.</div>
              : <div className="space-y-2">{followUps.map((p: any) => (
                <ProspectCard key={p.id} p={p} name={name} onOutcome={handleOutcome} onConvert={handleConvert} canConvert={canConvert} />
              ))}</div>
            }
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gold mb-2">Fresh outreach</h3>
            {freshBatch.length === 0
              ? <div className="card p-6 text-center text-muted text-sm">No new prospects in queue.</div>
              : <div className="space-y-2">{freshBatch.map((p: any) => (
                <ProspectCard key={p.id} p={p} name={name} onOutcome={handleOutcome} onConvert={handleConvert} canConvert={canConvert} />
              ))}</div>
            }
            {rows.filter((r: any) => r.status === "new").length > batch && (
              <button className="btn btn-ghost mt-2" onClick={() => setBatch(b => b + 10)}>Show 10 more</button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="card p-3">
            <div className="flex flex-wrap gap-2">
              <select className="input text-xs" value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})}>
                <option value="">All cities</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="_other">Other city</option>
              </select>
              <select className="input text-xs" value={filters.industry} onChange={e => setFilters({...filters, industry: e.target.value})}>
                <option value="">All industries</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <select className="input text-xs" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                <option value="">All statuses</option>
                <option value="new">New</option><option value="contacted">Contacted</option>
                <option value="follow_up">Follow up</option><option value="meeting">Meeting</option>
                <option value="converted">Converted</option><option value="rejected">Rejected</option>
              </select>
              <select className="input text-xs" value={filters.assigned} onChange={e => setFilters({...filters, assigned: e.target.value})}>
                <option value="">All assigned</option>
                {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <input className="input text-xs" placeholder="Search company…" value={filters.search}
                onChange={e => setFilters({...filters, search: e.target.value})} />
            </div>
          </div>
          {filtered.length === 0 ? <Empty text="No prospects match your filters." /> : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead><tr>{["Company","City","Industry","Status","Assigned","Follow-up","Contacted ×","Actions"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map((p: any) => (
                    <tr key={p.id} className="hover:bg-panel2/50">
                      <td className="td font-semibold">{p.company_name}</td>
                      <td className="td text-muted text-sm">{p.city || "—"}</td>
                      <td className="td text-muted text-sm">{p.industry}</td>
                      <td className="td"><Badge value={p.status} /></td>
                      <td className="td text-sm">{name(p.assigned_to)}</td>
                      <td className="td text-muted text-sm whitespace-nowrap">{p.follow_up_date || "—"}</td>
                      <td className="td text-sm">{p.contact_count ?? 0}</td>
                      <td className="td">
                        <div className="flex gap-1 items-center">
                          <a href={`https://wa.me/${(p.whatsapp || p.phone).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                            className={`p-1 rounded hover:bg-panel2 ${(!p.whatsapp && !p.phone) ? "opacity-30 pointer-events-none" : ""}`}>
                            <MessageCircle className="w-3.5 h-3.5 text-teal" />
                          </a>
                          <a href={`tel:${p.phone}`} className={`p-1 rounded hover:bg-panel2 ${!p.phone ? "opacity-30 pointer-events-none" : ""}`}>
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                          </a>
                          <a href={`mailto:${p.email}`} className={`p-1 rounded hover:bg-panel2 ${!p.email ? "opacity-30 pointer-events-none" : ""}`}>
                            <Mail className="w-3.5 h-3.5 text-gold" />
                          </a>
                          <select className="bg-ink border border-line rounded px-1 py-0.5 text-xs" defaultValue=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              if (val === "interested") {
                                const d = prompt("Follow-up date (YYYY-MM-DD):", format(addDays(new Date(), 3), "yyyy-MM-dd"));
                                if (!d) return;
                                handleOutcome(p.id, "interested", { follow_up_date: d });
                              } else {
                                handleOutcome(p.id, val);
                              }
                              e.target.value = "";
                            }}>
                            <option value="">Outcome…</option>
                            <option value="no_answer">No answer</option>
                            <option value="interested">Interested</option>
                            <option value="meeting">Meeting booked</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          {canConvert(p) && (
                            <button className="btn btn-gold text-xs py-0.5 px-1.5" onClick={() => handleConvert(p.id)}>Convert</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {open && (
        <Modal title="Add Prospect" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Company name *" full>
              <input className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
            </Field>
            <Field label="City">
              <select className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="">Other</option>
              </select>
            </Field>
            <Field label="Industry">
              <select className="input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><input className="input" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
            <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Website"><input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
            <Field label="Instagram"><input className="input" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></Field>
            <Field label="Assigned to" full>
              <select className="input" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">— unassigned —</option>
                {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </Field>
            <Field label="Notes" full>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-gold">Save Prospect</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ProspectCard({ p, name, onOutcome, onConvert, canConvert }: any) {
  return (
    <div className="card p-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{p.company_name}</div>
        <div className="text-xs text-muted">{[p.city, p.industry].filter(Boolean).join(" · ") || "—"}</div>
        <div className="flex gap-1 mt-1.5">
          <a href={`https://wa.me/${(p.whatsapp || p.phone).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            className={`p-1 rounded hover:bg-panel2 ${(!p.whatsapp && !p.phone) ? "opacity-30 pointer-events-none" : ""}`}>
            <MessageCircle className="w-3.5 h-3.5 text-teal" />
          </a>
          <a href={`tel:${p.phone}`} className={`p-1 rounded hover:bg-panel2 ${!p.phone ? "opacity-30 pointer-events-none" : ""}`}>
            <Phone className="w-3.5 h-3.5 text-blue-400" />
          </a>
          <a href={`mailto:${p.email}`} className={`p-1 rounded hover:bg-panel2 ${!p.email ? "opacity-30 pointer-events-none" : ""}`}>
            <Mail className="w-3.5 h-3.5 text-gold" />
          </a>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge value={p.status} />
        {p.follow_up_date && <span className="text-xs text-muted">{p.follow_up_date}</span>}
        <select className="bg-ink border border-line rounded px-1 py-0.5 text-xs" defaultValue=""
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            if (val === "interested") {
              const d = prompt("Follow-up date (YYYY-MM-DD):", format(addDays(new Date(), 3), "yyyy-MM-dd"));
              if (!d) return;
              onOutcome(p.id, "interested", { follow_up_date: d });
            } else {
              onOutcome(p.id, val);
            }
            e.target.value = "";
          }}>
          <option value="">Outcome…</option>
          <option value="no_answer">No answer</option>
          <option value="interested">Interested</option>
          <option value="meeting">Meeting booked</option>
          <option value="rejected">Rejected</option>
        </select>
        {canConvert(p) && (
          <button className="btn btn-gold text-xs py-0.5 px-1.5" onClick={() => onConvert(p.id)}>Convert</button>
        )}
      </div>
    </div>
  );
}
