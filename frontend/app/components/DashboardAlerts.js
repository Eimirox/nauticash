"use client";

import Link from "next/link";

const TONE = {
  loss: { box: "border-loss/30 bg-loss/10", title: "text-loss", icon: "⚠" },
  warn: { box: "border-warn/30 bg-warn/10", title: "text-warn", icon: "!" },
};

const MAX_TICKERS = 6;

/**
 * Alertes du tableau de bord (voir lib/alerts.js).
 * Sans alerte : une ligne rassurante plutôt qu'un bloc vide.
 */
export default function DashboardAlerts({ alerts }) {
  return (
    <section aria-labelledby="alerts-title" className="mb-8">
      <h2 id="alerts-title" className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Alertes
      </h2>
      {alerts.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          <span aria-hidden="true" className="mr-2 text-accent">✓</span>
          Rien à signaler : cours à jour et réserve de sécurité en place.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {alerts.map((a) => {
            const tone = TONE[a.level] || TONE.warn;
            const shown = (a.tickers || []).slice(0, MAX_TICKERS);
            const more = (a.tickers || []).length - shown.length;
            return (
              <li key={a.id} className={`rounded-xl border px-4 py-3 ${tone.box}`}>
                <p className={`flex items-center gap-2 text-sm font-semibold ${tone.title}`}>
                  <span aria-hidden="true">{tone.icon}</span>
                  {a.title}
                </p>
                {shown.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {shown.map((t) => (
                      <span key={t} className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink tabular-nums">
                        {t}
                      </span>
                    ))}
                    {more > 0 && <span className="text-[11px] text-ink-muted">+{more}</span>}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-muted">
                  {a.detail}{" "}
                  <Link href={a.href} className="whitespace-nowrap font-medium text-accent hover:underline">
                    {a.cta}
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
