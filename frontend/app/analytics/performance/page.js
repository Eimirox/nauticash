"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PerformancePage() {
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch historique
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000"}/api/auth/login`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setHistory(data);
      } catch (err) {
        console.error("Erreur fetch history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

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
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const formatAmount = (value) => {
    if (value == null || isNaN(value)) return "N/A";
    return `${value >= 0 ? "+" : ""}${value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}€`;
  };

  const getColorClass = (value) => {
    if (value == null || isNaN(value)) return "text-slate-500";
    return value >= 0 ? "text-emerald-600" : "text-red-600";
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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-3 group transition-transform hover:scale-105"
            >
              <div className="relative">
                <img
                  src="/logo_nauticash.webp?v=3"
                  alt="Logo Nauticash"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-sm"
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 bg-clip-text text-transparent">
                  Nauticash
                </span>
                <p className="text-xs text-slate-500">Performance</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/analytics")}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg
                  className="w-4 h-4 sm:hidden"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span className="hidden sm:inline">← Analytics</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Analytics du Portefeuille
          </h1>
          <p className="text-slate-600">
            Visualisez la répartition et l'évolution de vos investissements
          </p>
        </div>

        {/* Tabs */}
        <nav className="mb-8 border-b border-slate-200">
          {[
            { key: "vue", label: "Vue d'ensemble", route: "/analytics" },
            { key: "performance", label: "Performance", route: "/analytics/performance" },
            { key: "dividendes", label: "Dividendes", route: "/analytics/dividendes" },
            { key: "geographie", label: "Géographie", route: "/analytics/geographie" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.route) {
                  router.push(tab.route);
                }
              }}
              disabled={!tab.route}
              className={`relative px-6 py-3 text-sm font-medium transition-all ${
                tab.key === "performance"
                  ? "text-emerald-600"
                  : tab.route 
                    ? "text-slate-600 hover:text-slate-900 cursor-pointer"
                    : "text-slate-400 cursor-not-allowed"
              }`}
            >
              {tab.label}
              {tab.key === "performance" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-600 to-blue-600" />
              )}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : !history || history.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg font-medium mb-2">Pas assez de données</p>
            <p className="text-sm mb-4">Il faut au moins 2 snapshots pour calculer la performance</p>
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
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase">Mois Actuel</h3>
                </div>
                {performanceData.currentMonthPerf ? (
                  <>
                    <p className={`text-3xl font-bold mb-1 ${getColorClass(performanceData.currentMonthPerf.perfPercent)}`}>
                      {formatPercent(performanceData.currentMonthPerf.perfPercent)}
                    </p>
                    <p className={`text-sm ${getColorClass(performanceData.currentMonthPerf.perfAmount)}`}>
                      {formatAmount(performanceData.currentMonthPerf.perfAmount)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-slate-400">N/A</p>
                )}
              </div>

              {/* Performance de l'année */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase">Année Actuelle</h3>
                </div>
                {performanceData.currentYearPerf ? (
                  <>
                    <p className={`text-3xl font-bold mb-1 ${getColorClass(performanceData.currentYearPerf.perfPercent)}`}>
                      {formatPercent(performanceData.currentYearPerf.perfPercent)}
                    </p>
                    <p className={`text-sm ${getColorClass(performanceData.currentYearPerf.perfAmount)}`}>
                      {formatAmount(performanceData.currentYearPerf.perfAmount)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-slate-400">N/A</p>
                )}
              </div>

              {/* Performance totale */}
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <h3 className="text-sm font-semibold text-emerald-700 uppercase">Total (Depuis début)</h3>
                </div>
                {performanceData.allTimePerf ? (
                  <>
                    <p className={`text-3xl font-bold mb-1 ${getColorClass(performanceData.allTimePerf.perfPercent)}`}>
                      {formatPercent(performanceData.allTimePerf.perfPercent)}
                    </p>
                    <p className={`text-sm ${getColorClass(performanceData.allTimePerf.perfAmount)}`}>
                      {formatAmount(performanceData.allTimePerf.perfAmount)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-slate-400">N/A</p>
                )}
              </div>
            </div>

            {/* Tableau Performance Mensuelle */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900">Performance Mensuelle</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Période</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Valeur Début</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Valeur Fin</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Performance</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.monthly.slice().reverse().map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">
                          {getMonthName(item.month)} {item.year}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-slate-600">
                          {item.previousValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-slate-600">
                          {item.value.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                        </td>
                        <td className={`text-right py-3 px-4 text-sm font-bold ${getColorClass(item.perfPercent)}`}>
                          {formatPercent(item.perfPercent)}
                        </td>
                        <td className={`text-right py-3 px-4 text-sm font-medium ${getColorClass(item.perfAmount)}`}>
                          {formatAmount(item.perfAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tableau Performance Annuelle */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900">Performance Annuelle</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Année</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Valeur Début</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Valeur Fin</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Performance</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Montant</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600">Mois</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.yearly.slice().reverse().map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">
                          {item.year}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-slate-600">
                          {item.startValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-slate-600">
                          {item.endValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                        </td>
                        <td className={`text-right py-3 px-4 text-lg font-bold ${getColorClass(item.perfPercent)}`}>
                          {formatPercent(item.perfPercent)}
                        </td>
                        <td className={`text-right py-3 px-4 text-sm font-medium ${getColorClass(item.perfAmount)}`}>
                          {formatAmount(item.perfAmount)}
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-slate-600">
                          {item.monthsCount}/12
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">📊 Calcul des performances</p>
                  <p className="text-blue-700">
                    Les performances sont calculées à partir de vos snapshots mensuels. Pour des données plus précises, 
                    pensez à sauvegarder un snapshot chaque mois dans l'onglet Analytics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}