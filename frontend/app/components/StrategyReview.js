"use client";

import Link from "next/link";
import { Badge } from "./ui";
import { severityLevel, proposalsBrief, gaugeScale, THRESHOLDS } from "@/lib/strategyReview";

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export const INVESTMENT_DISCLAIMER =
  "Outil d'aide à la réflexion, pas un conseil en investissement : Nauticash ne recommande jamais l'achat d'un titre précis.";

/** Cartes de propositions, déjà triées par importance (lib/strategyReview.js) */
export function ProposalCards({ proposals, symbol = "€" }) {
  if (!proposals?.length) {
    return (
      <p className="rounded-xl border border-gain/30 bg-gain/10 px-4 py-3 text-sm text-ink">
        ✓ Votre portefeuille est aligné avec votre stratégie : aucun écart notable.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3">
      {proposals.map((p) => {
        const level = severityLevel(p.severity);
        return (
          <li key={p.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Badge tone={level.tone}>{level.label}</Badge>
              {Number(p.amount) > 0 && p.id !== "yield-below-target" && (
                <span className="money text-sm font-semibold tabular-nums text-ink">
                  {nf0.format(p.amount)} {symbol}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-ink">{p.title}</h3>
            <p className="mt-1 text-sm text-ink-muted">{p.detail}</p>
            {p.tickers?.length > 0 && (
              <p className="mt-2 text-xs text-ink-muted">
                Lignes concernées : <span className="font-medium text-ink">{p.tickers.slice(0, 8).join(", ")}</span>
                {p.tickers.length > 8 ? ` et ${p.tickers.length - 8} autres` : ""}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Jauges cible vs réel par poche (barre = part réelle, repère = cible) */
export function AllocationGauges({ gaps }) {
  const buckets = (gaps?.buckets || []).filter((b) => b.target > 0 || b.actual > 0);
  const scale = gaugeScale(buckets);
  return (
    <ul className="space-y-4">
      {buckets.map((b) => {
        const off = Math.abs(b.gapPct) >= THRESHOLDS.zoneGap;
        const sign = b.gapPct > 0 ? "▲ +" : b.gapPct < 0 ? "▼ −" : "";
        return (
          <li key={b.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">{b.label}</span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                <span className="font-semibold text-ink">{nf1.format(b.actual)} %</span> / cible {nf1.format(b.target)} %
                {b.gapPct !== 0 && (
                  <span className={`ml-2 text-xs font-semibold ${off ? "text-warn" : "text-ink-muted"}`}>
                    {sign}
                    {nf1.format(Math.abs(b.gapPct))} pt
                  </span>
                )}
              </span>
            </div>
            <div
              className="relative h-2.5 rounded-full bg-surface-2"
              role="img"
              aria-label={`${b.label} : ${nf1.format(b.actual)} % réel pour ${nf1.format(b.target)} % visés`}
            >
              <div
                className={`h-full rounded-full ${off ? "bg-warn" : "bg-accent-2"}`}
                style={{ width: `${Math.min(100, (b.actual / scale) * 100)}%` }}
              />
              {b.target > 0 && (
                <span
                  className="absolute -top-1 h-[18px] w-0.5 -translate-x-1/2 rounded bg-ink"
                  style={{ left: `${Math.min(100, (b.target / scale) * 100)}%` }}
                  aria-hidden="true"
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Résumé des propositions pour le Tableau de bord */
export function StrategyBrief({ review }) {
  if (!review) return null;
  const brief = proposalsBrief(review, 3);
  return (
    <section id="strategie-en-bref" aria-labelledby="strategy-brief-title" className="mb-8 scroll-mt-24">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="strategy-brief-title" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Stratégie en bref
        </h2>
        <Link href="/strategie" className="text-sm font-medium text-accent hover:underline">
          Voir ma stratégie
        </Link>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        {brief.total === 0 ? (
          <p className="text-sm text-ink">✓ Votre portefeuille est aligné avec votre stratégie.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {brief.top.map((p) => {
                const level = severityLevel(p.severity);
                return (
                  <li key={p.id} className="flex items-start gap-3 text-sm">
                    <Badge tone={level.tone} className="shrink-0">{level.label}</Badge>
                    <span className="min-w-0 text-ink">{p.title}</span>
                  </li>
                );
              })}
            </ul>
            {brief.total > brief.top.length && (
              <p className="mt-3 text-xs text-ink-muted">
                {brief.total - brief.top.length} autre{brief.total - brief.top.length > 1 ? "s" : ""} proposition
                {brief.total - brief.top.length > 1 ? "s" : ""} sur la page Stratégie.
              </p>
            )}
          </>
        )}
        <p className="mt-3 text-xs text-ink-muted">{INVESTMENT_DISCLAIMER}</p>
      </div>
    </section>
  );
}
