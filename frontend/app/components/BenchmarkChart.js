"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/api";
import { compareToBenchmark } from "@/lib/benchmark";
import { Delta } from "./ui";

const OPTIONS = [
  { key: "CAC40", label: "CAC 40" },
  { key: "SP500", label: "S&P 500" },
  { key: "MSCIWORLD", label: "MSCI World" },
];

const shortDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

/** Évolution du portefeuille comparée à un indice (base 100 au premier jour commun) */
export default function BenchmarkChart({ daily }) {
  const [key, setKey] = useState("CAC40");
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

  const cmp = useMemo(() => (bench ? compareToBenchmark(daily, bench.points) : null), [daily, bench]);
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

      {!daily || daily.length < 2 ? (
        <p className="text-sm text-ink-muted">
          La comparaison s&apos;affichera dès que deux jours d&apos;historique auront été enregistrés.
        </p>
      ) : status === "error" ? (
        <p className="text-sm text-ink-muted">Les données de l&apos;indice sont momentanément indisponibles.</p>
      ) : status === "loading" || !cmp ? (
        <div className="h-64 animate-pulse rounded-lg bg-surface-2" aria-label="Chargement" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-ink-muted">
              Portefeuille <Delta value={cmp.portfolioPct} className="ml-1" />
            </span>
            <span className="text-ink-muted">
              {label} <Delta value={cmp.indexPct} className="ml-1" />
            </span>
            <span className="text-ink-muted/70">depuis le {new Date(`${cmp.from}T12:00:00Z`).toLocaleDateString("fr-FR")}</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cmp.series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.25} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#8A9AA9" }} minTickGap={24} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#8A9AA9" }} width={48} />
                <Tooltip
                  labelFormatter={(d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR")}
                  formatter={(v, name) => [`${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="portfolio" name="Portefeuille" stroke="#059669" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="index" name={label} stroke="#64748b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
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
