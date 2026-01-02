"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DividendesPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usdToEur, setUsdToEur] = useState(0.92);

  // Fetch taux de change USD->EUR
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        const data = await res.json();
        setUsdToEur(data.rates.EUR || 0.92);
      } catch (err) {
        console.log("Taux de change par défaut utilisé");
      }
    };
    fetchExchangeRate();
  }, []);

  // Fetch portfolio
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  // Calculs des dividendes
  const dividendData = useMemo(() => {
    console.log("🔍 DEBUG Dividendes - Stocks reçus:", stocks);
    
    if (!stocks || stocks.length === 0) {
      console.log("❌ Aucun stock");
      return {
        stocksWithDividends: [],
        totalAnnualUSD: 0,
        totalAnnualEUR: 0,
        portfolioYield: 0,
        calendar: []
      };
    }

    // DEBUG : Afficher les dividendes de chaque stock
    stocks.forEach(s => {
      console.log(`📊 ${s.ticker}: dividend=${s.dividend}, dividendYield=${s.dividendYield}`);
    });

    // Filtrer les actions avec dividendes (plus permissif)
    const stocksWithDividends = stocks
      .filter(s => {
        const hasDividend = s.dividend != null && s.dividend > 0;
        if (!hasDividend) {
          console.log(`⚠️ ${s.ticker} n'a pas de dividende (dividend=${s.dividend})`);
        }
        return hasDividend;
      })
      .map(s => {
        const annualDivPerShare = s.dividend || 0;
        const quantity = s.quantity || 0;
        const totalAnnual = annualDivPerShare * quantity;
        const yieldPercent = (s.dividendYield || 0) * 100;
        const positionValue = (s.close || 0) * quantity;
        
        return {
          ticker: s.ticker,
          name: s.name,
          quantity,
          divPerShare: annualDivPerShare,
          totalAnnual,
          yieldPercent,
          positionValue,
          currency: s.currency || "USD",
          exDividendDate: s.exDividendDate,
          sector: s.sector
        };
      })
      .sort((a, b) => b.yieldPercent - a.yieldPercent); // Trier par rendement

    // Total annuel
    const totalAnnualUSD = stocksWithDividends
      .filter(s => s.currency === "USD")
      .reduce((sum, s) => sum + s.totalAnnual, 0);
    
    const totalAnnualEUR = stocksWithDividends
      .filter(s => s.currency === "EUR")
      .reduce((sum, s) => sum + s.totalAnnual, 0);

    // Valeur totale du portfolio
    const totalPortfolioValue = stocks.reduce((sum, s) => {
      const val = (s.close || 0) * (s.quantity || 0);
      return sum + (s.currency === "USD" ? val * usdToEur : val);
    }, 0);

    // Rendement global
    const totalDividendsEUR = totalAnnualUSD * usdToEur + totalAnnualEUR;
    const portfolioYield = totalPortfolioValue > 0 
      ? (totalDividendsEUR / totalPortfolioValue) * 100 
      : 0;

    // Calendrier (basé sur exDividendDate)
    const calendar = stocksWithDividends
      .filter(s => s.exDividendDate)
      .map(s => {
        const date = new Date(s.exDividendDate * 1000);
        const quarterlyDiv = s.totalAnnual / 4; // Estimation trimestrielle
        
        return {
          ticker: s.ticker,
          date,
          amount: quarterlyDiv,
          currency: s.currency
        };
      })
      .sort((a, b) => b.date - a.date); // Plus récent en premier

    return {
      stocksWithDividends,
      totalAnnualUSD,
      totalAnnualEUR,
      portfolioYield,
      calendar,
      totalPortfolioValue
    };
  }, [stocks, usdToEur]);

  const formatCurrency = (value, currency = "EUR") => {
    return value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + (currency === "EUR" ? "€" : "$");
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
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
                <p className="text-xs text-slate-500">Dividendes</p>
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
                tab.key === "dividendes"
                  ? "text-emerald-600"
                  : tab.route 
                    ? "text-slate-600 hover:text-slate-900 cursor-pointer"
                    : "text-slate-400 cursor-not-allowed"
              }`}
            >
              {tab.label}
              {tab.key === "dividendes" && (
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
        ) : dividendData.stocksWithDividends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium mb-2">Aucun dividende</p>
            <p className="text-sm mb-4">Les actions de votre portfolio ne versent pas de dividendes</p>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Total USD */}
              {dividendData.totalAnnualUSD > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-sm font-semibold text-slate-600 uppercase">Dividendes USD</h3>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600 mb-1">
                    {formatCurrency(dividendData.totalAnnualUSD, "USD")}
                  </p>
                  <p className="text-xs text-slate-500">
                    ≈ {formatCurrency(dividendData.totalAnnualUSD * usdToEur, "EUR")} / an
                  </p>
                </div>
              )}

              {/* Total EUR */}
              {dividendData.totalAnnualEUR > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-sm font-semibold text-slate-600 uppercase">Dividendes EUR</h3>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(dividendData.totalAnnualEUR, "EUR")}
                  </p>
                  <p className="text-xs text-slate-500">par an</p>
                </div>
              )}

              {/* Total Converti */}
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-sm font-semibold text-emerald-700 uppercase">Total (EUR)</h3>
                </div>
                <p className="text-3xl font-bold text-emerald-600 mb-1">
                  {formatCurrency(dividendData.totalAnnualUSD * usdToEur + dividendData.totalAnnualEUR, "EUR")}
                </p>
                <p className="text-xs text-emerald-700">par an</p>
              </div>

              {/* Rendement Portfolio */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase">Rendement</h3>
                </div>
                <p className="text-3xl font-bold text-slate-900 mb-1">
                  {dividendData.portfolioYield.toFixed(2)}%
                </p>
                <p className="text-xs text-slate-500">du portfolio</p>
              </div>
            </div>

            {/* Taux de change info */}
            {dividendData.totalAnnualUSD > 0 && (
              <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>💱 Taux USD→EUR : <strong>{usdToEur.toFixed(4)}</strong></span>
              </div>
            )}

            {/* Tableau Dividendes par Action */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900">Dividendes par Action</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Action</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Quantité</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Div/Action</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Total Annuel</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Rendement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dividendData.stocksWithDividends.map((stock, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div>
                            <div className="text-sm font-bold text-slate-900">{stock.ticker}</div>
                            <div className="text-xs text-slate-500">{stock.name}</div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-slate-600">
                          {stock.quantity}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-slate-600">
                          {formatCurrency(stock.divPerShare, stock.currency)}
                        </td>
                        <td className="text-right py-3 px-4 text-sm font-bold text-emerald-600">
                          {formatCurrency(stock.totalAnnual, stock.currency)}
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            stock.yieldPercent >= 3 
                              ? "bg-emerald-100 text-emerald-800" 
                              : stock.yieldPercent >= 1.5
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-800"
                          }`}>
                            {stock.yieldPercent.toFixed(2)}%
                            {stock.yieldPercent >= 3 && " 🏆"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calendrier */}
            {dividendData.calendar.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-lg font-bold text-slate-900">Dernières Dates Ex-Dividende</h3>
                </div>
                <div className="space-y-3">
                  {dividendData.calendar.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <span className="text-emerald-600 font-bold text-sm">{item.ticker.slice(0, 2)}</span>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{item.ticker}</div>
                          <div className="text-xs text-slate-500">{formatDate(item.date)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-600">
                          {formatCurrency(item.amount, item.currency)}
                        </div>
                        <div className="text-xs text-slate-500">par trimestre (est.)</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">💰 À propos des dividendes</p>
                  <p className="text-blue-700">
                    Les montants affichés sont des estimations annuelles basées sur les derniers dividendes déclarés. 
                    Les dates ex-dividende indiquent les derniers versements trimestriels. Les dividendes réels peuvent varier.
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
