"use client";

import Link from "next/link";
import { Card, Stat, formatMoney, formatPercent } from "./ui";
import TickerLogo from "./TickerLogo";

/**
 * Vue d'ensemble : revenu annuel estimé des dividendes et prochain versement.
 * estimate : sortie de estimateDividends ; portfolioValue dans la devise de référence.
 */
export default function DividendIncomeCard({ estimate, portfolioValue, base = "EUR" }) {
  if (!estimate || !(estimate.annual > 0)) return null;
  const { annual, monthly, next, positions } = estimate;
  const yieldPct = portfolioValue > 0 ? (annual / portfolioValue) * 100 : null;
  const nextLogo = next ? positions.find((p) => p.ticker === next.ticker)?.logo : null;

  return (
    <Card as="section" aria-labelledby="div-income-title" className="mb-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="div-income-title" className="text-lg font-bold text-ink">
          Revenus de dividendes
        </h2>
        <Link
          href="/analyses/dividendes"
          className="rounded text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Voir le calendrier →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Stat label="Revenu annuel estimé" value={<span className="money">{formatMoney(annual, base, { decimals: 0 })}</span>}>
          <span className="text-xs text-ink-muted">
            soit <span className="money">{formatMoney(monthly, base, { decimals: 0 })}</span> par mois en moyenne
          </span>
        </Stat>
        <Stat label="Rendement" value={yieldPct != null ? formatPercent(yieldPct, { signed: false }) : "—"}>
          <span className="text-xs text-ink-muted">
            {positions.length} ligne{positions.length > 1 ? "s" : ""} versant un dividende
          </span>
        </Stat>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Prochain détachement</span>
          {next ? (
            <div className="flex items-center gap-3">
              <TickerLogo ticker={next.ticker} logo={nextLogo} size={32} />
              <div className="min-w-0">
                <div className="text-sm text-ink">
                  <span className="font-mono font-bold">{next.ticker}</span>
                  {" · "}
                  <time dateTime={next.date.toISOString().slice(0, 10)}>
                    {next.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </time>
                </div>
                <div className="money text-sm font-semibold text-accent tabular-nums">{formatMoney(next.amount, base)}</div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-ink-muted">Date inconnue</span>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Estimation à partir des derniers dividendes versés, dans votre devise de référence ; les montants réels peuvent varier.
      </p>
    </Card>
  );
}
