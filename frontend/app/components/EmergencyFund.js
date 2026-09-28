"use client";

import Link from "next/link";

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

// Repères usuels : 3 à 6 mois de dépenses de côté, disponibles immédiatement
const MIN_MONTHS = 3;
const TARGET_MONTHS = 6;
const HIGH_MONTHS = 12;

/** Nombre de mois de dépenses couverts par le cash (null si dépenses non renseignées) */
export function monthsCovered(cash, monthlyExpenses) {
  const m = Number(monthlyExpenses);
  if (!(m > 0)) return null;
  return Math.max(0, Number(cash) || 0) / m;
}

/**
 * Fonds de précaution : cash (dans la devise de référence) comparé aux dépenses mensuelles du profil.
 */
export default function EmergencyFund({ cash, monthlyExpenses, symbol = "€" }) {
  const months = monthsCovered(cash, monthlyExpenses);

  if (months === null) {
    return (
      <p className="mb-4 text-sm text-ink-muted">
        <Link href="/profil" className="font-medium text-accent underline-offset-2 hover:underline">
          Indiquez vos dépenses mensuelles
        </Link>{" "}
        pour vérifier votre fonds de précaution.
      </p>
    );
  }

  const target = Number(monthlyExpenses) * TARGET_MONTHS;
  const missing = Math.max(0, Number(monthlyExpenses) * MIN_MONTHS - Math.max(0, Number(cash) || 0));
  const pct = Math.min(100, (months / TARGET_MONTHS) * 100);
  const state = months < MIN_MONTHS ? "low" : months > HIGH_MONTHS ? "high" : "ok";
  const tone = {
    low: { bar: "bg-warn/100", badge: "border-warn/30 bg-warn/10 text-warn", label: "À renforcer" },
    ok: { bar: "bg-accent/100", badge: "border-accent/40 bg-accent/10 text-accent", label: "Constitué" },
    high: { bar: "bg-sky-500/100", badge: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300", label: "Confortable" },
  }[state];

  return (
    <section aria-labelledby="emergency-title" className="mb-4 rounded-xl border border-line bg-surface p-5 shadow-lg">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="emergency-title" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Fonds de précaution
        </h2>
        <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${tone.badge}`}>{tone.label}</span>
      </div>
      <p className="mb-2 text-sm text-ink-muted">
        Votre cash couvre{" "}
        <span className="font-bold text-ink tabular-nums">{nf1.format(months)} mois</span> de dépenses (repère : {MIN_MONTHS} à{" "}
        {TARGET_MONTHS} mois, soit <span className="money font-semibold">{nf0.format(target)} {symbol}</span> pour {TARGET_MONTHS} mois).
      </p>
      <div
        role="progressbar"
        aria-label="Mois de dépenses couverts par le cash, sur un repère de 6 mois"
        aria-valuemin={0}
        aria-valuemax={TARGET_MONTHS}
        aria-valuenow={Math.round(Math.min(months, TARGET_MONTHS) * 10) / 10}
        className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
        {/* Repère des 3 mois */}
        <span aria-hidden="true" className="absolute inset-y-0 w-px bg-ink-muted" style={{ left: `${(MIN_MONTHS / TARGET_MONTHS) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {state === "low" && (
          <>
            Il manque environ <span className="money font-semibold text-ink">{nf0.format(missing)} {symbol}</span> pour atteindre{" "}
            {MIN_MONTHS} mois : une réserve disponible immédiatement évite de vendre vos placements au mauvais moment.
          </>
        )}
        {state === "ok" && "Votre réserve de sécurité est en place : le reste peut être investi selon vos objectifs."}
        {state === "high" &&
          `Plus de ${HIGH_MONTHS} mois de dépenses en cash : une partie pourrait être placée si elle n'a pas d'usage prévu.`}{" "}
        <Link href="/profil" className="whitespace-nowrap text-accent hover:underline">
          Modifier mes dépenses
        </Link>
      </p>
    </section>
  );
}
