"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useFxRates } from "@/lib/fx";
import { calendarPerformance, monthEndValues, firstDailyMonth } from "@/lib/calendarPerf";
import { useToast } from "../components/ui";
import { usePersistedPreference, VIEW_PREF_CODECS } from "@/lib/viewPrefs";
import {
  ComposedChart,
  BarChart,
  Area,
  Bar,
  Cell,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { slotColor } from "@/lib/chartPalette";
import { trendSummary } from "@/lib/chartSummary";
import {
  evolutionRows,
  availableYears as yearsOf,
  lastSnapshot as latestSnapshot,
  direction,
  formatVariation,
  labelMode,
  monthWindow,
  valueDomain,
  pctDomain,
  axisTick,
} from "@/lib/portfolioEvolution";
import Skeleton, { SkeletonRegion } from "../components/ui/Skeleton";

// Couleur et sens d'une variation (la flèche et le signe portent aussi l'information, jamais la couleur seule)
const DIRECTION_COLOR = {
  up: "rgb(var(--gain))",
  down: "rgb(var(--loss))",
  flat: "rgb(var(--text-muted))",
  none: "rgb(var(--text-muted))",
};

// Une couleur de la palette par année (la plus récente en premier), jamais de couleur en dur (DESIGN.md)
const YEAR_SLOTS = ["blue", "emerald", "amber", "violet", "cyan", "rose"];
const AXIS_TICK = { fill: "rgb(var(--text-muted))", fontSize: 12 };
const GRID_STROKE = "rgb(var(--border))";

// Étiquette de variation au-dessus d'un point de la courbe (une seule année affichée)
function makePointLabel(year, rows, mode) {
  return function PointLabel({ x, y, index }) {
    const row = rows[index];
    if (mode === "none" || !row || row[`year${year}`] == null) return null;
    const pct = row[`pct${year}`];
    if (pct == null) return null; // premier mois : rien à comparer
    return (
      <text
        x={Number(x)}
        y={Number(y) - 14}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        style={{ fill: DIRECTION_COLOR[direction(pct)] }}
        className="tabular-nums"
      >
        {formatVariation(pct, { short: mode === "short" })}
      </text>
    );
  };
}

// Étiquette au-dessus d'une barre positive, sous une barre négative (graphique des variations)
function makeBarLabel(year, rows, mode) {
  return function BarLabel({ x, y, width, height, index }) {
    const row = rows[index];
    const pct = row?.[`pct${year}`];
    if (mode === "none" || pct == null) return null;
    const top = Math.min(Number(y), Number(y) + Number(height));
    const bottom = Math.max(Number(y), Number(y) + Number(height));
    return (
      <text
        x={Number(x) + Number(width) / 2}
        y={pct >= 0 ? top - 5 : bottom + 13}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        style={{ fill: DIRECTION_COLOR[direction(pct)] }}
        className="tabular-nums"
      >
        {formatVariation(pct, { short: mode === "short" })}
      </text>
    );
  };
}

export default function PortfolioHistoryChart() {
  const toast = useToast();
  // Relevé mensuel brut et historique quotidien : les valeurs de fin de mois en sont déduites (voir lib/calendarPerf.js)
  const [rawHistory, setRawHistory] = useState([]);
  const [daily, setDaily] = useState([]);
  // Années comparées : choix mémorisé dans le compte ; sans choix, les deux années les plus récentes
  const [pickedYears, setPickedYears, yearsPref] = usePersistedPreference(VIEW_PREF_CODECS.historyYears);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false); // premier chargement terminé
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [manualForm, setManualForm] = useState({ date: "", value: "" });

  // Largeur du graphique : décide de la taille des étiquettes (arrow + signe, signe seul, aucune)
  const chartRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetched]);

  // Taux BCE servis par le backend (toutes devises)
  const { stale: fxStale } = useFxRates();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const [data, dailyData] = await Promise.all([
        apiFetch("/api/user/history").then((d) => (Array.isArray(d) ? d : [])),
        apiFetch("/api/user/history/daily?days=3660")
          .then((d) => (Array.isArray(d) ? d : []))
          .catch(() => []),
      ]);
      setRawHistory(data);
      setDaily(dailyData);
    } catch (err) {
      console.error("❌ Erreur:", err);
    } finally {
      setFetched(true);
    }
  };

  // Mêmes valeurs de fin de mois et même performance mensuelle que la page Performance
  const history = useMemo(() => monthEndValues(daily, rawHistory), [daily, rawHistory]);
  const perfByKey = useMemo(
    () => new Map(calendarPerformance(daily, rawHistory).monthly.map((m) => [m.key, m])),
    [daily, rawHistory]
  );
  const availableYears = useMemo(() => yearsOf(history), [history]);
  const lastSnapshot = useMemo(() => latestSnapshot(history, perfByKey), [history, perfByKey]);
  // Saisie manuelle : uniquement les mois d'avant le suivi quotidien (ensuite, la valeur est automatique)
  const trackedFrom = useMemo(() => firstDailyMonth(daily), [daily]);
  const manualMax = useMemo(() => {
    if (!trackedFrom) return undefined;
    const [y, m] = trackedFrom.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  }, [trackedFrom]);

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

  // Années affichées : le choix enregistré (limité aux années qui ont des relevés), sinon les deux plus récentes
  const selectedYears = (pickedYears ?? availableYears.slice(0, 2)).filter((y) => availableYears.includes(y));

  const toggleYear = (year) => {
    setPickedYears(selectedYears.includes(year) ? selectedYears.filter((y) => y !== year) : [...selectedYears, year]);
  };

  const colorOfYear = (year) => slotColor(YEAR_SLOTS[Math.max(0, availableYears.indexOf(year)) % YEAR_SLOTS.length]);

  // Mois affichés : du premier au dernier relevé (6 mois au minimum), les mois vides autour sont masqués
  const allRows = evolutionRows(history, selectedYears, perfByKey);
  const win = monthWindow(allRows, selectedYears);
  const chartData = allRows.slice(win.start - 1, win.end);

  // Axe vertical ajusté aux valeurs (il ne part pas de 0) et axe des variations symétrique autour de 0
  const vDomain = valueDomain(chartData.flatMap((row) => selectedYears.map((y) => row[`year${y}`])));
  const pDomain = pctDomain(chartData, selectedYears);

  // Étiquettes seulement avec une année affichée (plusieurs années : le survol donne le détail)
  const singleYear = selectedYears.length === 1;
  const mode = singleYear ? labelMode(chartWidth / Math.max(1, chartData.length)) : "none";

  const euro = (v) =>
    `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  // Survol commun aux deux graphiques : valeur, variation en % et écart en € pour chaque année
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0]?.payload || {};
    const discreet = typeof document !== "undefined" && document.documentElement.classList.contains("discreet");
    const years = selectedYears.filter((y) => row[`year${y}`] != null);
    if (!years.length) return null;
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-white shadow-xl">
        <p className="mb-2 font-semibold">{label}</p>
        {years.map((year) => {
          const pct = row[`pct${year}`];
          const delta = row[`delta${year}`];
          const flows = row[`flows${year}`];
          const approx = row[`approx${year}`];
          const dir = direction(pct);
          return (
            <div key={year} className="mb-1 text-sm last:mb-0">
              <p>
                <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: colorOfYear(year) }} />
                {year} : {discreet ? "••••" : euro(row[`year${year}`])}
              </p>
              <p className="tabular-nums text-xs text-slate-300">
                {approx ? "Variation (apports inclus) :" : "Performance (hors apports) :"}{" "}
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
              {!discreet && flows != null && Math.abs(flows) >= 0.01 && (
                <p className="tabular-nums text-xs text-slate-300">
                  Apports / retraits : {flows > 0 ? "+" : "−"}
                  {euro(Math.abs(flows))}
                </p>
              )}
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
                  ? { borderColor: colorOfYear(year) }
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
        </div>
      </div>

      {/* Info taux */}
      <div className="mb-4 px-3 py-2 bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/30 rounded-lg text-xs text-blue-700 dark:text-sky-200">
        Taux de change BCE (toutes devises){fxStale ? " : approximatifs, service indisponible" : ""}
      </div>

      {/* Édition manuelle */}
      {showManualEdit && (
        <div id="manual-snapshot" className="mb-6 p-4 bg-surface-2 border border-line rounded-lg">
          <h4 id="manual-snapshot-title" className="text-sm font-semibold text-ink mb-1">
            Ajouter/Modifier un mois passé
          </h4>
          <p className="mb-3 text-xs text-ink-muted">
            {manualMax
              ? `Pour les mois d'avant le suivi automatique (jusqu'à ${new Date(`${manualMax}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}). Ensuite, la valeur de fin de mois est enregistrée automatiquement chaque soir.`
              : "La valeur de votre portefeuille est ensuite enregistrée automatiquement chaque soir."}
          </p>
          <form onSubmit={saveManualSnapshot} aria-labelledby="manual-snapshot-title" className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="manual-date" className="block text-xs font-medium text-ink mb-1">
                Mois
              </label>
              <input
                id="manual-date"
                type="month"
                max={manualMax}
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
              Fin de mois la plus récente :{" "}
              {new Date(lastSnapshot.year, lastSnapshot.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {lastSnapshot.pct != null && (
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: DIRECTION_COLOR[direction(lastSnapshot.pct)] }}
                title={lastSnapshot.approx ? "Variation de valeur, apports inclus" : "Performance des cours, hors apports et retraits"}
              >
                {formatVariation(lastSnapshot.pct)}{" "}
                <span className="font-normal text-ink-muted">{lastSnapshot.approx ? "sur le mois (apports inclus)" : "sur le mois (hors apports)"}</span>
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
              ? "La valeur de votre portefeuille est enregistrée automatiquement chaque soir"
              : "Cliquez sur une année ci-dessus"}
          </p>
        </div>
      ) : (
        <div ref={chartRef}>
          <div
            className="money-chart"
            role="img"
            aria-label={`Courbe de la valeur du portefeuille en fin de mois, avec la performance mensuelle hors apports. ${selectedYears
              .map((year) => {
                const last = [...chartData].reverse().find((m) => m[`pct${year}`] != null);
                const tail = last ? `, dernière variation en ${last.month} : ${formatVariation(last[`pct${year}`])}` : "";
                return `${year} : ${trendSummary(chartData.map((m) => ({ label: m.month, value: m[`year${year}`] })), formatEuro)}${tail}`;
              })
              .join(". ")}.`}
          >
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  {selectedYears.map((year) => (
                    <linearGradient key={year} id={`evo-fill-${year}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: colorOfYear(year), stopOpacity: 0.35 }} />
                      <stop offset="100%" style={{ stopColor: colorOfYear(year), stopOpacity: 0.03 }} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="month" padding={{ left: 18, right: 34 }} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                <YAxis
                  domain={vDomain.domain}
                  ticks={vDomain.ticks}
                  tickFormatter={axisTick}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: GRID_STROKE, strokeWidth: 1 }} />
                {selectedYears.length > 1 && <Legend wrapperStyle={{ paddingTop: "8px" }} />}
                {selectedYears.map((year) => (
                  <Area
                    key={year}
                    dataKey={`year${year}`}
                    name={`${year}`}
                    type="monotone"
                    stroke={colorOfYear(year)}
                    strokeWidth={2.5}
                    fill={`url(#evo-fill-${year})`}
                    baseValue={vDomain.domain[0]}
                    connectNulls
                    dot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--surface))", fill: colorOfYear(year) }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "rgb(var(--surface))" }}
                    isAnimationActive={false}
                  >
                    {singleYear && <LabelList dataKey={`year${year}`} content={makePointLabel(year, chartData, mode)} />}
                  </Area>
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Échelle verticale ajustée aux valeurs (elle ne part pas de 0).</p>

          {/* Performance mensuelle (comme la page Performance) : hausses vers le haut (vert), baisses vers le bas (rouge) */}
          <h4 className="mb-1 mt-5 text-sm font-semibold text-ink">Performance mensuelle (hors apports)</h4>
          <div
            role="img"
            aria-label={`Performance mensuelle en pourcentage, hors apports et retraits. ${selectedYears
              .map((year) => {
                const parts = chartData.filter((m) => m[`pct${year}`] != null).map((m) => `${m.month} ${formatVariation(m[`pct${year}`])}`);
                return `${year} : ${parts.length ? parts.join(", ") : "aucune variation calculable"}`;
              })
              .join(". ")}.`}
          >
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={chartData} margin={{ top: 22, right: 12, left: 0, bottom: 4 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="month" padding={{ left: 6, right: 6 }} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis
                  domain={pDomain}
                  tickCount={3}
                  tickFormatter={(v) => (v === 0 ? "0 %" : `${v > 0 ? "+" : "−"}${Math.abs(v)} %`)}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <ReferenceLine y={0} stroke="rgb(var(--text-muted))" strokeOpacity={0.6} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: GRID_STROKE, fillOpacity: 0.35 }} />
                {selectedYears.map((year) => (
                  <Bar
                    key={year}
                    dataKey={`pct${year}`}
                    name={`${year}`}
                    fill={colorOfYear(year)}
                    radius={3}
                    maxBarSize={56}
                    isAnimationActive={false}
                  >
                    {singleYear &&
                      chartData.map((row, i) => <Cell key={i} fill={DIRECTION_COLOR[direction(row[`pct${year}`])]} />)}
                    {singleYear && <LabelList dataKey={`pct${year}`} content={makeBarLabel(year, chartData, mode)} />}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
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
            <p className="font-semibold mb-1">💡 Comment lire ce graphique</p>
            <p className="text-blue-700 dark:text-sky-200">
              La courbe montre la valeur totale en fin de mois (lignes + cash, en euros au taux BCE), enregistrée
              automatiquement chaque soir. Les pourcentages sont la performance des cours hors apports et retraits,
              identique à la page Performance ; un versement fait monter la courbe sans compter comme un gain. Les mois
              d&apos;avant le suivi automatique (« apports inclus ») reprennent la simple variation de valeur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
