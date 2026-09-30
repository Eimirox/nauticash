"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useFxRates, toCurrency, ratePer, currencySymbol } from "@/lib/fx";
import { useBaseCurrency, useProfile } from "@/lib/profile";
import { dashboardAlerts } from "@/lib/alerts";
import { strategyReview } from "@/lib/strategyReview";
import { StrategyBrief } from "../components/StrategyReview";
import DashboardAlerts from "../components/DashboardAlerts";
import GoalGauge from "../components/GoalGauge";
import EmergencyFund from "../components/EmergencyFund";
import DividendIncomeCard from "../components/DividendIncomeCard";
import { estimateDividends } from "@/lib/dividendCalendar";
import AppHeader from "../components/AppHeader";
import Link from "next/link";
import AllocationPie from "../components/AllocationPie";
import { formatCurrencySymbol } from "../portfolio/utils/formats";
import PortfolioHistoryChart from "./PortfolioHistoryChart";
import WealthHero from "../components/WealthHero";
import { wealthSummary, allocationByType, allocationByCountry } from "@/lib/wealth";
import { TYPE_COLORS } from "../components/AllocationBreakdown";
import { shareSummary } from "@/lib/chartSummary";
import Skeleton, { SkeletonRegion, SkeletonStat } from "../components/ui/Skeleton";

// Pays : séries de DESIGN.md dans l'ordre, « Autres » en ardoise
const COUNTRY_COLORS = ["#059669", "#2563EB", "#14B8A6", "#0891B2", "#4F46E5"];
const OTHER_COLOR = "#64748B";

export default function TableauDeBord() {
  const [loadError, setLoadError] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [cash, setCash] = useState({ amount: 0, currency: "EUR" });
  const [loading, setLoading] = useState(true);
  // Taux BCE servis par le backend : toutes les devises sont converties (pas seulement l'USD)
  const { rates, date: fxDate, stale: fxStale } = useFxRates();
  // Montants convertis dans la devise de référence du profil (EUR par défaut)
  const base = useBaseCurrency();
  const { profile } = useProfile();
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

  // Synthèse et répartition par type d'actif dans la devise de référence
  const toBaseOrNull = (value, currency) => toCurrency(value, currency, base, rates);
  const summary = wealthSummary(stocks, cash, toBaseOrNull);
  const summaryReady =
    Boolean(rates) || (stocks.every((s) => (s.currency || "EUR") === base) && (!cash.amount || cash.currency === base));
  const totalsPerType = allocationByType(stocks, cash, toBaseOrNull);
  const typeLabels = Object.keys(totalsPerType);
  const countryRows = allocationByCountry(stocks, toBaseOrNull, 5);
  const dividendEstimate = summaryReady ? estimateDividends(stocks, inBase) : null;
  // Cash dans la devise de référence (null tant que le taux est inconnu)
  const cashInBase = toBaseOrNull(Number(cash.amount) || 0, cash.currency || "EUR");
  const hasData = stocks.length > 0 || cash.amount !== 0;
  const alerts = dashboardAlerts({ stocks, cashInBase, monthlyExpenses: profile?.monthlyExpenses });
  // Stratégie en bref : propositions issues de la stratégie du profil (valeurs proposées sinon)
  const review = summaryReady && !loading ? strategyReview({ profile, stocks, cashInBase: Math.max(0, cashInBase ?? 0), toBase: toBaseOrNull }) : null;
  const pieType = typeLabels.map((t) => ({
    label: t,
    value: totalsPerType[t],
    color: TYPE_COLORS[t] || TYPE_COLORS.Autres,
  }));

  const numberFormatter = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });


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
            Tableau de bord
          </h1>
          <p className="text-ink-muted">
            Votre patrimoine en un coup d'œil : synthèse, alertes, objectifs, évolution, dividendes et répartition en bref. Le détail est dans Analyses.
          </p>
        </div>


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
            ) : summaryReady && hasData && (
              <WealthHero summary={summary} symbol={baseSymbol} base={base} />
            )}

            {/* Alertes : cours en échec / non datés / anciens, fonds de précaution insuffisant */}
            {!loading && !loadError && hasData && <DashboardAlerts alerts={alerts} />}

            {/* Objectifs en bref : objectif de patrimoine et fonds de précaution (profil) */}
            {!loading && summaryReady && hasData && (
              <section id="objectifs-en-bref" aria-labelledby="goals-brief-title" className="mb-8 scroll-mt-24">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h2 id="goals-brief-title" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Objectifs en bref
                  </h2>
                  <Link href="/objectifs" className="text-sm font-medium text-accent hover:underline">
                    Voir mes objectifs
                  </Link>
                </div>
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                  <GoalGauge current={summary.total} goalAmount={profile?.goalAmount} goalDate={profile?.goalDate} symbol={baseSymbol} />
                  {cash.amount >= 0 ? (
                    <EmergencyFund cash={cashInBase ?? 0} monthlyExpenses={profile?.monthlyExpenses} symbol={baseSymbol} />
                  ) : (
                    <p className="text-sm text-ink-muted">Fonds de précaution : votre solde de cash est négatif (dette).</p>
                  )}
                </div>
              </section>
            )}

            {/* Stratégie en bref : propositions principales (page Stratégie) */}
            {!loading && !loadError && <StrategyBrief review={review} />}

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
                    <AllocationPie slices={pieType} />
                  ) : (
                    <p className="text-sm text-ink-muted">Aucune position pour le moment.</p>
                  )}
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
                  <Link href="/analyses/repartition" className="text-sm font-medium text-accent hover:underline">
                    Voir la répartition
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
      </div>
    </main>
  );
}
