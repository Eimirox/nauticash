"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sortByPrice } from "./utils/sort";
import { formatCurrencySymbol } from "./utils/formats";
import { exchangeToCountry } from "./utils/exchangeMap";
import { getPerformanceClass } from "./utils/styles";


export default function Portfolio() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState("none");
  const [localEdits, setLocalEdits] = useState({});

  // 1) Fonction réutilisable pour charger le portfolio
  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/user/portfolio", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur lors de la récupération du portefeuille.");

      const json = await res.json();
      const portfolio = Array.isArray(json) ? json : json.portfolio;

      const formatted = portfolio.map((stk) => ({
        ticker: stk.ticker,
        price: stk.close,
        open: stk.open,
        high: stk.high,
        low: stk.low,
        volume: stk.volume,
        date: stk.date,
        country: stk.country || "US",
        currency: stk.currency || "USD",
        quantity: stk.quantity,
        pru: stk.pru,
      }));
      setStocks(formatted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2) Au montage, on charge le portfolio
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchPortfolio();
  }, []);

  // 3) Tri par prix
  const handleSortByPrice = () => {
    let newOrder = "asc";
    if (sortOrder === "asc") newOrder = "desc";
    else if (sortOrder === "desc") newOrder = "none";
    setSortOrder(newOrder);
    if (newOrder !== "none") {
      setStocks(sortByPrice(stocks, newOrder));
    }
  };

  // 4) Ajouter une action
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
      if (!res.ok) throw new Error("Erreur lors de l'ajout de l'action.");

      // On recharge tout le portfolio
      await fetchPortfolio();
      setTicker("");
    } catch (err) {
      setError(err.message);
    }
  };

  // 5) Supprimer une action
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
      if (!res.ok) throw new Error("Erreur lors de la suppression de l'action.");

      setStocks((prev) => prev.filter((s) => s.ticker !== tickerToRemove));
    } catch (err) {
      setError(err.message);
    }
  };

  // 6) Mise à jour quantité/PRU
  const handleUpdateStock = (ticker, field, value) => {
    setStocks((prev) =>
      prev.map((s) => (s.ticker === ticker ? { ...s, [field]: value } : s))
    );
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
      if (!res.ok) throw new Error("Erreur lors de la synchronisation.");
    } catch (err) {
      console.error("Sync backend failed:", err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <main className="flex flex-col min-h-screen bg-gray-100 p-10">
      <button
        onClick={logout}
        className="absolute top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
      >
        Déconnexion
      </button>

      <h1 className="text-4xl font-bold text-[#1E3A8A] mb-6 text-center">
        Mon Portefeuille d'Actions
      </h1>

      {error && <p className="text-red-500 text-center">{error}</p>}

      {/* Barre d'ajout */}
      <div className="flex justify-center gap-4 mb-6">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Entrez un ticker (ex: AAPL)"
          className="px-4 py-2 border rounded-lg w-60 focus:ring-2 focus:ring-[#3B82F6]"
        />
        <button
          onClick={addStock}
          className="px-6 py-2 bg-[#1E3A8A] text-white rounded-lg hover:bg-[#3B82F6]"
        >
          Ajouter
        </button>
      </div>

      {/* Tableau des actions */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1E3A8A] text-white">
            <tr>
              <th className="p-3">Ticker</th>
              <th className="p-3">Pays</th>
              <th className="p-3 cursor-pointer" onClick={handleSortByPrice}>
                Prix Actuel {sortOrder === "asc" ? "↑" : sortOrder === "desc" ? "↓" : ""}
              </th>
              <th className="p-3">Quantité</th>
              <th className="p-3">PRU</th>
              <th className="p-3">Performance</th>
              <th className="p-3">Total</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="p-10 text-center text-gray-500 text-xl">
                  Chargement...
                </td>
              </tr>
            ) : stocks.length > 0 ? (
              stocks.map((stock) => {
                const perf =
                  stock.pru > 0 ? ((stock.price - stock.pru) / stock.pru) * 100 : null;
                const total =
                  typeof stock.price === "number" && typeof stock.quantity === "number"
                    ? stock.price * stock.quantity
                    : null;
                return (
                  <tr key={stock.ticker} className="border-b">
                    <td className="p-3 font-semibold">{stock.ticker}</td>
                    <td className="p-3 text-gray-600">
                      {exchangeToCountry[stock.country] || stock.country}
                    </td>
                    <td className="p-3 text-gray-600">
                      {stock.price} {formatCurrencySymbol(stock.currency)}
                    </td>
                    <td className="p-3 text-gray-600">
                      <input
                        type="number"
                        value={
                          localEdits[stock.ticker]?.quantity ?? stock.quantity ?? ""
                        }
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
                        className="w-20 border px-2 py-1 rounded"
                      />
                    </td>
                    <td className="p-3 text-gray-600">
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
                        className="w-20 border px-2 py-1 rounded"
                      />
                    </td>
                    <td className={`p-3 ${getPerformanceClass(perf)}`}>
                      {perf != null ? perf.toFixed(2) + " %" : "--"}
                    </td>
                    <td className="p-3 text-gray-600">
                      {total != null ? total.toFixed(2) : "--"}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => removeStock(stock.ticker)}
                        className="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="p-10 text-center text-gray-500 text-xl">
                  Aucune action ajoutée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
