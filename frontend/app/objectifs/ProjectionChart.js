"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { useDiscreet } from "@/lib/profile";
import { scenarioRates, scenarioSeries, chartHorizonYears, savingsNeededBy, defaultTargetYear, wealthGoalEta } from "@/lib/objectives";
import { Card } from "../components/ui";

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const money = (v, symbol) => `${nf0.format(Math.round(Number(v) || 0))} ${symbol}`;

// Couleurs des séries (DESIGN.md : accent, accent-2, puis slate)
const COLORS = {
  median: "rgb(var(--accent))",
  optimiste: "rgb(var(--accent-2))",
  prudent: "#64748b",
};

const inputClass =
  "w-28 rounded-xl border border-line bg-surface px-3 py-2 text-ink tabular-nums focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent";

/**
 * Courbe de projection du patrimoine (euros d'aujourd'hui) : scénarios prudent / médian / optimiste,
 * repère de l'objectif, et épargne mensuelle nécessaire pour l'atteindre une année donnée.
 */
export default function ProjectionChart({ current, goalAmount, monthlySavings, expectedReturn, inflationRate, goalDate, symbol }) {
  const [discreet] = useDiscreet();
  const now = useMemo(() => new Date(), []);
  const [targetYear, setTargetYear] = useState(() => defaultTargetYear(goalDate, now));

  const scenarios = scenarioRates(expectedReturn);
  const target = Number(goalAmount) > 0 ? Number(goalAmount) : null;
  const median = wealthGoalEta({ current, target: target || 0, monthlySavings, expectedReturn, inflationRate, now });
  const years = chartHorizonYears(median?.months);
  const data = useMemo(
    () => scenarioSeries({ current, monthlySavings, expectedReturn, inflationRate, years, now }),
    [current, monthlySavings, expectedReturn, inflationRate, years, now]
  );
  const last = data[data.length - 1];

  const needed = target ? savingsNeededBy({ current, target, targetYear, expectedReturn, inflationRate, now }) : null;
  const minYear = now.getFullYear() + 1;

  const summary =
    `Projection du patrimoine en euros d'aujourd'hui jusqu'en ${last.year}, avec ${money(monthlySavings, symbol)} investis par mois. ` +
    (discreet
      ? "Montants masqués (mode discret)."
      : scenarios.map((s) => `Scénario ${s.label.toLowerCase()} (${nf1.format(s.rate)} %/an) : ${money(last[s.key], symbol)}`).join(" ; ") +
        (target ? `. Objectif : ${money(target, symbol)}.` : "."));

  const axisTick = (v) => (discreet ? "" : compact.format(v));

  return (
    <Card as="section" aria-labelledby="projection-title" className="mt-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="projection-title" className="text-lg font-semibold text-ink">Projection de votre patrimoine</h2>
        <p className="text-sm text-ink-muted">
          Scénarios à {scenarios.map((s) => `${nf1.format(s.rate)}`).join(" / ")} %/an, inflation {nf1.format(Number(inflationRate) || 0)} % déduite
        </p>
      </div>

      <div className="h-72" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.25} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#8A9AA9" }} minTickGap={24} />
            <YAxis tickFormatter={axisTick} tick={{ fontSize: 11, fill: "#8A9AA9" }} width={discreet ? 8 : 52} domain={[0, "auto"]} />
            <Tooltip
              labelFormatter={(y) => `En ${y}`}
              formatter={(v, name) => [discreet ? "••••" : money(v, symbol), name]}
              contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, color: "rgb(var(--text))" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {target && (
              <ReferenceLine
                y={target}
                stroke="rgb(var(--warn))"
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
                label={{ value: discreet ? "Objectif" : `Objectif ${compact.format(target)} ${symbol}`, position: "insideTopLeft", fontSize: 11, fill: "rgb(var(--text-muted))" }}
              />
            )}
            <Line type="monotone" dataKey="optimiste" name={`Optimiste (${nf1.format(scenarios[2].rate)} %)`} stroke={COLORS.optimiste} strokeWidth={2} strokeDasharray="4 3" dot={false} />
            <Line type="monotone" dataKey="median" name={`Médian (${nf1.format(scenarios[1].rate)} %)`} stroke={COLORS.median} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="prudent" name={`Prudent (${nf1.format(scenarios[0].rate)} %)`} stroke={COLORS.prudent} strokeWidth={2} strokeDasharray="2 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {target && (
        <div className="mt-5 rounded-xl bg-surface-2 p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label htmlFor="targetYear" className="text-sm font-semibold text-ink">
              Combien épargner par mois pour atteindre <span className="money">{money(target, symbol)}</span> en
            </label>
            <input
              id="targetYear"
              type="number"
              inputMode="numeric"
              min={minYear}
              max={now.getFullYear() + 100}
              step="1"
              className={inputClass}
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <p className="mt-3 text-sm text-ink" aria-live="polite">
            {needed == null ? (
              <span className="text-ink-muted">Choisissez une année à partir de {minYear}.</span>
            ) : needed.monthly === 0 ? (
              <span className="text-gain">✓ Votre patrimoine actuel suffit, sans nouveau versement, au rendement médian.</span>
            ) : (
              <>
                <strong className="money text-xl tabular-nums text-accent">{money(Math.ceil(needed.monthly), symbol)}</strong> par mois pendant {nf0.format(needed.months)} mois,
                au rendement médian de {nf1.format(Number(expectedReturn) || 0)} %/an
                {Number(monthlySavings) > 0 && (
                  <span className="text-ink-muted"> (vous prévoyez <span className="money">{money(monthlySavings, symbol)}</span>)</span>
                )}
                .
              </>
            )}
          </p>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Simulation, pas une garantie : les marchés ne progressent pas en ligne droite et les rendements passés ne préjugent pas des rendements futurs.
        Montants en euros d&apos;aujourd&apos;hui.
      </p>
    </Card>
  );
}
