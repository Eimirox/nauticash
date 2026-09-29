"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useFxRates, toCurrency, ratePer, currencySymbol } from "@/lib/fx";
import { useBaseCurrency } from "@/lib/profile";
import DiversificationCard from "../components/DiversificationCard";
import FeesCard from "../components/FeesCard";
import DividendIncomeCard from "../components/DividendIncomeCard";
import { estimateDividends } from "@/lib/dividendCalendar";
import AppHeader from "../components/AppHeader";
import Link from "next/link";
import { Pie } from "react-chartjs-2";
import Chart from "chart.js/auto";
import { formatCurrencySymbol } from "../portfolio/utils/formats";
import PortfolioHistoryChart from "./PortfolioHistoryChart";
import WealthHero from "../components/WealthHero";
import { wealthSummary, allocationByType, allocationByCountry } from "@/lib/wealth";
import { shareSummary } from "@/lib/chartSummary";
import Skeleton, { SkeletonRegion, SkeletonStat } from "../components/ui/Skeleton";

// Types d'actif : ordre des séries de DESIGN.md (accent, accent-2, teintes intermédiaires)
const TYPE_COLORS = {
  "Actions": "#2563EB",
  "ETF et fonds": "#059669",
  "Crypto": "#0891B2",
  "Cash": "#14B8A6",
  "Autres": "#64748B",
};

// Pays : séries de DESIGN.md dans l'ordre, « Autres » en ardoise
const COUNTRY_COLORS = ["#059669", "#2563EB", "#14B8A6", "#0891B2", "#4F46E5"];
const OTHER_COLOR = "#64748B";

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
      const sect =
        s.sector && s.sector !== "Unknown" ? s.sector : String(s.type).toUpperCase() === "ETF" ? "ETF" : "Non renseigné";
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

  // Synthèse et répartition par type d'actif dans la devise de référence
  const toBaseOrNull = (value, currency) => toCurrency(value, currency, base, rates);
  const summary = wealthSummary(stocks, cash, toBaseOrNull);
  const summaryReady =
    Boolean(rates) || (stocks.every((s) => (s.currency || "EUR") === base) && (!cash.amount || cash.currency === base));
  const totalsPerType = allocationByType(stocks, cash, toBaseOrNull);
  const typeLabels = Object.keys(totalsPerType);
  const countryRows = allocationByCountry(stocks, toBaseOrNull, 5);
  const dividendEstimate = summaryReady ? estimateDividends(stocks, inBase) : null;
  const pieType = {
    labels: typeLabels,
    datasets: [
      {
        data: typeLabels.map((t) => totalsPerType[t]),
        backgroundColor: typeLabels.map((t) => TYPE_COLORS[t] || TYPE_COLORS.Autres),
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

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
          color: "#8A9AA9", // lisible en clair comme en sombre
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
            const pct = total ? ((raw / total) * 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0";
            // Mode discret : pourcentage seulement
            if (document.documentElement.classList.contains("discreet")) return `${ctx.label} : ${pct} %`;
            return `${ctx.label} : ${formatted} (${pct} %)`;
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
            Vue d'ensemble
          </h1>
          <p className="text-ink-muted">
            Votre patrimoine en un coup d'œil : valeur totale, variation du jour, évolution et répartition par type d'actif, devise, secteur et pays.
          </p>
        </div>


        {activeTab === "vue" && (
          <section>
            {/* Synthèse : valeur totale, cap du jour, depuis l'achat */}
            {loading ? (
              <SkeletonRegion label="Chargement de votre patrimoine…" className="mb-8 rounded-2xl border border-line bg-surface p-6 shadow-card">
                <Skeleton className="mb-3 h-3 w-32" />
                <Skeleton className="mb-4 h-10 w-64 max-w-full" />
                <div className="flex flex-wrap gap-6">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </SkeletonRegion>
            ) : summaryReady && (stocks.length > 0 || cash.amount !== 0) && (
              <WealthHero summary={summary} symbol={baseSymbol} base={base} />
            )}

            {/* Evolution Chart */}
            <div className="bg-surface border border-line rounded-xl shadow-lg p-6 mb-8">
              <div className="flex items-center gap-2 mb-6">
                <svg
                  className="w-5 h-5 text-accent"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                    clipRule="evenodd"
                  />
                </svg>
                <h3 className="text-lg font-bold text-ink">
                  Évolution de la valeur du portefeuille
                </h3>
              </div>
              <PortfolioHistoryChart />
            </div>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {loading ? (
                <>
                  <span role="status" className="sr-only">Chargement des indicateurs…</span>
                  <SkeletonStat />
                  <SkeletonStat />
                  <SkeletonStat className="hidden lg:block" />
                </>
              ) : (
                <>
                  {/* Par devise originale */}
                  {Object.entries(portfolioTotalsByCurrency).map(([cur, tot]) => (
                    <div
                      key={cur}
                      className="relative p-6 bg-surface border border-line shadow-lg rounded-xl overflow-hidden group hover:shadow-xl transition-all"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-blue-100 dark:from-accent/20 dark:to-accent-2/20 rounded-full -mr-12 -mt-12 opacity-40 group-hover:opacity-60 transition-opacity" />
                      <div className="relative">
                        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">
                          Positions {cur}
                        </p>
                        <p className="text-2xl font-bold text-ink">
                          <span className="money">{numberFormatter.format(tot)} {formatCurrencySymbol(cur)}</span>
                        </p>
                        {cur !== base && (
                          <p className="text-xs text-ink-muted mt-1">
                            ≈ <span className="money">{numberFormatter.format(inBase(tot, cur))} {baseSymbol}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Cash Card */}
                  {cash.amount !== 0 && (
                    <div className="relative p-6 bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-accent/10 dark:to-accent-2/10 border border-accent/40 rounded-xl overflow-hidden">
                      <div className="relative">
                        <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
                          {cash.amount < 0 ? "Dette" : "Cash"}
                        </p>
                        <p className="text-2xl font-bold text-accent">
                          <span className="money">{numberFormatter.format(Math.abs(cash.amount))} {formatCurrencySymbol(cash.currency)}</span>
                        </p>
                        {cash.currency !== base && (
                          <p className="text-xs text-accent mt-1">
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
              <div className="mb-6 px-4 py-2 bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/30 rounded-lg text-xs text-blue-700 dark:text-sky-200 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>
                  Taux de référence BCE{fxDate ? ` du ${new Date(fxDate).toLocaleDateString("fr-FR")}` : ""} :{" "}
                  {Object.keys(portfolioTotalsByCurrency).filter((c) => c !== base).map((c) => (
                    <strong key={c} className="mr-2">1 {c} = {ratePer(c, base, rates)?.toLocaleString("fr-FR", { maximumFractionDigits: 4 }) ?? "?"} {baseSymbol}</strong>
                  ))}
                  {fxStale && "(taux approximatifs, service indisponible)"}
                </span>
              </div>
            )}

            {/* Revenus de dividendes : revenu annuel estimé et prochain versement */}
            {!loading && <DividendIncomeCard estimate={dividendEstimate} portfolioValue={summary.invested} base={base} />}

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

            {/* Frais des ETF et fonds */}
            <FeesCard
              symbol={baseSymbol}
              positions={stocks.map((s) => ({
                ticker: s.ticker,
                name: s.name,
                type: s.type,
                fees: s.fees ?? null,
                value: inBase((s.close || 0) * (s.quantity || 0), s.currency),
              }))}
              onFeesChange={(ticker, fees) =>
                setStocks((prev) => prev.map((s) => (s.ticker === ticker ? { ...s, fees } : s)))
              }
            />

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Répartition par type d'actif */}
              <div className="bg-surface border border-line rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                    <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                  </svg>
                  <h3 className="text-lg font-bold text-ink">Répartition par type d&apos;actif</h3>
                </div>
                <div
                  style={{ height: 320 }}
                  role={typeLabels.length > 0 ? "img" : undefined}
                  aria-label={
                    typeLabels.length > 0
                      ? `Graphique circulaire, répartition par type d'actif : ${shareSummary(typeLabels.map((t) => ({ label: t, value: totalsPerType[t] })))}`
                      : undefined
                  }
                >
                  {typeLabels.length > 0 ? (
                    <Pie data={pieType} options={pieOptions} />
                  ) : (
                    <p className="text-sm text-ink-muted">Aucune position pour le moment.</p>
                  )}
                </div>
              </div>

              {/* Répartition Devise */}
              <div className="bg-surface border border-line rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <svg
                    className="w-5 h-5 text-accent"
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
                  <h3 className="text-lg font-bold text-ink">
                    Répartition par devise
                  </h3>
                </div>
                <div
                  style={{ height: 320 }}
                  role="img"
                  aria-label={`Graphique circulaire, répartition par devise : ${shareSummary(curLabels.map((c, i) => ({ label: c, value: curData[i] })))}`}
                >
                  <Pie data={pieDevise} options={pieOptions} />
                </div>
              </div>

              {/* Répartition Sectorielle */}
              <div className="bg-surface border border-line rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <svg
                    className="w-5 h-5 text-accent"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <h3 className="text-lg font-bold text-ink">
                    Répartition par secteur
                  </h3>
                </div>
                <div
                  style={{ height: 320 }}
                  role="img"
                  aria-label={`Graphique circulaire, répartition par secteur : ${shareSummary(secLabels.map((l, i) => ({ label: l, value: secData[i] })))}`}
                >
                  <Pie data={pieSecteur} options={pieOptions} />
                </div>
              </div>

              {/* Répartition par pays : 5 premiers + autres */}
              <div className="bg-surface border border-line rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between gap-2 mb-6">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-lg font-bold text-ink">Répartition par pays</h3>
                  </div>
                  <Link href="/analytics/geographie" className="text-sm font-medium text-accent hover:underline">
                    Voir la carte
                  </Link>
                </div>
                {countryRows.length > 0 ? (
                  <ul className="space-y-4">
                    {countryRows.map((row, i) => {
                      const color = row.label === "Autres" ? OTHER_COLOR : COUNTRY_COLORS[i % COUNTRY_COLORS.length];
                      const pct = (row.share * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                      return (
                        <li key={row.label}>
                          <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
                            <span className="flex items-center gap-2 font-medium text-ink min-w-0">
                              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                              <span className="truncate">{row.label}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-ink-muted">
                              <span className="money">{numberFormatter.format(row.value)} {baseSymbol}</span>
                              <span className="ml-2 font-semibold text-ink">{pct} %</span>
                            </span>
                          </div>
                          <div
                            className="h-2 rounded-full bg-surface-2 overflow-hidden"
                            role="progressbar"
                            aria-label={`Part ${row.label}`}
                            aria-valuenow={Math.round(row.share * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div className="h-full rounded-full" style={{ width: `${Math.max(row.share * 100, 1)}%`, backgroundColor: color }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-muted">Aucune position pour le moment.</p>
                )}
                {countryRows.length > 0 && (
                  <p className="mt-5 text-xs text-ink-muted">Hors cash. Pays du siège de l&apos;entreprise ; un ETF est compté dans le pays indiqué pour la ligne.</p>
                )}
              </div>
            </div>

          </section>
        )}

        {activeTab !== "vue" && (
          <section>
            <div className="bg-surface border border-line rounded-xl shadow-lg p-12 text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-ink-muted/40"
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
              <h3 className="text-xl font-bold text-ink mb-2">
                Section en développement
              </h3>
              <p className="text-ink-muted">
                Le contenu "{activeTab}" sera disponible prochainement.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
