"use client";
export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  interested: "bg-teal/20 text-teal",
  potential: "bg-gold/20 text-gold",
  not_interested: "bg-red-500/15 text-red-400",
  active: "bg-teal/20 text-teal",
  paused: "bg-gold/20 text-gold",
  churned: "bg-red-500/15 text-red-400",
  paid: "bg-teal/20 text-teal",
  pending: "bg-gold/20 text-gold",
  overdue: "bg-red-500/15 text-red-400",
  todo: "bg-line text-muted",
  in_progress: "bg-gold/20 text-gold",
  done: "bg-teal/20 text-teal",
  high: "bg-red-500/15 text-red-400",
  normal: "bg-line text-muted",
  low: "bg-line text-muted",
};
const LABELS: Record<string, string> = { churned: "ended" };
export function Badge({ value }: { value: string }) {
  const label = (LABELS[value] || value || "").replace(/_/g, " ");
  return <span className={`badge ${STATUS_STYLES[value] || "bg-line text-muted"}`}>{label}</span>;
}

export function Money({ n }: { n: number }) {
  return <span>SAR {Number(n || 0).toLocaleString()}</span>;
}

export function Empty({ text }: { text: string }) {
  return <div className="card p-8 text-center text-muted text-sm">{text}</div>;
}
