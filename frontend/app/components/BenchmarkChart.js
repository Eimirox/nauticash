"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/api";
import { compareToBenchmark, sliceDaily, gapPoints, BENCH_PERIODS } from "@/lib/benchmark";
import { Delta } from "./ui";
import { signedPct } from "@/lib/chartSummary";

const OPTIONS = [
  { key: "CAC40", label: "CAC 40" },
  { key: "SP500", label: "S&P 500" },
];

const shortDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

/** Évolution du portefeuille comparée à un indice (base 100 au premier jour commun) */
export default function BenchmarkChart({ daily }) {
  const [key, setKey] = useState("CAC40");
  const [period, setPeriod] = useState("all");
  const [bench, setBench] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!daily || daily.length < 2) return;
    let alive = true;
    setStatus("loading");
    apiFetch(`/api/market/benchmarks/${key}`)
      .then((d) => {
        if (!alive) return;
        setBench(d);
        setStatus("ok");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [key, daily]);

  const cmp = useMemo(() => (bench ? compareToBenchmark(sliceDaily(daily, period), bench.points) : null), [daily, bench, period]);
  const gap = gapPoints(cmp);
  const label = OPTIONS.find((o) => o.key === key)?.label;

  return (
    <section aria-labelledby="benchmark-title" className="mb-6 rounded-xl border border-line bg-surface p-6 shadow-lg">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="benchmark-title" className="text-lg font-bold text-ink">
          Comparaison à un indice
        </h2>
        <div role="group" aria-label="Indice de comparaison" className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={key === o.key}
              onClick={() => setKey(o.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                key === o.key ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label="Période de comparaison" className="-mt-2 mb-4 flex flex-wrap gap-1.5">
        {BENCH_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              period === p.key ? "border-accent bg-accent/10 text-accent" : "border-line text-ink-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!daily || daily.length < 2 ? (
        <p className="text-sm text-ink-muted">
          La comparaison s&apos;affichera dès que deux jours d&apos;historique auront été enregistrés.
        </p>
      ) : status === "error" ? (
        <p className="text-sm text-ink-muted">Les données de l&apos;indice sont momentanément indisponibles.</p>
      ) : status !== "loading" && !cmp ? (
        <p className="text-sm text-ink-muted">Pas assez de jours d&apos;historique sur cette période : choisissez une période plus large.</p>
      ) : status === "loading" || !cmp ? (
        <div className="h-64 animate-pulse rounded-lg bg-surface-2" role="status" aria-label="Chargement de la comparaison" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-ink-muted">
              Portefeuille <Delta value={cmp.portfolioPct} className="ml-1" />
            </span>
            <span className="text-ink-muted">
              {label} <Delta value={cmp.indexPct} className="ml-1" />
            </span>
            {gap != null && (
              <span className="font-medium text-ink">
                {gap >= 0 ? "Devant" : "Derrière"} l&apos;indice de {Math.abs(gap).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pt
                {Math.abs(gap) >= 2 ? "s" : ""}
              </span>
            )}
            <span className="text-ink-muted/70">depuis le {new Date(`${cmp.from}T12:00:00Z`).toLocaleDateString("fr-FR")}</span>
          </div>
          <div
            className="h-64"
            role="img"
            aria-label={`Courbes base 100 depuis le ${new Date(`${cmp.from}T12:00:00Z`).toLocaleDateString("fr-FR")} : portefeuille ${signedPct(cmp.portfolioPct)}, ${label} ${signedPct(cmp.indexPct)}. ${
              cmp.portfolioPct > cmp.indexPct ? "Le portefeuille fait mieux que l'indice." : cmp.portfolioPct < cmp.indexPct ? "L'indice fait mieux que le portefeuille." : "Performances égales."
            }`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cmp.series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} minTickGap={24} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} width={48} />
                <Tooltip
                  labelFormatter={(d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR")}
                  formatter={(v, name) => [`${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="portfolio" name="Portefeuille" stroke="rgb(var(--accent))" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="index" name={label} stroke="rgb(var(--chart-1))" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-ink-muted/70">
            Base 100 au premier jour commun. L&apos;indice est suivi dans sa devise ({bench.currency}), hors dividendes ; la
            courbe du portefeuille inclut vos achats et ventes.
            {bench.stale && " Données de l'indice non actualisées (service momentanément indisponible)."}
          </p>
        </>
      )}
    </section>
  );
}
