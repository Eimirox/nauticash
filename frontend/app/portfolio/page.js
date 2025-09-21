"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrencySymbol } from "./utils/formats";
import { exchangeToCountry } from "./utils/exchangeMap";
import { getPerformanceClass } from "./utils/styles";

export default function Portfolio() {
  const router = useRouter();
  const [ticker, setTicker]         = useState("");
  const [stocks, setStocks]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [localEdits, setLocalEdits] = useState({});
  const [cash, setCash]             = useState({ amount: 0, currency: "EUR" });

  // [ALEX-SORT-001] Helpers tri générique
  const SORT_DIR = { NONE: "none", ASC: "asc", DESC: "desc" };
  const [sort, setSort] = useState({ key: null, dir: SORT_DIR.NONE });

  const nf2 = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // [ALEX-SORT-001] calcule les valeurs "dérivées" pour le tri
  function getSortableValue(stock, key) {
    switch (key) {
      case "price":
        return typeof stock.close === "number" ? stock.close : null;
      case "performance": {
        const perf = stock.pru > 0 ? ((stock.close - stock.pru) / stock.pru) * 100 : null;
        return Number.isFinite(perf) ? perf : null;
      }
      case "dividend":
        return typeof stock.dividend === "number" ? stock.dividend : null;
      case "yield":
        return typeof stock.myDividendYield === "number" ? stock.myDividendYield : null;
      case "total": {
        const total =
          typeof stock.close === "number" && typeof stock.quantity === "number"
            ? stock.close * stock.quantity
            : null;
        return Number.isFinite(total) ? total : null;
      }
      // Optionnel : d’autres clés si besoin
      case "ticker": return stock.ticker || "";
      case "quantity": return typeof stock.quantity === "number" ? stock.quantity : null;
      case "pru": return typeof stock.pru === "number" ? stock.pru : null;
      default:
        return null;
    }
  }

  // [ALEX-SORT-001] tri stable + nulls en bas
  function sortStocksGeneric(list, { key, dir }) {
    if (!key || dir === SORT_DIR.NONE) return list;
    const factor = dir === SORT_DIR.ASC ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = getSortableValue(a, key);
      const vb = getSortableValue(b, key);
      const an = va == null;
      const bn = vb == null;
      if (an && bn) return 0;
      if (an) return 1;   // a après b
      if (bn) return -1;  // b après a

      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * factor;
      }
      if (va < vb) return -1 * factor;
      if (va > vb) return  1 * factor;
      // tiebreaker : ticker
      return (a.ticker || "").localeCompare(b.ticker || "");
    });
  }

  // [ALEX-SORT-003] toggle tri d’une colonne
  function toggleSort(columnKey) {
    setSort((prev) => {
      if (prev.key !== columnKey) {
        return { key: columnKey, dir: SORT_DIR.ASC };
      }
      const next =
        prev.dir === SORT_DIR.ASC ? SORT_DIR.DESC :
        prev.dir === SORT_DIR.DESC ? SORT_DIR.NONE :
        SORT_DIR.ASC;
      return { key: columnKey, dir: next };
    });
  }

  // [ALEX-SORT-004] Réapplique le tri quand l’état de tri change
  useEffect(() => {
    setStocks((prev) => sortStocksGeneric(prev, sort));
  }, [sort]);

  // Charger cash depuis localStorage (fallback si pas encore en BDD)
  useEffect(() => {
    const saved = localStorage.getItem("cashData");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.amount === "number" && typeof parsed.currency === "string") {
          setCash(parsed);
        }
      } catch {}
    }
  }, []);

  // Sauvegarde locale du cash (UX) en parallèle de la BDD
  useEffect(() => {
    localStorage.setItem("cashData", JSON.stringify(cash));
  }, [cash]);

  // Charger portefeuille enrichi (stocks + cash)
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
      setStocks(sortStocksGeneric(incomingStocks, sort)); // réapplique le tri courant
      setCash(data.cash || { amount: 0, currency: "EUR" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour les prix
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

  // Au montage : check login + fetch
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchPortfolio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Ajouter un ticker
  const addStock = async () => {
    if (!ticker.trim()) return;
    const newTicker = ticker.toUpperCase();
    if (stocks.some((s) => s.ticker === newTicker)) return;

    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");

    try {
      const res = await fetch("http://localhost:5000/api/user/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticker: newTicker }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Status ${res.status}`);
      await fetchPortfolio();
      setTicker("");
    } catch (err) {
      console.error("Erreur addStock :", err.message);
      setError(err.message);
    }
  };

  // Supprimer un ticker
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

  // Édition quantité / PRU
  const handleUpdateStock = (ticker, field, value) => {
    setStocks((prev) => {
      const updated = prev.map((s) => (s.ticker === ticker ? { ...s, [field]: value } : s));
      return sortStocksGeneric(updated, sort); // garde l’ordre trié après modification
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

  // PATCH cash -> BDD
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

  // Déconnexion
  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  // Totaux par devise (actions/ETF/crypto)
  const totalsByCurrency = stocks.reduce((acc, s) => {
    if (typeof s.close === "number" && typeof s.quantity === "number") {
      acc[s.currency] = (acc[s.currency] || 0) + s.close * s.quantity;
    }
    return acc;
  }, {});
  // Ajout du cash / dette
  if (cash.currency && !isNaN(cash.amount)) {
    totalsByCurrency[cash.currency] =
      (totalsByCurrency[cash.currency] || 0) + cash.amount;
  }

  const typeBadge = (type) => {
    const t = (type || "UNKNOWN").toUpperCase();
    const map = {
      ETF: "bg-purple-100 text-purple-700",
      CRYPTOCURRENCY: "bg-orange-100 text-orange-700",
      EQUITY: "bg-blue-100 text-blue-700",
      UNKNOWN: "bg-gray-100 text-gray-700",
    };
    const label = t === "EQUITY" ? "Action" : t === "CRYPTOCURRENCY" ? "Crypto" : t;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map[t] || map.UNKNOWN}`}>
        {label}
      </span>
    );
  };

  // [ALEX-SORT-UI] helper caret pour l’UI
  const caret = (k) => sort.key === k ? (sort.dir === "asc" ? " ↑" : sort.dir === "desc" ? " ↓" : "") : "";

  // KPI cards (une par devise)
  const kpiCards = Object.entries(totalsByCurrency).map(([cur, tot]) => (
    <div key={cur} className="p-4 bg-white shadow rounded-lg text-center">
      <p className="text-gray-500">Total en {cur}</p>
      <p className="text-2xl font-bold text-blue-700">
        {nf2.format(Number(tot))} {formatCurrencySymbol(cur)}
      </p>
    </div>
  ));

  return (
    <main className="flex flex-col min-h-screen bg-gray-50 p-8">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#1E3A8A]">
          Mon Portefeuille
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/analytics")}
            className="px-4 py-2 border border-[#1E3A8A] text-[#1E3A8A] rounded-lg hover:bg-[#1E3A8A] hover:text-white transition"
          >
            Visualiser
          </button>
          <button
            onClick={handleUpdatePrices}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition"
          >
            Actualiser
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Déconnexion
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Bloc CASH (au-dessus, élément clé) */}
      <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-bold text-blue-800 mb-3">💼 Cash disponible</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="text-sm">
            Montant
            <input
              type="number"
              value={cash.amount}
              onChange={(e) => {
                const newVal = parseFloat(e.target.value) || 0;
                const cur = cash.currency;
                setCash((prev) => ({ ...prev, amount: newVal }));
                syncCashUpdate(newVal, cur);
              }}
              className="ml-2 w-36 border rounded px-3 py-2"
            />
          </label>

          <label className="text-sm">
            Devise
            <select
              value={cash.currency}
              onChange={(e) => {
                const newCurrency = e.target.value;
                const amt = cash.amount;
                setCash((prev) => ({ ...prev, currency: newCurrency }));
                syncCashUpdate(amt, newCurrency);
              }}
              className="ml-2 w-28 border rounded px-3 py-2"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <span className="text-sm text-gray-600 italic">
            {cash.amount < 0 ? "💸 Dette soustraite du total" : "💰 Ajouté au total"}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpiCards}
      </div>

      {/* Barre d'ajout de ticker + tri rapide prix (optionnel) */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Entrez un ticker (ex: AAPL)"
          className="px-4 py-2 border rounded-lg w-60 focus:ring-2 focus:ring-[#3B82F6] bg-white"
        />
        <button
          onClick={addStock}
          className="px-6 py-2 bg-[#1E3A8A] text-white rounded-lg hover:bg-[#3B82F6] transition"
        >
          Ajouter
        </button>
      </div>
      {/* Tableau dans une Card */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="px-6 py-3 bg-[#1E3A8A] text-white font-semibold">
          Détails des positions
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left">
            <thead className="bg-[#1E3A8A]/95 text-white sticky top-0 z-10">
              <tr>
                <th className="p-3">Ticker</th>
                <th className="p-3">Pays</th>
                <th className="p-3">Type</th>

                <th
                  className="p-3 cursor-pointer text-right select-none"
                  onClick={() => toggleSort("price")}
                  aria-sort={sort.key === "price" ? sort.dir : "none"}
                >
                  Prix Actuel{caret("price")}
                </th>

                <th className="p-3 text-right">Quantité</th>
                <th className="p-3 text-right">PRU</th>

                <th
                  className="p-3 cursor-pointer text-right select-none"
                  onClick={() => toggleSort("performance")}
                  aria-sort={sort.key === "performance" ? sort.dir : "none"}
                >
                  Performance{caret("performance")}
                </th>

                <th
                  className="p-3 cursor-pointer text-right select-none"
                  onClick={() => toggleSort("dividend")}
                  aria-sort={sort.key === "dividend" ? sort.dir : "none"}
                >
                  Dividende{caret("dividend")}
                </th>

                <th
                  className="p-3 cursor-pointer text-right select-none"
                  onClick={() => toggleSort("yield")}
                  aria-sort={sort.key === "yield" ? sort.dir : "none"}
                >
                  Rendement{caret("yield")}
                </th>

                <th
                  className="p-3 cursor-pointer text-right select-none"
                  onClick={() => toggleSort("total")}
                  aria-sort={sort.key === "total" ? sort.dir : "none"}
                >
                  Total{caret("total")}
                </th>

                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="p-10 text-center text-gray-500 text-xl">
                    Chargement...
                  </td>
                </tr>
              ) : stocks.length ? (
                stocks.map((stock) => {
                  const perf = stock.pru > 0 ? ((stock.close - stock.pru) / stock.pru) * 100 : null;
                  const total =
                    typeof stock.close === "number" && typeof stock.quantity === "number"
                      ? stock.close * stock.quantity
                      : null;

                  return (
                    <tr key={stock.ticker} className="odd:bg-gray-50 hover:bg-gray-100 border-b">
                      <td className="p-3 font-semibold">{stock.ticker}</td>
                      <td className="p-3 text-gray-600">{exchangeToCountry[stock.country] || stock.country}</td>
                      <td className="p-3">{typeBadge(stock.type)}</td>

                      <td className="p-3 text-right text-gray-700">
                        {nf2.format(stock.close)} {formatCurrencySymbol(stock.currency)}
                      </td>

                      {/* Quantité (editable) */}
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          value={localEdits[stock.ticker]?.quantity ?? stock.quantity ?? ""}
                          onFocus={() =>
                            setLocalEdits((prev) => ({
                              ...prev,
                              [stock.ticker]: { quantity: stock.quantity },
                            }))
                          }
                          onChange={(e) =>
                            setLocalEdits((prev) => ({
                              ...prev,
                              [stock.ticker]: {
                                ...prev[stock.ticker],
                                quantity: e.target.value,
                              },
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = parseFloat(localEdits[stock.ticker]?.quantity);
                              if (!isNaN(val)) handleUpdateStock(stock.ticker, "quantity", val);
                              setLocalEdits((prev) => {
                                const next = { ...prev };
                                delete next[stock.ticker];
                                return next;
                              });
                            }
                          }}
                          className="w-24 border px-2 py-1 rounded bg-white text-right"
                        />
                      </td>

                      {/* PRU (editable) */}
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          value={localEdits[stock.ticker]?.pru ?? stock.pru ?? ""}
                          onFocus={() =>
                            setLocalEdits((prev) => ({
                              ...prev,
                              [stock.ticker]: { pru: stock.pru },
                            }))
                          }
                          onChange={(e) =>
                            setLocalEdits((prev) => ({
                              ...prev,
                              [stock.ticker]: {
                                ...prev[stock.ticker],
                                pru: e.target.value,
                              },
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = parseFloat(localEdits[stock.ticker]?.pru);
                              if (!isNaN(val)) handleUpdateStock(stock.ticker, "pru", val);
                              setLocalEdits((prev) => {
                                const next = { ...prev };
                                delete next[stock.ticker];
                                return next;
                              });
                            }
                          }}
                          className="w-24 border px-2 py-1 rounded bg-white text-right"
                        />
                      </td>

                      {/* Performance avec flèche */}
                      <td className={`p-3 text-right font-semibold ${getPerformanceClass(perf)}`}>
                        {perf != null ? (
                          <>
                            {perf > 0 ? "▲ " : perf < 0 ? "▼ " : ""}
                            {nf2.format(perf)} %
                          </>
                        ) : (
                          "--"
                        )}
                      </td>

                      <td className="p-3 text-right text-gray-700">
                        {stock.dividend != null
                          ? `${nf2.format(stock.dividend)} ${formatCurrencySymbol(stock.currency)}`
                          : "--"}
                      </td>
                      <td className="p-3 text-right text-gray-700">
                        {stock.myDividendYield != null ? `${nf2.format(stock.myDividendYield)} %` : "--"}
                      </td>
                      <td className="p-3 text-right text-gray-700">
                        {total != null ? nf2.format(total) : "--"}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => removeStock(stock.ticker)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="p-10 text-center text-gray-500 text-xl">
                    Aucune action ajoutée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
