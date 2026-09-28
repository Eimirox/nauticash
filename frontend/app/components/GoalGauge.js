"use client";

import Link from "next/link";
import { goalProgress } from "@/lib/goal";

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function formatMonths(m) {
  if (m >= 24) return `${Math.round(m / 12)} ans`;
  if (m >= 12) return "1 an";
  const n = Math.max(1, Math.round(m));
  return `${n} mois`;
}

/**
 * Jauge d'objectif de patrimoine (valeur actuelle / objectif du profil).
 * Sans objectif : invitation discrète à en définir un dans « Mon profil ».
 */
export default function GoalGauge({ current, goalAmount, goalDate, symbol = "€" }) {
  const g = goalProgress(current, goalAmount, goalDate);

  if (!g) {
    return (
      <p className="mb-4 text-sm text-slate-500">
        <Link href="/profil" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
          Fixez-vous un objectif de patrimoine
        </Link>{" "}
        pour suivre votre progression ici.
      </p>
    );
  }

  const deadline = goalDate
    ? new Date(`${goalDate}T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  let detail;
  if (g.reached) detail = "Objectif atteint, bravo ! Vous pouvez en fixer un nouveau dans votre profil.";
  else if (g.overdue)
    detail = (
      <>
        Échéance dépassée ({deadline}) : il reste{" "}
        <span className="money font-semibold text-slate-700">{nf0.format(g.remaining)} {symbol}</span> à constituer.
      </>
    );
  else if (g.perMonth != null)
    detail = (
      <>
        Il reste <span className="money font-semibold text-slate-700">{nf0.format(g.remaining)} {symbol}</span> d&apos;ici{" "}
        {deadline} ({formatMonths(g.monthsLeft)}), soit environ{" "}
        <span className="money font-semibold text-slate-700">{nf0.format(g.perMonth)} {symbol}</span> par mois, hors rendement.
      </>
    );
  else
    detail = (
      <>
        Il reste <span className="money font-semibold text-slate-700">{nf0.format(g.remaining)} {symbol}</span>. Ajoutez une
        échéance dans votre profil pour connaître le rythme d&apos;épargne nécessaire.
      </>
    );

  return (
    <section aria-labelledby="goal-title" className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="goal-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Objectif de patrimoine
        </h2>
        <p className="text-sm text-slate-600">
          <span className="font-bold text-slate-900 tabular-nums">{g.pct.toFixed(g.pct < 10 ? 1 : 0)} %</span> de{" "}
          <span className="money font-semibold tabular-nums">{nf0.format(Number(goalAmount))} {symbol}</span>
          {deadline && !g.reached && <> · échéance {deadline}</>}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Progression vers l'objectif de patrimoine"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(g.pct)}
        className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${
            g.reached ? "bg-emerald-500" : g.overdue ? "bg-amber-500" : "bg-gradient-to-r from-emerald-500 to-sky-500"
          }`}
          style={{ width: `${Math.max(g.pct, 2)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {detail}{" "}
        <Link href="/profil" className="whitespace-nowrap text-emerald-700 hover:underline">
          Modifier
        </Link>
      </p>
    </section>
  );
}
