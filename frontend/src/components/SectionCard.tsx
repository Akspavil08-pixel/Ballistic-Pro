import { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <section className="card-glass strelok-card rounded-xl p-4 shadow-soft">
      <div className="mb-4 strelok-card-header">
        <h2 className="font-display text-base text-white strelok-card-title">{title}</h2>
        {subtitle ? <p className="text-xs text-slate-300 mt-1 strelok-card-subtitle">{subtitle}</p> : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
