"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pie } from "react-chartjs-2";
import Chart from "chart.js/auto";
import { formatCurrencySymbol } from "../portfolio/utils/formats";
import PortfolioHistoryChart from "./PortfolioHistoryChart";

// COULEURS SECTORIELLES FIXES - Optimisées pour contraste maximum
const SECTOR_COLORS = {
  // Technologie = VERT
  "Technology": "#10B981",           // Vert emerald
  "Communication Services": "#8B5CF6", // Violet (pas teal, trop proche vert)
  "Information Technology": "#10B981",
  
  // Crypto = OR
  "Cryptocurrency": "#F59E0B",       // Or/Amber
  "Crypto": "#F59E0B",
  
  // Finance = INDIGO (pas bleu comme santé)
  "Financial Services": "#4F46E5",   // Indigo
  "Financial": "#4F46E5",
  "Financials": "#4F46E5",
  "Banks": "#6366F1",                // Indigo clair
  "Insurance": "#818CF8",            // Indigo très clair
  
  // Santé = BLEU
  "Healthcare": "#3B82F6",           // Bleu
  "Health Care": "#3B82F6",
  "Biotechnology": "#60A5FA",        // Bleu clair
  
  // Énergie = JAUNE
  "Energy": "#EAB308",               // Jaune
  "Oil & Gas": "#FBBF24",            // Jaune clair
  
  // Consommation = ORANGE
  "Consumer Cyclical": "#F97316",    // Orange
  "Consumer Defensive": "#FB923C",   // Orange clair
  "Consumer Discretionary": "#F97316",
  "Consumer Staples": "#FB923C",
  
  // Industrie = GRIS
  "Industrials": "#6B7280",          // Gris
  "Industrial": "#6B7280",
  "Basic Materials": "#78716C",      // Gris-brun
  "Materials": "#78716C",
  
  // Utilities = CYAN
  "Utilities": "#06B6D4",            // Cyan
  
  // Immobilier = ROSE/MAGENTA
  "Real Estate": "#EC4899",          // Rose vif
  
  // Cash & Dette
  "Cash": "#22C55E",                 // Vert clair (différent de tech)
  "Dette": "#EF4444",                // Rouge
  
  // Défaut
  "Unknown": "#9CA3AF",              // Gris
  "Other": "#9CA3AF",
};

export default function Analytics() {
  const router = useRouter();
  const [stocks, setStocks] = useState([]);
  const [cash, setCash] = useState({ amount: 0, currency: "EUR" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vue");
  const [usdToEur, setUsdToEur] = useState(0.92); // Taux de change

  // Fetch taux de change USD->EUR
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        const data = await res.json();
        setUsdToEur(data.rates.EUR || 0.92);
        console.log("💱 Taux USD->EUR:", data.rates.EUR);
      } catch (err) {
        console.log("Taux de change par défaut utilisé");
      }
    };
    fetchExchangeRate();
  }, []);

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000"}/api/auth/login`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setStocks(data.stocks || []);
        setCash(data.cash || { amount: 0, currency: "EUR" });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  // Totaux par devise ORIGINALE (pour le pie chart)
  const portfolioTotalsByCurrency = stocks.reduce((acc, s) => {
    const val = (s.close || 0) * (s.quantity || 0);
    if (!s.currency) return acc;
    acc[s.currency] = (acc[s.currency] || 0) + val;
    return acc;
  }, {});

  // Total CONVERTI en EUR (pour KPI)
  const totalInEUR = stocks.reduce((sum, s) => {
    const val = (s.close || 0) * (s.quantity || 0);
    if (!s.currency) return sum;
    const valEUR = s.currency === "USD" ? val * usdToEur : val;
    return sum + valEUR;
  }, 0);

  // Totaux par secteur EN EUR
  const totalsPerSector = stocks.reduce((acc, s) => {
    const val = (s.close || 0) * (s.quantity || 0);
    const valEUR = s.currency === "USD" ? val * usdToEur : val;

    if (s.composition && typeof s.composition === "object") {
      // ETF avec composition { secteur: %, ... }
      Object.entries(s.composition).forEach(([sect, pct]) => {
        acc[sect] = (acc[sect] || 0) + (valEUR * pct) / 100;
      });
    } else {
      const sect = s.sector || "Unknown";
      acc[sect] = (acc[sect] || 0) + valEUR;
    }
    return acc;
  }, {});

  // Ajout du cash comme secteur (converti en EUR si USD)
  if (!isNaN(cash?.amount) && cash?.currency && Math.abs(cash.amount) > 0) {
    const sectorName = cash.amount < 0 ? "Dette" : "Cash";
    const cashEUR = cash.currency === "USD" ? Math.abs(cash.amount) * usdToEur : Math.abs(cash.amount);
    totalsPerSector[sectorName] = (totalsPerSector[sectorName] || 0) + cashEUR;
  }

  // Fonction pour obtenir la couleur d'un secteur
  const getSectorColor = (sector) => {
    return SECTOR_COLORS[sector] || SECTOR_COLORS["Unknown"];
  };

  // Couleurs devises
  const currencyColorMap = { 
    USD: "#10B981", // Vert
    EUR: "#3B82F6"  // Bleu
  };

  // Données Pie Devise (par devise ORIGINALE)
  const curLabels = Object.keys(portfolioTotalsByCurrency);
  const curData = Object.values(portfolioTotalsByCurrency);
  const pieDevise = {
    labels: curLabels,
    datasets: [
      {
        data: curData,
        backgroundColor: curLabels.map((c) => currencyColorMap[c] || "#9CA3AF"),
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  // Données Pie Secteur - COULEURS FIXES
  const secLabels = Object.keys(totalsPerSector);
  const secData = Object.values(totalsPerSector);
  const pieSecteur = {
    labels: secLabels,
    datasets: [
      {
        data: secData,
        backgroundColor: secLabels.map(getSectorColor),
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  const numberFormatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const pieOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "bottom",
        labels: {
          padding: 15,
          font: {
            size: 12,
            family: "'Inter', sans-serif"
          }
        }
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const raw = ctx.parsed;
            const formatted = numberFormatter.format(raw);
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total ? ((raw / total) * 100).toFixed(2) : 0;
            return `${ctx.label}: ${formatted} (${pct}%)`;
          },
        },
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleFont: { size: 14, weight: "bold" },
        bodyFont: { size: 13 },
        cornerRadius: 8,
      },
    },
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
                <p className="text-xs text-slate-500">Analytics</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/portfolio")}
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
                <span className="hidden sm:inline">← Portfolio</span>
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
            { key: "vue", label: "Vue d'ensemble", icon: "chart" },
            { key: "o1", label: "Performance", icon: "trending", route: "/analytics/performance" },
            { key: "o2", label: "Dividendes", icon: "cash", route: "/analytics/dividendes" },
            { key: "o3", label: "Géographie", icon: "shield", route: "/analytics/geographie" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.route) {
                  router.push(tab.route);
                } else {
                  setActiveTab(tab.key);
                }
              }}
              className={`relative px-6 py-3 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "text-emerald-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-600 to-blue-600" />
              )}
            </button>
          ))}
        </nav>

        {activeTab === "vue" && (
          <section>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {loading ? (
                <div className="col-span-full flex justify-center py-10">
                  <svg
                    className="animate-spin h-8 w-8 text-emerald-600"
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
                </div>
              ) : (
                <>
                  {/* Total en EUR (tout converti) */}
                  <div className="relative p-6 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden group hover:shadow-xl transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-blue-100 rounded-full -mr-12 -mt-12 opacity-40 group-hover:opacity-60 transition-opacity" />
                    <div className="relative">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Total (converti EUR)
                      </p>
                      <p className="text-3xl font-bold text-slate-900">
                        {numberFormatter.format(totalInEUR)} €
                      </p>
                    </div>
                  </div>

                  {/* Par devise originale */}
                  {Object.entries(portfolioTotalsByCurrency).map(([cur, tot]) => (
                    <div
                      key={cur}
                      className="relative p-6 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden group hover:shadow-xl transition-all"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-blue-100 rounded-full -mr-12 -mt-12 opacity-40 group-hover:opacity-60 transition-opacity" />
                      <div className="relative">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Positions {cur}
                        </p>
                        <p className="text-2xl font-bold text-slate-900">
                          {numberFormatter.format(tot)}{" "}
                          {formatCurrencySymbol(cur)}
                        </p>
                        {cur === "USD" && (
                          <p className="text-xs text-slate-500 mt-1">
                            ≈ {numberFormatter.format(tot * usdToEur)} €
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Cash Card */}
                  {cash.amount !== 0 && (
                    <div className="relative p-6 bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl overflow-hidden">
                      <div className="relative">
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                          {cash.amount < 0 ? "Dette" : "Cash"}
                        </p>
                        <p className="text-2xl font-bold text-emerald-900">
                          {numberFormatter.format(Math.abs(cash.amount))}{" "}
                          {formatCurrencySymbol(cash.currency)}
                        </p>
                        {cash.currency === "USD" && (
                          <p className="text-xs text-emerald-700 mt-1">
                            ≈ {numberFormatter.format(Math.abs(cash.amount) * usdToEur)} €
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Info taux de change */}
            {portfolioTotalsByCurrency.USD && (
              <div className="mb-6 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>💱 Taux USD→EUR : <strong>{usdToEur.toFixed(4)}</strong> (mis à jour automatiquement)</span>
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Répartition Devise */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <svg
                    className="w-5 h-5 text-emerald-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <h3 className="text-lg font-bold text-slate-900">
                    Répartition par Devise
                  </h3>
                </div>
                <div style={{ height: 320 }}>
                  <Pie data={pieDevise} options={pieOptions} />
                </div>
              </div>

              {/* Répartition Sectorielle */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <svg
                    className="w-5 h-5 text-emerald-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <h3 className="text-lg font-bold text-slate-900">
                    Répartition Sectorielle
                  </h3>
                </div>
                <div style={{ height: 320 }}>
                  <Pie data={pieSecteur} options={pieOptions} />
                </div>
              </div>
            </div>

            {/* Evolution Chart */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg
                  className="w-5 h-5 text-emerald-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                    clipRule="evenodd"
                  />
                </svg>
                <h3 className="text-lg font-bold text-slate-900">
                  Évolution de la Valeur du Portefeuille
                </h3>
              </div>
              <PortfolioHistoryChart />
            </div>
          </section>
        )}

        {activeTab !== "vue" && (
          <section>
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-12 text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Section en développement
              </h3>
              <p className="text-slate-600">
                Le contenu "{activeTab}" sera disponible prochainement.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
