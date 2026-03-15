import { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <section className="card-glass rounded-xl p-4 shadow-soft">
      <div className="mb-4">
        <h2 className="font-display text-base text-white">{title}</h2>
        {subtitle ? <p className="text-xs text-slate-300 mt-1">{subtitle}</p> : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
