import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string;
  detail?: string;
  icon: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "accent";
};

const toneClasses = {
  neutral: "border-stone-700/70 bg-stone-950/54 text-stone-100",
  positive: "border-emerald-500/35 bg-emerald-950/24 text-emerald-100",
  negative: "border-red-500/35 bg-red-950/24 text-red-100",
  accent: "border-amber-400/35 bg-amber-950/24 text-amber-100",
};

export function StatCard({ title, value, detail, icon, tone = "neutral" }: StatCardProps) {
  return (
    <section className={`rounded-lg border p-4 shadow-lg shadow-black/10 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-400">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
          {detail ? <p className="mt-2 text-sm text-stone-400">{detail}</p> : null}
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-stone-900/80 text-stone-200">
          {icon}
        </div>
      </div>
    </section>
  );
}
