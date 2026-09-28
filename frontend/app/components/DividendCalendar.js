"use client";

import { useState } from "react";
import TickerLogo from "./TickerLogo";
import { formatMoney } from "./ui";
import { FREQUENCY_LABELS } from "@/lib/dividendCalendar";

const INITIAL_MONTHS = 4;

/**
 * Calendrier des versements estimés sur les 12 prochains mois, regroupés par mois
 * (sous-total par mois). months : sortie de projectDividends / estimateDividends.
 */
export default function DividendCalendar({ months, next12, base = "EUR", logos = {} }) {
  const [showAll, setShowAll] = useState(false);
  const withPayments = (months || []).filter((m) => m.items.length > 0);
  if (!withPayments.length) return null;
  const visible = showAll ? withPayments : withPayments.slice(0, INITIAL_MONTHS);

  return (
    <section aria-labelledby="div-calendar-title" className="rounded-xl border border-line bg-surface p-6 shadow-lg">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="div-calendar-title" className="text-lg font-bold text-ink">
          Calendrier des 12 prochains mois
        </h3>
        <p className="text-sm text-ink-muted">
          Total sur la période : <span className="money font-semibold text-ink tabular-nums">{formatMoney(next12, base)}</span>
        </p>
      </div>

      <ol className="space-y-5">
        {visible.map((m) => (
          <li key={m.key}>
            <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line pb-1">
              <h4 className="text-sm font-semibold capitalize text-ink">{m.longLabel}</h4>
              <span className="money text-sm font-semibold text-accent tabular-nums">{formatMoney(m.total, base)}</span>
            </div>
            <ul className="space-y-2">
              {m.items.map((item) => (
                <li
                  key={`${item.ticker}-${item.date.getTime()}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <time
                      dateTime={item.date.toISOString().slice(0, 10)}
                      className="w-14 shrink-0 whitespace-nowrap text-center text-xs font-semibold uppercase text-ink-muted tabular-nums"
                    >
                      {item.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </time>
                    <TickerLogo ticker={item.ticker} logo={logos[item.ticker]} size={28} />
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-ink">{item.ticker}</div>
                      <div className="truncate text-xs text-ink-muted">
                        {[item.name && item.name !== item.ticker && item.name, (FREQUENCY_LABELS[item.frequency] || "").toLowerCase()]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </div>
                  <span className="money shrink-0 text-sm font-semibold text-ink tabular-nums">{formatMoney(item.amount, base)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {withPayments.length > INITIAL_MONTHS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-4 min-h-[40px] rounded-lg px-3 text-sm font-medium text-accent hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {showAll ? "Afficher moins" : `Afficher les ${withPayments.length} mois avec versement`}
        </button>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Dates de détachement estimées d&apos;après le rythme des derniers versements ; le paiement suit généralement de quelques jours à quelques semaines.
      </p>
    </section>
  );
}
