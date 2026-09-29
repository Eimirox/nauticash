"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { feeAnalysis, ASSUMED_RETURN } from "@/lib/fees";

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Analyse des frais : frais annuels (TER) saisis par ETF / fonds, coût annuel,
 * impact projeté sur 10 et 20 ans. onFeesChange(ticker, fees) met à jour la page.
 */
export default function FeesCard({ positions, symbol = "€", onFeesChange }) {
  const [error, setError] = useState(null);
  const a = feeAnalysis(positions);
  if (!a.rows.length) return null;

  const save = async (ticker, raw) => {
    const text = String(raw).trim().replace(",", ".");
    const fees = text === "" ? null : Number(text);
    if (fees !== null && !(fees >= 0 && fees <= 10)) {
      setError("Les frais annuels doivent être compris entre 0 et 10 %.");
      return;
    }
    setError(null);
    const previous = positions.find((p) => p.ticker === ticker)?.fees ?? null;
    if (previous === fees) return;
    onFeesChange?.(ticker, fees);
    try {
      await apiFetch(`/api/user/portfolio/${encodeURIComponent(ticker)}`, { method: "PATCH", body: { fees } });
    } catch (err) {
      onFeesChange?.(ticker, previous);
      setError(`Frais non enregistrés : ${err.message}`);
    }
  };

  return (
    <section aria-labelledby="fees-title" className="mb-6 rounded-xl border border-line bg-surface p-6 shadow-lg">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fees-title" className="text-lg font-bold text-ink">
          Frais de vos ETF et fonds
        </h2>
        {a.weightedTer != null && (
          <p className="text-sm text-ink-muted">
            Frais moyens : <span className="font-semibold text-ink">{nf2.format(a.weightedTer)} %</span> par an
          </p>
        )}
      </div>

      {a.annualCost > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Coût annuel", a.annualCost],
            ["Manque à gagner sur 10 ans", a.impact10],
            ["Manque à gagner sur 20 ans", a.impact20],
          ].map(([label, v]) => (
            <div key={label} className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
              <p className="money text-xl font-bold text-ink tabular-nums">
                {nf0.format(v)} {symbol}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Frais annuels par ligne : valeur, pourcentage de frais et coût par an.</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
              <th scope="col" className="py-2 pr-4 font-semibold">Ligne</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Valeur</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Frais annuels (%)</th>
              <th scope="col" className="py-2 text-right font-semibold">Coût par an</th>
            </tr>
          </thead>
          <tbody>
            {a.rows.map((r) => (
              <tr key={r.ticker} className="border-b border-line last:border-0">
                <td className="py-2 pr-4">
                  <span className="font-semibold text-ink">{r.ticker}</span>
                  {r.name && r.name !== r.ticker && <span className="block max-w-[16rem] truncate text-xs text-ink-muted">{r.name}</span>}
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums">
                  <span className="money">{nf0.format(r.value)} {symbol}</span>
                </td>
                <td className="py-2 pr-4 text-right">
                  <input
                    key={`${r.ticker}-${r.fees}`}
                    type="text"
                    inputMode="decimal"
                    defaultValue={r.fees == null ? "" : String(r.fees).replace(".", ",")}
                    placeholder="ex. 0,20"
                    aria-label={`Frais annuels de ${r.ticker} en %`}
                    onBlur={(e) => save(r.ticker, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    className="w-24 rounded-lg border border-line px-2 py-1 text-right tabular-nums focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </td>
                <td className="whitespace-nowrap py-2 text-right tabular-nums text-ink">
                  {r.annualCost == null ? <span className="text-ink-muted/70">—</span> : <span className="money">{nf2.format(r.annualCost)} {symbol}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-loss">
          {error}
        </p>
      )}
      <p className="mt-3 text-[11px] text-ink-muted/70">
        Saisissez les frais courants (TER) indiqués dans le document d&apos;informations clés de chaque ETF ou fonds
        {a.missing > 0 && ` (${a.missing} ligne${a.missing > 1 ? "s" : ""} sans frais renseignés)`}. Manque à gagner calculé
        sur la valeur actuelle, sans nouveaux versements, avec un rendement hypothétique de {Math.round(ASSUMED_RETURN * 100)} % par an
        avant frais.
      </p>
    </section>
  );
}
