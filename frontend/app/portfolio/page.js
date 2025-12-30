"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrencySymbol } from "./utils/formats";
import { exchangeToCountry } from "./utils/exchangeMap";
import { getPerformanceClass } from "./utils/styles";

export default function Portfolio() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cash, setCash] = useState({ amount: 0, currency: "EUR" });
  const [showCashSection, setShowCashSection] = useState(false);
  const [fullscreenTable, setFullscreenTable] = useState(false);

  const SORT_DIR = { NONE: "none", ASC: "asc", DESC: "desc" };
  const [sort, setSort] = useState({ key: null, dir: SORT_DIR.NONE });

  const nf2 = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function getSortableValue(stock, key) {
    switch (key) {
      case "price":
        return typeof stock.close === "number" ? stock.close : null;
      case "performance": {
        const perf =
          stock.pru > 0 ? ((stock.close - stock.pru) / stock.pru) * 100 : null;
        return Number.isFinite(perf) ? perf : null;
      }
      case "dividend":
        return typeof stock.dividend === "number" ? stock.dividend : null;
      case "yield":
        return typeof stock.myDividendYield === "number"
          ? stock.myDividendYield
          : null;
      case "total": {
        const total =
          typeof stock.close === "number" && typeof stock.quantity === "number"
            ? stock.close * stock.quantity
            : null;
        return Number.isFinite(total) ? total : null;
      }
      case "ticker":
        return stock.ticker || "";
      case "quantity":
        return typeof stock.quantity === "number" ? stock.quantity : null;
      case "pru":
        return typeof stock.pru === "number" ? stock.pru : null;
      default:
        return null;
    }
  }

  function sortStocksGeneric(list, { key, dir }) {
    if (!key || dir === SORT_DIR.NONE) return list;
    const factor = dir === SORT_DIR.ASC ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = getSortableValue(a, key);
      const vb = getSortableValue(b, key);
      const an = va == null;
      const bn = vb == null;
      if (an && bn) return 0;
      if (an) return 1;
      if (bn) return -1;

      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * factor;
      }
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return (a.ticker || "").localeCompare(b.ticker || "");
    });
  }

  function toggleSort(columnKey) {
    setSort((prev) => {
      if (prev.key !== columnKey) {
        return { key: columnKey, dir: SORT_DIR.ASC };
      }
      const next =
        prev.dir === SORT_DIR.ASC
          ? SORT_DIR.DESC
          : prev.dir === SORT_DIR.DESC
          ? SORT_DIR.NONE
          : SORT_DIR.ASC;
      return { key: columnKey, dir: next };
    });
  }

  useEffect(() => {
    setStocks((prev) => sortStocksGeneric(prev, sort));
  }, [sort]);

  useEffect(() => {
    const saved = localStorage.getItem("cashData");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed.amount === "number" &&
          typeof parsed.currency === "string"
        ) {
          setCash(parsed);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cashData", JSON.stringify(cash));
  }, [cash]);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token manquant");

      const res = await fetch("http://localhost:5000/api/user/portfolio", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();
      const incomingStocks = data.stocks || [];
      setStocks(sortStocksGeneric(incomingStocks, sort));
      setCash(data.cash || { amount: 0, currency: "EUR" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrices = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:5000/api/update-prices", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Échec de la mise à jour des prix");
      await fetchPortfolio();
      alert("✅ Mise à jour effectuée !");
    } catch (err) {
      console.error("Erreur lors de la mise à jour :", err.message);
      alert("❌ Échec de la mise à jour");
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const addStock = async () => {
    if (!ticker.trim()) return;
    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");
    try {
      const res = await fetch("http://localhost:5000/api/user/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticker: ticker.toUpperCase() }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      await fetchPortfolio();
      setTicker("");
    } catch (err) {
      setError(err.message);
    }
  };

  const removeStock = async (tickerToRemove) => {
    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");
    try {
      const res = await fetch("http://localhost:5000/api/user/portfolio", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticker: tickerToRemove }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setStocks((prev) => prev.filter((s) => s.ticker !== tickerToRemove));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateStock = (ticker, field, value) => {
    setStocks((prev) => {
      const updated = prev.map((s) =>
        s.ticker === ticker ? { ...s, [field]: value } : s
      );
      return sortStocksGeneric(updated, sort);
    });
    syncStockUpdate(ticker, field, value);
  };

  const syncStockUpdate = async (ticker, field, value) => {
    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");
    try {
      const res = await fetch("http://localhost:5000/api/user/portfolio", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticker, field, value }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
    } catch (err) {
      console.error("Sync backend failed:", err.message);
    }
  };

  const syncCashUpdate = async (amount, currency) => {
    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");
    try {
      const res = await fetch("http://localhost:5000/api/user/cash", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, currency }),
      });
      if (!res.ok) throw new Error(`Erreur backend cash: ${res.status}`);
    } catch (err) {
      console.error("Erreur syncCashUpdate :", err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const portfolioTotalsByCurrency = stocks.reduce((acc, s) => {
    if (typeof s.close === "number" && typeof s.quantity === "number") {
      acc[s.currency] = (acc[s.currency] || 0) + s.close * s.quantity;
    }
    return acc;
  }, {});

  const totalWealthByCurrency = { ...portfolioTotalsByCurrency };
  if (cash.currency && !isNaN(cash.amount)) {
    totalWealthByCurrency[cash.currency] =
      (totalWealthByCurrency[cash.currency] || 0) + cash.amount;
  }

  const typeBadge = (type) => {
    const t = (type || "UNKNOWN").toUpperCase();
    const map = {
      ETF: "bg-purple-50 text-purple-700 border-purple-200",
      CRYPTOCURRENCY: "bg-orange-50 text-orange-700 border-orange-200",
      EQUITY: "bg-blue-50 text-blue-700 border-blue-200",
      UNKNOWN: "bg-slate-100 text-slate-600 border-slate-200",
    };
    const label =
      t === "EQUITY" ? "Action" : t === "CRYPTOCURRENCY" ? "Crypto" : t;
    return (
      <span
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
          map[t] || map.UNKNOWN
        }`}
      >
        {label}
      </span>
    );
  };

  const caret = (k) => {
    if (sort.key !== k) return "";
    if (sort.dir === "asc")
      return (
        <svg className="inline w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
      );
    if (sort.dir === "desc")
      return (
        <svg className="inline w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      );
    return "";
  };

  // Composant Tableau
  const TableContent = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b-2 border-slate-200">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Ticker
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Pays
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Type
            </th>
            <th
              className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-emerald-600 transition select-none"
              onClick={() => toggleSort("price")}
            >
              Prix {caret("price")}
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Quantité
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
              PRU
            </th>
            <th
              className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-emerald-600 transition select-none"
              onClick={() => toggleSort("performance")}
            >
              Performance {caret("performance")}
            </th>
            <th
              className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-emerald-600 transition select-none"
              onClick={() => toggleSort("dividend")}
            >
              Dividende {caret("dividend")}
            </th>
            <th
              className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-emerald-600 transition select-none"
              onClick={() => toggleSort("yield")}
            >
              Rendement {caret("yield")}
            </th>
            <th
              className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:text-emerald-600 transition select-none"
              onClick={() => toggleSort("total")}
            >
              Total {caret("total")}
            </th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan="11"
                className="px-6 py-20 text-center text-slate-500"
              >
                <div className="flex flex-col items-center gap-3">
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
                  <span className="text-sm font-medium">
                    Chargement de votre portefeuille...
                  </span>
                </div>
              </td>
            </tr>
          ) : stocks.length ? (
            stocks.map((stock) => {
              const perf =
                stock.pru > 0
                  ? ((stock.close - stock.pru) / stock.pru) * 100
                  : null;
              const total =
                typeof stock.close === "number" &&
                typeof stock.quantity === "number"
                  ? stock.close * stock.quantity
                  : null;

              return (
                <tr
                  key={stock.ticker}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 font-bold text-slate-900 text-base">
                    {stock.ticker}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {exchangeToCountry[stock.country] || stock.country}
                  </td>
                  <td className="px-6 py-4">{typeBadge(stock.type)}</td>
                  <td className="px-6 py-4 text-right text-slate-900 font-medium">
                    {nf2.format(stock.close)}{" "}
                    {formatCurrencySymbol(stock.currency)}
                  </td>
                  
                  {/* QUANTITÉ - VERSION SIMPLE AVEC defaultValue */}
                  <td className="px-6 py-4 text-right">
                    <input
                      type="number"
                      key={`qty-${stock.ticker}-${stock.quantity}`}
                      defaultValue={stock.quantity}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val !== stock.quantity) {
                          handleUpdateStock(stock.ticker, "quantity", val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.target.blur();
                        }
                      }}
                      className="w-24 px-3 py-2 text-right text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </td>
                  
                  {/* PRU - VERSION SIMPLE AVEC defaultValue */}
                  <td className="px-6 py-4 text-right">
                    <input
                      type="number"
                      key={`pru-${stock.ticker}-${stock.pru}`}
                      defaultValue={stock.pru}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val !== stock.pru) {
                          handleUpdateStock(stock.ticker, "pru", val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.target.blur();
                        }
                      }}
                      className="w-24 px-3 py-2 text-right text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </td>
                  
                  <td
                    className={`px-6 py-4 text-right font-bold text-base ${getPerformanceClass(
                      perf
                    )}`}
                  >
                    {perf != null ? (
                      <>
                        {perf > 0 ? "▲ " : perf < 0 ? "▼ " : ""}
                        {nf2.format(perf)} %
                      </>
                    ) : (
                      <span className="text-slate-400">--</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-700">
                    {stock.dividend != null
                      ? `${nf2.format(stock.dividend)} ${formatCurrencySymbol(
                          stock.currency
                        )}`
                      : "--"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-700">
                    {stock.myDividendYield != null
                      ? `${nf2.format(stock.myDividendYield)} %`
                      : "--"}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-900">
                    {total != null ? nf2.format(total) : "--"}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => removeStock(stock.ticker)}
                      className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-600 hover:text-white transition-all text-sm font-medium"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan="11"
                className="px-6 py-20 text-center text-slate-500"
              >
                <div className="flex flex-col items-center gap-3">
                  <svg
                    className="w-16 h-16 text-slate-300"
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
                  <div>
                    <p className="text-lg font-medium text-slate-700 mb-1">
                      Aucune position
                    </p>
                    <p className="text-sm text-slate-500">
                      Ajoutez votre première action pour commencer
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // Mode Plein Écran
  if (fullscreenTable) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-auto">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between shadow-lg">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            Mes Positions - Mode Plein Écran
          </h2>
          <button
            onClick={() => setFullscreenTable(false)}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Fermer
          </button>
        </div>
        <TableContent />
      </div>
    );
  }

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
                <p className="text-xs text-slate-500">Mon Portefeuille</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/analytics")}
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Analytics
              </button>
              <button
                onClick={handleUpdatePrices}
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="hidden sm:inline">Actualiser</span>
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg hover:shadow-lg transition-all"
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(portfolioTotalsByCurrency).map(([cur, tot]) => (
            <div
              key={cur}
              className="relative p-5 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden group hover:shadow-xl transition-all"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-100 to-blue-100 rounded-full -mr-10 -mt-10 opacity-40 group-hover:opacity-60 transition-opacity" />
              <div className="relative">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Positions {cur}
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {nf2.format(Number(tot))} {formatCurrencySymbol(cur)}
                </p>
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowCashSection(!showCashSection)}
            className="relative p-5 bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-dashed border-emerald-300 rounded-xl hover:border-emerald-400 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                  Cash / Dette
                </p>
                <p className="text-lg font-bold text-emerald-900">
                  {nf2.format(cash.amount)} {formatCurrencySymbol(cash.currency)}
                </p>
              </div>
              <svg
                className={`w-5 h-5 text-emerald-600 transition-transform ${
                  showCashSection ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>
        </div>

        {showCashSection && (
          <div className="mb-6 p-5 bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <svg
                className="w-5 h-5 text-emerald-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path
                  fillRule="evenodd"
                  d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-sm font-bold text-slate-900">
                Gérer le cash disponible
              </h3>
              <span className="text-xs text-slate-500">
                (Optionnel - Non inclus dans les totaux de positions)
              </span>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Montant
                </label>
                <input
                  type="number"
                  value={cash.amount}
                  onChange={(e) => {
                    const newVal = parseFloat(e.target.value) || 0;
                    setCash((prev) => ({ ...prev, amount: newVal }));
                    syncCashUpdate(newVal, cash.currency);
                  }}
                  className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Devise
                </label>
                <select
                  value={cash.currency}
                  onChange={(e) => {
                    const newCurrency = e.target.value;
                    setCash((prev) => ({ ...prev, currency: newCurrency }));
                    syncCashUpdate(cash.amount, newCurrency);
                  }}
                  className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2 px-3 py-2 bg-white/60 rounded-lg text-xs text-slate-600">
                  <span className="text-base">
                    {cash.amount < 0 ? "💸" : "💰"}
                  </span>
                  {cash.amount < 0 ? "Dette" : "Épargne"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Stock */}
        <div className="mb-6 flex flex-wrap items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <svg
              className="w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && addStock()}
              placeholder="Ajouter un ticker (AAPL, BTC-USD...)"
              className="flex-1 px-3 py-2 border-0 focus:outline-none text-sm placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={addStock}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-blue-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all"
          >
            <span className="flex items-center gap-2">
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Ajouter
            </span>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              Mes Positions
            </h2>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-white">
                {stocks.length} {stocks.length > 1 ? "positions" : "position"}
              </span>
              <button
                onClick={() => setFullscreenTable(true)}
                className="px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-all flex items-center gap-1.5"
                title="Mode plein écran"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span className="hidden sm:inline">Plein écran</span>
              </button>
            </div>
          </div>

          <TableContent />
        </div>
      </div>
    </main>
  );
}