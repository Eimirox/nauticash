"use client";

import { diversification } from "@/lib/diversification";

const TONE = {
  "Bien diversifié": { ring: "text-emerald-500", badge: "bg-accent/10 text-accent border-accent/40" },
  Équilibré: { ring: "text-sky-500", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30" },
  Concentré: { ring: "text-amber-500", badge: "bg-warn/10 text-warn border-warn/30" },
};

/** Score de diversification (lignes, secteurs, pays, devises) avec conseils sobres */
export default function DiversificationCard({ positions }) {
  const d = diversification(positions);
  if (!d) return null;
  const tone = TONE[d.level];
  const r = 36;
  const circ = 2 * Math.PI * r;

  return (
    <section aria-labelledby="diversification-title" className="mb-6 rounded-xl border border-line bg-surface p-6 shadow-lg">
      <h2 id="diversification-title" className="mb-4 text-lg font-bold text-ink">
        Diversification
      </h2>
      <div className="grid gap-6 md:grid-cols-[auto_1fr_1.2fr] md:items-center">
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 88 88" className="h-24 w-24 -rotate-90" aria-hidden="true">
              <circle cx="44" cy="44" r={r} fill="none" strokeWidth="9" className="stroke-surface-2" />
              <circle
                cx="44"
                cy="44"
                r={r}
                fill="none"
                strokeWidth="9"
                strokeLinecap="round"
                stroke="currentColor"
                className={tone.ring}
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - d.score / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-ink tabular-nums">{d.score}</span>
              <span className="text-[10px] text-ink-muted">/ 100</span>
            </span>
          </div>
          <div>
            <span className={`inline-block rounded-lg border px-2.5 py-1 text-sm font-semibold ${tone.badge}`}>{d.level}</span>
            <p className="mt-1 text-xs text-ink-muted">
              {d.stats.lines} ligne{d.stats.lines > 1 ? "s" : ""} · 5 premières : {Math.round(d.stats.top5 * 100)} %
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {d.parts.map((p) => (
            <li key={p.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-ink-muted">{p.label}</span>
                <span className="tabular-nums text-ink-muted">
                  {Math.round(p.points)} / {p.max}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent/100" style={{ width: `${(p.points / p.max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>

        <div>
          <ul className="space-y-2 text-sm text-ink">
            {d.tips.map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ink-muted/70">
            Indicateur simplifié (un ETF compte comme un panier de titres), qui ne constitue pas un conseil en investissement.
          </p>
        </div>
      </div>
    </section>
  );
}
