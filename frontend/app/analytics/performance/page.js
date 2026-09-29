"use client";

import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import AppHeader from "../../components/AppHeader";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Delta } from "../../components/ui";
import { periodPerformance } from "@/lib/periodPerf";
import BenchmarkChart from "../../components/BenchmarkChart";
import { fetchFxRates, toEUR } from "@/lib/fx";

export default function PerformancePage() {
  const router = useRouter();
  const [loadError, setLoadError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState([]);
  const [sincePurchase, setSincePurchase] = useState(null);

  // Fetch historique
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const [data, dailyData] = await Promise.all([
          apiFetch("/api/user/history").then((d) => (Array.isArray(d) ? d : [])),
          apiFetch("/api/user/history/daily?days=400")
            .then((d) => (Array.isArray(d) ? d : []))
            .catch(() => []),
        ]);
        setHistory(data);
        setDaily(dailyData);
        loadSincePurchase();
      } catch (err) {
        console.error("Erreur fetch history:", err);
        setLoadError(`Impossible de charger l'historique : ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    // « Depuis l'achat » : plus-value latente des positions dont le PRU est renseigné, en euros
    const loadSincePurchase = async () => {
      try {
        const [portfolio, fx] = await Promise.all([apiFetch("/api/user/portfolio"), fetchFxRates()]);
        let cost = 0;
        let value = 0;
        for (const s of portfolio.stocks || []) {
          const qty = Number(s.quantity) || 0;
          if (!(s.pru > 0) || !qty) continue;
          const c = toEUR(s.pru * qty, s.currency, fx.rates);
          const v = toEUR((s.close || 0) * qty, s.currency, fx.rates);
          if (c === null || v === null) continue;
          cost += c;
          value += v;
        }
        setSincePurchase(cost > 0 ? { amount: value - cost, pct: ((value - cost) / cost) * 100 } : null);
      } catch {
        setSincePurchase(null);
      }
    };
    fetchHistory();
  }, []);

  const periods = useMemo(() => periodPerformance(daily), [daily]);
  const lastDaily = daily.length ? daily[daily.length - 1] : null;

  // Calculs optimisés avec useMemo
  const performanceData = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        monthly: [],
        yearly: [],
        currentMonthPerf: null,
        currentYearPerf: null,
        allTimePerf: null
      };
    }

    // Convertir mois anglais en numéro
    const MONTH_MAP = {
      "January": 1, "February": 2, "March": 3, "April": 4,
      "May": 5, "June": 6, "July": 7, "August": 8,
      "September": 9, "October": 10, "November": 11, "December": 12
    };

    const getMonthNumber = (month) => {
      if (typeof month === 'number') return month;
      const parsed = parseInt(month);
      if (!isNaN(parsed)) return parsed;
      return MONTH_MAP[month] || null;
    };

    // Trier l'historique par date
    const sortedHistory = [...history].sort((a, b) => {
      const dateA = new Date(a.year, getMonthNumber(a.month) - 1);
      const dateB = new Date(b.year, getMonthNumber(b.month) - 1);
      return dateA - dateB;
    });

    // Calcul des performances mensuelles
    const monthly = [];
    for (let i = 1; i < sortedHistory.length; i++) {
      const current = sortedHistory[i];
      const previous = sortedHistory[i - 1];
      
      const perfPercent = ((current.value - previous.value) / previous.value) * 100;
      const perfAmount = current.value - previous.value;
      
      monthly.push({
        year: current.year,
        month: current.month,
        monthNum: getMonthNumber(current.month),
        value: current.value,
        perfPercent: perfPercent,
        perfAmount: perfAmount,
        previousValue: previous.value
      });
    }

    // Calcul des performances annuelles
    const yearlyMap = {};
    sortedHistory.forEach(item => {
      const year = item.year;
      if (!yearlyMap[year]) {
        yearlyMap[year] = [];
      }
      yearlyMap[year].push({
        ...item,
        monthNum: getMonthNumber(item.month)
      });
    });

    const yearly = [];
    Object.keys(yearlyMap).sort().forEach((year, index, years) => {
      const yearData = yearlyMap[year].sort((a, b) => a.monthNum - b.monthNum);
      const endValue = yearData[yearData.length - 1].value;
      
      // Valeur de début = dernier mois de l'année précédente OU premier mois de cette année
      let startValue;
      if (index > 0) {
        const previousYear = years[index - 1];
        const previousYearData = yearlyMap[previousYear];
        startValue = previousYearData[previousYearData.length - 1].value;
      } else {
        startValue = yearData[0].value;
      }
      
      const perfPercent = ((endValue - startValue) / startValue) * 100;
      const perfAmount = endValue - startValue;
      
      yearly.push({
        year: parseInt(year),
        startValue,
        endValue,
        perfPercent,
        perfAmount,
        monthsCount: yearData.length
      });
    });

    // Performance mois actuel
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const currentMonthData = monthly.find(
      m => m.year === currentYear && m.monthNum === currentMonth
    );

    // Performance année actuelle
    const currentYearData = yearly.find(y => y.year === currentYear);

    // Performance totale (depuis le début)
    let allTimePerf = null;
    if (sortedHistory.length >= 2) {
      const first = sortedHistory[0].value;
      const last = sortedHistory[sortedHistory.length - 1].value;
      allTimePerf = {
        perfPercent: ((last - first) / first) * 100,
        perfAmount: last - first,
        startValue: first,
        endValue: last
      };
    }

    return {
      monthly,
      yearly,
      currentMonthPerf: currentMonthData,
      currentYearPerf: currentYearData,
      allTimePerf
    };
  }, [history]);

  const formatPercent = (value) => {
    if (value == null || isNaN(value)) return "N/A";
    return `${value >= 0 ? "+" : ""}${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
  };

  const formatAmount = (value) => {
    if (value == null || isNaN(value)) return "N/A";
    return `${value >= 0 ? "+" : ""}${value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} €`;
  };

  const formatValue = (value) =>
    `${Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const getColorClass = (value) => {
    if (value == null || isNaN(value)) return "text-ink-muted";
    return value >= 0 ? "text-accent" : "text-loss";
  };

  const getMonthName = (month) => {
    const monthNames = [
      "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
      "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
    ];
    if (typeof month === "string") {
      const MONTH_MAP = {
        "January": 0, "February": 1, "March": 2, "April": 3,
        "May": 4, "June": 5, "July": 6, "August": 7,
        "September": 8, "October": 9, "November": 10, "December": 11
      };
      return monthNames[MONTH_MAP[month]] || month;
    }
    return monthNames[month - 1] || month;
  };

  return (
    <main className="min-h-screen bg-bg">
      {loadError && (
        <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">
          {loadError}
        </div>
      )}
      {/* Header */}
      <AppHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-ink mb-2">
            Performance
          </h1>
          <p className="text-ink-muted">
            Évolution de la valeur de votre portefeuille dans le temps.
          </p>
        </div>


        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <>
          <section aria-labelledby="periods-title" className="mb-6 bg-surface border border-line rounded-xl shadow-lg p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="periods-title" className="text-lg font-bold text-ink">Performance par période</h2>
              {lastDaily && (
                <p className="text-xs text-ink-muted">
                  Valeur au {new Date(`${lastDaily.date}T12:00:00Z`).toLocaleDateString("fr-FR")} :{" "}
                  <span className="money font-semibold text-ink">{formatValue(lastDaily.value)}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {periods.map((p) => (
                <div key={p.key} className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{p.label}</p>
                  <Delta value={p.pct} className="text-lg" />
                  {p.amount != null && (
                    <p className={`money text-xs tabular-nums ${getColorClass(p.amount)}`}>{formatAmount(p.amount)}</p>
                  )}
                  {p.partial && p.from && (
                    <p className="mt-1 text-[11px] text-ink-muted/70">
                      depuis le {new Date(`${p.from}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </p>
                  )}
                </div>
              ))}
              <div className="rounded-lg border border-accent/40 bg-accent/10 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Depuis l&apos;achat</p>
                <Delta value={sincePurchase?.pct} className="text-lg" />
                {sincePurchase && (
                  <p className={`money text-xs tabular-nums ${getColorClass(sincePurchase.amount)}`}>{formatAmount(sincePurchase.amount)}</p>
                )}
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              {daily.length < 2
                ? "La valeur de votre portefeuille est enregistrée automatiquement chaque soir : les performances par période s'afficheront dès le deuxième jour."
                : "Variation de la valeur du portefeuille en euros (taux BCE), achats et ventes de la période inclus. « Depuis l'achat » compare la valeur actuelle à vos prix de revient (PRU)."}
            </p>
          </section>

          <BenchmarkChart daily={daily} />

          {!history || history.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-20 text-ink-muted">
            <svg className="w-16 h-16 mb-4 text-ink-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg font-medium mb-2">Relevé mensuel en cours de constitution</p>
            <p className="text-sm mb-4 text-center">Les performances mois par mois s&apos;afficheront à partir du deuxième mois enregistré.</p>
            <button
              onClick={() => router.push("/analytics")}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
            >
              Retour à Analytics
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Performance du mois */}
              <div className="bg-surface border border-line rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-ink-muted uppercase">Mois Actuel</h3>
                </div>
                {performanceData.currentMonthPerf ? (
                  <>
                    <p className={`text-3xl font-bold mb-1 ${getColorClass(performanceData.currentMonthPerf.perfPercent)}`}>
                      {formatPercent(performanceData.currentMonthPerf.perfPercent)}
                    </p>
                    <p className={`money text-sm ${getColorClass(performanceData.currentMonthPerf.perfAmount)}`}>
                      {formatAmount(performanceData.currentMonthPerf.perfAmount)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-ink-muted/70">N/A</p>
                )}
              </div>

              {/* Performance de l'année */}
              <div className="bg-surface border border-line rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-ink-muted uppercase">Année Actuelle</h3>
                </div>
                {performanceData.currentYearPerf ? (
                  <>
                    <p className={`text-3xl font-bold mb-1 ${getColorClass(performanceData.currentYearPerf.perfPercent)}`}>
                      {formatPercent(performanceData.currentYearPerf.perfPercent)}
                    </p>
                    <p className={`money text-sm ${getColorClass(performanceData.currentYearPerf.perfAmount)}`}>
                      {formatAmount(performanceData.currentYearPerf.perfAmount)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-ink-muted/70">N/A</p>
                )}
              </div>

              {/* Performance totale */}
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-accent/10 dark:to-accent-2/10 border border-accent/40 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <h3 className="text-sm font-semibold text-accent uppercase">Total (Depuis début)</h3>
                </div>
                {performanceData.allTimePerf ? (
                  <>
                    <p className={`text-3xl font-bold mb-1 ${getColorClass(performanceData.allTimePerf.perfPercent)}`}>
                      {formatPercent(performanceData.allTimePerf.perfPercent)}
                    </p>
                    <p className={`money text-sm ${getColorClass(performanceData.allTimePerf.perfAmount)}`}>
                      {formatAmount(performanceData.allTimePerf.perfAmount)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-ink-muted/70">N/A</p>
                )}
              </div>
            </div>

            {/* Tableau Performance Mensuelle */}
            <div className="bg-surface border border-line rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-lg font-bold text-ink">Performance Mensuelle</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">Performance mensuelle : valeur de début, valeur de fin, performance en pourcentage et montant.</caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-ink-muted">Période</th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-ink-muted">Valeur Début</th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-ink-muted">Valeur Fin</th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-ink-muted">Performance</th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-ink-muted">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.monthly.slice().reverse().map((item, idx) => (
                      <tr key={idx} className="border-b border-line hover:bg-surface-2 transition">
                        <td className="py-3 px-4 text-sm font-medium text-ink">
                          {getMonthName(item.month)} {item.year}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-ink-muted">
                          <span className="money">{item.previousValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-ink-muted">
                          <span className="money">{item.value.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                        </td>
                        <td className={`text-right py-3 px-4 text-sm font-bold ${getColorClass(item.perfPercent)}`}>
                          {formatPercent(item.perfPercent)}
                        </td>
                        <td className={`text-right py-3 px-4 text-sm font-medium ${getColorClass(item.perfAmount)}`}>
                          <span className="money">{formatAmount(item.perfAmount)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tableau Performance Annuelle */}
            <div className="bg-surface border border-line rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <h3 className="text-lg font-bold text-ink">Performance Annuelle</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">Performance annuelle : valeur de début, valeur de fin, performance en pourcentage et montant.</caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-ink-muted">Année</th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-ink-muted">Valeur Début</th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-ink-muted">Valeur Fin</th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-ink-muted">Performance</th>
                      <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-ink-muted">Montant</th>
                      <th scope="col" className="text-center py-3 px-4 text-sm font-semibold text-ink-muted">Mois</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.yearly.slice().reverse().map((item, idx) => (
                      <tr key={idx} className="border-b border-line hover:bg-surface-2 transition">
                        <td className="py-3 px-4 text-sm font-medium text-ink">
                          {item.year}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-ink-muted">
                          <span className="money">{item.startValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-ink-muted">
                          <span className="money">{item.endValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                        </td>
                        <td className={`text-right py-3 px-4 text-lg font-bold ${getColorClass(item.perfPercent)}`}>
                          {formatPercent(item.perfPercent)}
                        </td>
                        <td className={`text-right py-3 px-4 text-sm font-medium ${getColorClass(item.perfAmount)}`}>
                          <span className="money">{formatAmount(item.perfAmount)}</span>
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-ink-muted">
                          {item.monthsCount}/12
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-sky-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-900 dark:text-sky-200">
                  <p className="font-semibold mb-1">📊 Calcul des performances</p>
                  <p className="text-blue-700 dark:text-sky-200">
                    Les performances mensuelles sont calculées à partir du relevé de chaque mois, mis à jour
                    automatiquement chaque soir (une valeur saisie à la main reste prioritaire).
                  </p>
                </div>
              </div>
            </div>
          </div>
          )}
          </>
        )}
      </div>
    </main>
  );
}