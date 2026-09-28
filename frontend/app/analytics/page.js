"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useFxRates, toCurrency, ratePer, currencySymbol } from "@/lib/fx";
import { useBaseCurrency } from "@/lib/profile";
import DiversificationCard from "../components/DiversificationCard";
import AppHeader from "../components/AppHeader";
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
  const [loadError, setLoadError] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [cash, setCash] = useState({ amount: 0, currency: "EUR" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vue");
  // Taux BCE servis par le backend : toutes les devises sont converties (pas seulement l'USD)
  const { rates, date: fxDate, stale: fxStale } = useFxRates();
  // Montants convertis dans la devise de référence du profil (EUR par défaut)
  const base = useBaseCurrency();
  const baseSymbol = currencySymbol(base);
  const inBase = (value, currency) => toCurrency(value, currency, base, rates) ?? ((currency || "EUR") === base ? value : 0);

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const data = await apiFetch("/api/user/portfolio");
        setStocks(data.stocks || []);
        setCash(data.cash || { amount: 0, currency: "EUR" });
      } catch (err) {
        console.error(err);
        setLoadError(`Impossible de charger vos données : ${err.message}`);
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

  // Total converti dans la devise de référence (pour KPI)
  const totalInBase = stocks.reduce((sum, s) => {
    const val = (s.close || 0) * (s.quantity || 0);
    if (!s.currency) return sum;
    return sum + inBase(val, s.currency);
  }, 0);

  // Totaux par secteur dans la devise de référence
  const totalsPerSector = stocks.reduce((acc, s) => {
    const val = (s.close || 0) * (s.quantity || 0);
    const valBase = inBase(val, s.currency);

    if (s.composition && typeof s.composition === "object") {
      // ETF avec composition { secteur: %, ... }
      Object.entries(s.composition).forEach(([sect, pct]) => {
        acc[sect] = (acc[sect] || 0) + (valBase * pct) / 100;
      });
    } else {
      const sect = s.sector || "Unknown";
      acc[sect] = (acc[sect] || 0) + valBase;
    }
    return acc;
  }, {});

  // Ajout du cash comme secteur (converti dans la devise de référence)
  if (!isNaN(cash?.amount) && cash?.currency && Math.abs(cash.amount) > 0) {
    const sectorName = cash.amount < 0 ? "Dette" : "Cash";
    const cashBase = inBase(Math.abs(cash.amount), cash.currency);
    totalsPerSector[sectorName] = (totalsPerSector[sectorName] || 0) + cashBase;
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
  // Parts comparées dans une même devise (sinon 1 000 ¥ pèseraient autant que 1 000 €)
  const curData = curLabels.map((c) => inBase(portfolioTotalsByCurrency[c], c));
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

  const numberFormatter = new Intl.NumberFormat("fr-FR", {
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
      {loadError && (
        <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {/* Header */}
      <AppHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Vue d'ensemble
          </h1>
          <p className="text-slate-600">
            Répartition de votre patrimoine par devise, type d'actif et secteur.
          </p>
        </div>


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
                  {/* Total dans la devise de référence (tout converti) */}
                  <div className="relative p-6 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden group hover:shadow-xl transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-blue-100 rounded-full -mr-12 -mt-12 opacity-40 group-hover:opacity-60 transition-opacity" />
                    <div className="relative">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Total (converti en {base})
                      </p>
                      <p className="text-3xl font-bold text-slate-900">
                        <span className="money">{numberFormatter.format(totalInBase)} {baseSymbol}</span>
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
                          <span className="money">{numberFormatter.format(tot)} {formatCurrencySymbol(cur)}</span>
                        </p>
                        {cur !== base && (
                          <p className="text-xs text-slate-500 mt-1">
                            ≈ <span className="money">{numberFormatter.format(inBase(tot, cur))} {baseSymbol}</span>
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
                          <span className="money">{numberFormatter.format(Math.abs(cash.amount))} {formatCurrencySymbol(cash.currency)}</span>
                        </p>
                        {cash.currency !== base && (
                          <p className="text-xs text-emerald-700 mt-1">
                            ≈ <span className="money">{numberFormatter.format(inBase(Math.abs(cash.amount), cash.currency))} {baseSymbol}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Info taux de change */}
            {Object.keys(portfolioTotalsByCurrency).some((c) => c !== base) && (
              <div className="mb-6 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>
                  Taux de référence BCE{fxDate ? ` du ${new Date(fxDate).toLocaleDateString("fr-FR")}` : ""} :{" "}
                  {Object.keys(portfolioTotalsByCurrency).filter((c) => c !== base).map((c) => (
                    <strong key={c} className="mr-2">1 {c} = {ratePer(c, base, rates)?.toFixed(4) ?? "?"} {baseSymbol}</strong>
                  ))}
                  {fxStale && "(taux approximatifs, service indisponible)"}
                </span>
              </div>
            )}

            {/* Score de diversification */}
            <DiversificationCard
              positions={stocks.map((s) => ({
                ticker: s.ticker,
                value: inBase((s.close || 0) * (s.quantity || 0), s.currency),
                sector: s.sector,
                country: s.country,
                currency: s.currency,
                type: s.type,
                composition: s.composition,
              }))}
            />

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
