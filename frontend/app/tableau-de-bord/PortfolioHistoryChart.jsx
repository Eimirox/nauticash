"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useFxRates, toEUR, fetchFxRates } from "@/lib/fx";
import { useToast } from "../components/ui";
import { usePersistedPreference, VIEW_PREF_CODECS } from "@/lib/viewPrefs";
import {
  ComposedChart,
  Bar,
  Line,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { trendSummary } from "@/lib/chartSummary";
import {
  evolutionRows,
  availableYears as yearsOf,
  lastSnapshot as latestSnapshot,
  direction,
  formatVariation,
} from "@/lib/portfolioEvolution";
import Skeleton, { SkeletonRegion } from "../components/ui/Skeleton";

// Couleur et sens d'une variation (la flèche et le signe portent aussi l'information, jamais la couleur seule)
const DIRECTION_COLOR = {
  up: "rgb(var(--gain))",
  down: "rgb(var(--loss))",
  flat: "rgb(var(--text-muted))",
  none: "rgb(var(--text-muted))",
};

// Étiquette « ▲ +3,2 % » au-dessus d'une barre, couchée à la verticale pour ne jamais chevaucher la barre voisine
function makePctLabel(year, rows) {
  return function PctLabel({ x, y, width, index }) {
    const row = rows[index];
    if (!row || row[`year${year}`] == null) return null; // mois sans relevé : ni barre ni %
    const pct = row[`pct${year}`];
    const cx = Number(x) + Number(width) / 2;
    return (
      <text
        x={cx}
        y={Number(y) - 6}
        transform={`rotate(-90 ${cx} ${Number(y) - 6})`}
        textAnchor="start"
        fontSize={11}
        fontWeight={600}
        style={{ fill: DIRECTION_COLOR[direction(pct)] }}
        className="tabular-nums"
      >
        {formatVariation(pct)}
      </text>
    );
  };
}

export default function PortfolioHistoryChart() {
  const toast = useToast();
  const [history, setHistory] = useState([]);
  // Années comparées : choix mémorisé dans le compte ; sans choix, les deux années les plus récentes
  const [pickedYears, setPickedYears, yearsPref] = usePersistedPreference(VIEW_PREF_CODECS.historyYears);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false); // premier chargement terminé
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [manualForm, setManualForm] = useState({ date: "", value: "" });

  const yearColors = {
    2023: "#6B7280",
    2024: "#3B82F6",
    2025: "#10B981",
    2026: "#F59E0B",
    2027: "#8B5CF6",
    2028: "#EC4899",
  };

  // Taux BCE servis par le backend (toutes devises)
  const { stale: fxStale } = useFxRates();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await apiFetch("/api/user/history").then((d) => (Array.isArray(d) ? d : []));

      setHistory(data);

      // Années disponibles : seuls les relevés valides (valeur > 0) comptent
      const years = yearsOf(data);
      setAvailableYears(years);

      // Dernier relevé valide (jamais un mois créé à 0 €)
      setLastSnapshot(latestSnapshot(data));
    } catch (err) {
      console.error("❌ Erreur:", err);
    } finally {
      setFetched(true);
    }
  };

  const saveManualSnapshot = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const [year, month] = manualForm.date.split("-");
      const value = parseFloat(manualForm.value);

      if (isNaN(value) || !year || !month) {
        toast.error("Valeur ou date invalide.");
        return;
      }

      await apiFetch("/api/user/history", {
        method: "POST",
        body: { date: manualForm.date, value },
      });

      await fetchHistory();
      setManualForm({ date: "", value: "" });
      setShowManualEdit(false);
      toast.success(`Valeur enregistrée : ${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
    } catch (err) {
      console.error(err);
      toast.error(`Enregistrement impossible : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveSnapshot = async () => {
    try {
      setLoading(true);
      const [portfolioData, fxData] = await Promise.all([apiFetch("/api/user/portfolio"), fetchFxRates()]);

      // Conversion stricte : une devise inconnue ferait enregistrer une valeur fausse
      const unknown = new Set();
      const inEUR = (value, currency) => {
        const v = toEUR(value, currency || "EUR", fxData.rates);
        if (v === null) unknown.add(currency);
        return v ?? 0;
      };

      let totalValueEUR = 0;

      (portfolioData.stocks || []).forEach((stock) => {
        const value = (stock.close || 0) * (stock.quantity || 0);
        totalValueEUR += inEUR(value, stock.currency);
      });

      const cashValue = portfolioData.cash?.amount || 0;
      totalValueEUR += inEUR(cashValue, portfolioData.cash?.currency);

      if (unknown.size) throw new Error(`taux de change indisponible pour ${[...unknown].join(", ")}`);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");

      await apiFetch("/api/user/history", {
        method: "POST",
        body: { date: `${year}-${month}`, value: totalValueEUR },
      });

      await fetchHistory();
      toast.success(`Photo du patrimoine enregistrée : ${totalValueEUR.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
    } catch (err) {
      console.error(err);
      toast.error(`Enregistrement impossible : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Années affichées : le choix enregistré (limité aux années qui ont des relevés), sinon les deux plus récentes
  const selectedYears = (pickedYears ?? availableYears.slice(0, 2)).filter((y) => availableYears.includes(y));

  const toggleYear = (year) => {
    setPickedYears(selectedYears.includes(year) ? selectedYears.filter((y) => y !== year) : [...selectedYears, year]);
  };

  // 12 mois fixes : valeur, % et écart vs mois N-1 pour chaque année sélectionnée
  const chartData = evolutionRows(history, selectedYears);

  // Marge en haut du graphique pour les étiquettes de variation
  const yMax = Math.max(0, ...chartData.flatMap((row) => selectedYears.map((y) => row[`year${y}`] || 0)));
  const yDomain = [0, Math.ceil((yMax || 1) * 1.28)];

  const euro = (v) =>
    `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0]?.payload || {};
    const discreet = typeof document !== "undefined" && document.documentElement.classList.contains("discreet");
    // Une seule ligne par année (la barre et l'escalier partagent la même valeur)
    const years = [...new Set(payload.filter((e) => e.value != null).map((e) => String(e.dataKey).replace("year", "")))];
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-white shadow-xl">
        <p className="mb-2 font-semibold">{label}</p>
        {years.map((year) => {
          const entry = payload.find((e) => e.dataKey === `year${year}`);
          const pct = row[`pct${year}`];
          const delta = row[`delta${year}`];
          const dir = direction(pct);
          return (
            <div key={year} className="mb-1 text-sm last:mb-0">
              <p style={{ color: entry?.color }}>
                {year} : {discreet ? "••••" : euro(row[`year${year}`])}
              </p>
              <p className="tabular-nums text-xs text-slate-300">
                vs mois précédent :{" "}
                <span className="font-semibold" style={{ color: dir === "up" ? "#4ADE80" : dir === "down" ? "#F87171" : "#CBD5E1" }}>
                  {formatVariation(pct)}
                </span>
                {!discreet && delta != null && (
                  <span>
                    {" "}
                    ({delta > 0 ? "+" : delta < 0 ? "−" : ""}
                    {euro(Math.abs(delta))})
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  const hasData = history.length > 0 && selectedYears.length > 0;
  const formatEuro = (v) => `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">
            Comparer :
          </span>
          {availableYears.map((year) => (
            <button
              key={year}
              type="button"
              aria-pressed={selectedYears.includes(year)}
              onClick={() => toggleYear(year)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-all ${
                selectedYears.includes(year)
                  ? "bg-accent/10 border-accent text-accent"
                  : "bg-surface border-line text-ink-muted hover:border-line"
              }`}
              style={
                selectedYears.includes(year)
                  ? { borderColor: yearColors[year] || "#10B981" }
                  : {}
              }
            >
              {year}
            </button>
          ))}
          {fetched && availableYears.length === 0 && (
            <span className="text-sm text-ink-muted italic">Aucune donnée</span>
          )}
          {yearsPref.customized && (
            <button
              type="button"
              onClick={yearsPref.reset}
              className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted underline-offset-2 hover:text-accent hover:underline"
            >
              Réinitialiser l&apos;affichage
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualEdit(!showManualEdit)}
            aria-expanded={showManualEdit}
            aria-controls="manual-snapshot"
            className="px-4 py-2 bg-surface border-2 border-line text-ink text-sm font-medium rounded-lg hover:bg-surface-2 transition-all flex items-center gap-2"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Éditer
          </button>
          <button
            onClick={saveSnapshot}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-emerald-700 to-blue-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Sauvegarde...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Snapshot auto
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info taux */}
      <div className="mb-4 px-3 py-2 bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/30 rounded-lg text-xs text-blue-700 dark:text-sky-200">
        Taux de change BCE (toutes devises){fxStale ? " : approximatifs, service indisponible" : ""}
      </div>

      {/* Édition manuelle */}
      {showManualEdit && (
        <div id="manual-snapshot" className="mb-6 p-4 bg-surface-2 border border-line rounded-lg">
          <h4 id="manual-snapshot-title" className="text-sm font-semibold text-ink mb-3">
            Ajouter/Modifier
          </h4>
          <form onSubmit={saveManualSnapshot} aria-labelledby="manual-snapshot-title" className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="manual-date" className="block text-xs font-medium text-ink mb-1">
                Mois
              </label>
              <input
                id="manual-date"
                type="month"
                value={manualForm.date}
                onChange={(e) =>
                  setManualForm({ ...manualForm, date: e.target.value })
                }
                required
                className="px-3 py-2 border border-line rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="manual-value" className="block text-xs font-medium text-ink mb-1">
                Valeur (€)
              </label>
              <input
                id="manual-value"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={manualForm.value}
                onChange={(e) =>
                  setManualForm({ ...manualForm, value: e.target.value })
                }
                required
                placeholder="15000.00"
                className="px-3 py-2 border border-line rounded-lg text-sm w-32"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="px-4 py-2 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition"
              >
                Sauvegarder
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowManualEdit(false);
                  setManualForm({ date: "", value: "" });
                }}
                className="px-4 py-2 bg-surface-2 text-ink text-sm font-medium rounded-lg hover:bg-line transition"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dernier relevé valide */}
      {lastSnapshot && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 p-3 text-sm">
          <div className="flex items-center gap-2 text-ink-muted">
            <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              Dernier relevé :{" "}
              {new Date(lastSnapshot.year, lastSnapshot.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {lastSnapshot.pct != null && (
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: DIRECTION_COLOR[direction(lastSnapshot.pct)] }}
                title="Évolution par rapport au mois précédent"
              >
                {formatVariation(lastSnapshot.pct)} <span className="font-normal text-ink-muted">vs mois précédent</span>
              </span>
            )}
            <span className="money font-semibold tabular-nums text-ink">{euro(lastSnapshot.value)}</span>
          </div>
        </div>
      )}

      {/* Chart */}
      {!fetched ? (
        <SkeletonRegion label="Chargement de l'historique…">
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </SkeletonRegion>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-16 text-ink-muted">
          <svg
            className="w-16 h-16 mb-4 text-ink-muted/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-lg font-medium mb-1">
            {history.length === 0
              ? "Aucune donnée"
              : "Sélectionnez une année"}
          </p>
          <p className="text-sm mb-4">
            {history.length === 0
              ? "Créez votre premier snapshot"
              : "Cliquez sur une année ci-dessus"}
          </p>
        </div>
      ) : (
        <div
          className="money-chart"
          role="img"
          aria-label={`Histogramme de la valeur du portefeuille par mois, avec une courbe en escalier et l'évolution en pourcentage par rapport au mois précédent. ${selectedYears
            .map((year) => {
              const last = [...chartData].reverse().find((m) => m[`pct${year}`] != null);
              const tail = last ? `, dernière variation en ${last.month} : ${formatVariation(last[`pct${year}`])}` : "";
              return `${year} : ${trendSummary(chartData.map((m) => ({ label: m.month, value: m[`year${year}`] })), formatEuro)}${tail}`;
            })
            .join(". ")}.`}
        >
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.25} />
            <XAxis
              dataKey="month"
              tick={{ fill: "#8A9AA9", fontSize: 12 }}
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              tick={{ fill: "#8A9AA9", fontSize: 12 }}
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
                if (value >= 1000) return `${Math.round(value / 1000)} k`;
                return `${value}`;
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              formatter={(value) => value.replace("year", "")}
            />
            {selectedYears.map((year) => (
              <Bar
                key={year}
                dataKey={`year${year}`}
                name={`${year}`}
                fill={yearColors[year] || "#9CA3AF"}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                <LabelList dataKey={`pct${year}`} content={makePctLabel(year, chartData)} />
              </Bar>
            ))}
            {/* Escalier : relie les valeurs mois après mois (un palier par mois, sans pente trompeuse) */}
            {selectedYears.map((year) => (
              <Line
                key={`step-${year}`}
                dataKey={`year${year}`}
                name={`${year} (escalier)`}
                type="stepAfter"
                stroke={yearColors[year] || "#9CA3AF"}
                strokeWidth={2}
                strokeOpacity={0.9}
                dot={{ r: 3, strokeWidth: 0, fill: yearColors[year] || "#9CA3AF" }}
                activeDot={false}
                connectNulls
                legendType="none"
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      )}

      {/* Astuce */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 text-blue-600 dark:text-sky-300 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-blue-900 dark:text-sky-200">
            <p className="font-semibold mb-1">💡 Snapshot mensuel</p>
            <p className="text-blue-700 dark:text-sky-200">
              Le "Snapshot auto" calcule la valeur totale (stocks + cash) et
              convertit toutes les devises en euros (taux de référence BCE).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
