interface StatCardProps {
  label: string;
  value: string;
  highlight?: boolean;
}

export function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div
      className={`rounded-xl px-4 py-3 border ${
        highlight ? "border-emerald-400/60 bg-slate-900/80 shadow-glow" : "border-slate-700/70 bg-slate-900/70"
      }`}
    >
      <p className="text-[11px] text-slate-200 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
