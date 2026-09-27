"use client";

import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useFxRates, toEUR, eurPer } from "@/lib/fx";
import { formatCurrencySymbol } from "../../portfolio/utils/formats";
import AppHeader from "../../components/AppHeader";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DividendesPage() {
  const router = useRouter();
  const [loadError, setLoadError] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { rates, date: fxDate, stale: fxStale } = useFxRates();
  const inEUR = (value, currency) => toEUR(value, currency, rates) ?? (currency === "EUR" || !currency ? value : 0);

  // Fetch portfolio
  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const data = await apiFetch("/api/user/portfolio");
        setStocks(data.stocks || []);
      } catch (err) {
        console.error(err);
        setLoadError(`Impossible de charger vos données : ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  // Calculs des dividendes (toutes devises, converties en euros avec les taux BCE)
  const dividendData = useMemo(() => {
    const empty = { stocksWithDividends: [], totalsByCurrency: {}, totalAnnualInEUR: 0, portfolioYield: 0, calendar: [], totalPortfolioValue: 0 };
    if (!stocks || stocks.length === 0) return empty;

    const stocksWithDividends = stocks
      .filter((s) => s.dividend != null && s.dividend > 0)
      .map((s) => {
        const quantity = s.quantity || 0;
        const annualDivPerShare = s.dividend;
        const totalAnnual = annualDivPerShare * quantity;
        // Rendement au cours actuel, en % (le backend le donne déjà en %)
        const yieldPercent = s.close > 0 ? (annualDivPerShare / s.close) * 100 : Number(s.dividendYield) || 0;
        return {
          ticker: s.ticker,
          name: s.name,
          quantity,
          divPerShare: annualDivPerShare,
          totalAnnual,
          totalAnnualEUR: inEUR(totalAnnual, s.currency),
          yieldPercent,
          yieldOnCost: s.pru > 0 ? (annualDivPerShare / s.pru) * 100 : null,
          positionValue: (s.close || 0) * quantity,
          currency: s.currency || "USD",
          exDividendDate: s.exDividendDate,
          paymentDate: s.paymentDate,
          sector: s.sector,
        };
      })
      .sort((a, b) => b.totalAnnualEUR - a.totalAnnualEUR);

    const totalsByCurrency = stocksWithDividends.reduce((acc, s) => {
      acc[s.currency] = (acc[s.currency] || 0) + s.totalAnnual;
      return acc;
    }, {});
    const totalAnnualInEUR = stocksWithDividends.reduce((sum, s) => sum + s.totalAnnualEUR, 0);

    const totalPortfolioValue = stocks.reduce((sum, s) => sum + inEUR((s.close || 0) * (s.quantity || 0), s.currency), 0);
    const portfolioYield = totalPortfolioValue > 0 ? (totalAnnualInEUR / totalPortfolioValue) * 100 : 0;

    // Dernières dates de détachement (ISO « 2026-09-17 » ; anciennes données en secondes)
    const parseDate = (d) => (typeof d === "number" ? new Date(d * 1000) : new Date(d));
    const calendar = stocksWithDividends
      .filter((s) => s.exDividendDate && !Number.isNaN(parseDate(s.exDividendDate).getTime()))
      .map((s) => ({
        ticker: s.ticker,
        date: parseDate(s.exDividendDate),
        paymentDate: s.paymentDate ? parseDate(s.paymentDate) : null,
        amount: s.totalAnnual / 4,
        currency: s.currency,
      }))
      .sort((a, b) => b.date - a.date);

    return { stocksWithDividends, totalsByCurrency, totalAnnualInEUR, portfolioYield, calendar, totalPortfolioValue };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks, rates]);

  const formatCurrency = (value, currency = "EUR") => {
    return value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " " + formatCurrencySymbol(currency);
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
            Dividendes
          </h1>
          <p className="text-slate-600">
            Revenus versés par vos positions et rendement de votre portefeuille.
          </p>
        </div>


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
              {/* Par devise */}
              {Object.entries(dividendData.totalsByCurrency).map(([cur, tot]) => (
                <div key={cur} className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-600 uppercase mb-3">Dividendes {cur}</h3>
                  <p className="text-3xl font-bold text-emerald-600 mb-1">{formatCurrency(tot, cur)}</p>
                  <p className="text-xs text-slate-500">
                    {cur === "EUR" ? "par an" : `≈ ${formatCurrency(inEUR(tot, cur), "EUR")} / an`}
                  </p>
                </div>
              ))}

              {/* Total Converti */}
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl shadow-lg p-6">
                <h3 className="text-sm font-semibold text-emerald-700 uppercase mb-3">Total (EUR)</h3>
                <p className="text-3xl font-bold text-emerald-600 mb-1">
                  {formatCurrency(dividendData.totalAnnualInEUR, "EUR")}
                </p>
                <p className="text-xs text-emerald-700">
                  par an, soit {formatCurrency(dividendData.totalAnnualInEUR / 12, "EUR")} / mois
                </p>
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
            {Object.keys(dividendData.totalsByCurrency).some((c) => c !== "EUR") && (
              <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                Taux de référence BCE{fxDate ? ` du ${new Date(fxDate).toLocaleDateString("fr-FR")}` : ""} :{" "}
                {Object.keys(dividendData.totalsByCurrency).filter((c) => c !== "EUR").map((c) => (
                  <strong key={c} className="mr-2">1 {c} = {eurPer(c, rates)?.toFixed(4) ?? "?"} €</strong>
                ))}
                {fxStale && "(taux approximatifs, service indisponible)"}
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
                        <div className="text-xs text-slate-500">
                          {item.paymentDate ? `versé le ${formatDate(item.paymentDate)}` : "par trimestre (est.)"}
                        </div>
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
