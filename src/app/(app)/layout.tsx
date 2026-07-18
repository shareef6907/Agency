"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { can, ROLE_LABEL } from "@/lib/roles";
import {
  LayoutDashboard, Briefcase, Users, CheckSquare, CreditCard,
  TrendingUp, UserCog, LogOut, Menu, X, Clapperboard, Calculator, BarChart3, Target,
} from "lucide-react";

const NAV = [
  { key: "dashboard", href: "/", label: "Dashboard", icon: LayoutDashboard },
  { key: "crm", href: "/crm", label: "Sales CRM", icon: Briefcase },
  { key: "prospects", href: "/prospects", label: "Prospects", icon: Target },
  { key: "clients", href: "/clients", label: "Clients", icon: Users },
  { key: "tasks", href: "/tasks", label: "Tasks", icon: CheckSquare },
  { key: "payments", href: "/payments", label: "Payments", icon: CreditCard },
  { key: "finance", href: "/finance", label: "Finance", icon: TrendingUp },
  { key: "revenue", href: "/revenue", label: "Revenue", icon: BarChart3 },
  { key: "accounting", href: "/accounting", label: "Accounting", icon: Calculator },
  { key: "team", href: "/team", label: "Team", icon: UserCog },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  if (!profile) return null;

  const items = NAV.filter((n) => can(profile.role, n.key));

  return (
    <div className="min-h-screen flex">
      {/* sidebar */}
      <aside className={`fixed z-40 inset-y-0 left-0 w-64 bg-panel border-r border-line p-4 flex flex-col transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 mb-6 px-1">
          <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center">
            <Clapperboard className="w-5 h-5 text-ink" />
          </div>
          <div className="font-bold">Studio OS</div>
          <button className="ml-auto md:hidden text-muted" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 space-y-1">
          {items.map((n) => {
            const active = pathname === n.href;
            const Icon = n.icon;
            return (
              <Link key={n.key} href={n.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${active ? "bg-gold text-ink" : "text-muted hover:text-white hover:bg-panel2"}`}>
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line pt-3 mt-3">
          <div className="px-2 mb-2">
            <div className="text-sm font-semibold text-white truncate">{profile.full_name || "—"}</div>
            <div className="text-xs text-gold">{ROLE_LABEL[profile.role]}</div>
          </div>
          <button onClick={signOut} className="btn btn-ghost w-full text-sm"><LogOut className="w-4 h-4" /> Sign out</button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setOpen(false)} />}

      {/* main */}
      <div className="flex-1 md:ml-64 min-w-0">
        <header className="md:hidden sticky top-0 z-20 bg-panel border-b border-line px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="text-muted"><Menu className="w-6 h-6" /></button>
          <span className="font-bold">Studio OS</span>
        </header>
        <main className="p-4 md:p-8 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
