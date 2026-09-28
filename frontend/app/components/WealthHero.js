"use client";

import { Card, Delta } from "./ui";
import { headingAngle } from "@/lib/wealth";

const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Montant signé avec « − » typographique
function signed(n, symbol) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${nf2.format(Math.abs(n))} ${symbol}`;
}

// Le « cap » de DESIGN.md : flèche orientée selon la variation du jour (vers le haut si hausse)
function Heading({ pct }) {
  const tone = pct > 0 ? "text-gain" : pct < 0 ? "text-loss" : "text-ink-muted";
  const label =
    pct == null ? "Variation du jour inconnue" : pct > 0 ? "Cap à la hausse aujourd'hui" : pct < 0 ? "Cap à la baisse aujourd'hui" : "Cap stable aujourd'hui";
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 ${tone}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 transition-transform duration-200 motion-reduce:transition-none"
        style={{ transform: `rotate(${headingAngle(pct)}deg)` }}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12h15" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

/**
 * Carte de synthèse en tête de la vue d'ensemble : valeur totale en grand,
 * cap du jour, variation du jour et plus-value depuis l'achat.
 */
export default function WealthHero({ summary, symbol, base }) {
  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <Heading pct={summary.dayChangePct} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Patrimoine total</p>
            <p className="money break-words text-4xl font-semibold tabular-nums text-ink sm:text-5xl">
              {nf2.format(summary.total)} {symbol}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Positions <span className="money">{nf2.format(summary.invested)} {symbol}</span>
              {summary.cash !== 0 && (
                <>
                  {" · "}
                  {summary.cash < 0 ? "Dette" : "Cash"}{" "}
                  <span className="money">{nf2.format(Math.abs(summary.cash))} {symbol}</span>
                </>
              )}
              {" · "}converti en {base} (taux BCE)
              {summary.missing && " — une devise n'a pas pu être convertie"}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:gap-8">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Aujourd&apos;hui</dt>
            <dd className="money text-xl font-semibold tabular-nums text-ink">{signed(summary.dayChange, symbol)}</dd>
            <dd><Delta value={summary.dayChangePct} className="text-sm" /></dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Depuis l&apos;achat</dt>
            <dd className="money text-xl font-semibold tabular-nums text-ink">{signed(summary.gain, symbol)}</dd>
            <dd><Delta value={summary.gainPct} className="text-sm" /></dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
