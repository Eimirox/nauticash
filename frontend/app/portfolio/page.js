"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sortByPrice } from "./utils/sort";
import { formatCurrencySymbol } from "./utils/formats";
import { exchangeToCountry } from "./utils/exchangeMap";
import { getPerformanceClass } from "./utils/styles";

export default function Portfolio() {
  const router = useRouter();
  const [ticker, setTicker]       = useState("");
  const [stocks, setStocks]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [sortOrder, setSortOrder] = useState("none");
  const [localEdits, setLocalEdits] = useState({});
  const [showTotals, setShowTotals] = useState(true);

  // 1) Chargement centralisé du portfolio enrichi
  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token manquant");

      const res = await fetch("http://localhost:5000/api/user/portfolio", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();
      setStocks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2) Au montage, on s’assure que l’utilisateur est loggué puis on charge
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchPortfolio();
  }, [router]);

  // 3) Tri par prix
  const handleSortByPrice = () => {
    const newOrder =
      sortOrder === "asc" ? "desc" :
      sortOrder === "desc" ? "none" :
      "asc";
    setSortOrder(newOrder);
    if (newOrder !== "none") {
      setStocks(sortByPrice(stocks, newOrder));
    }
  };

  // 4) Ajouter une action → on recharge tout le portfolio
  const addStock = async () => {
  if (!ticker.trim()) return;
  const newTicker = ticker.toUpperCase();
  console.log("Tentative d'ajout de :", newTicker); // ← AJOUT ICI

  if (stocks.some((s) => s.ticker === newTicker)) {
    console.log("Ticker déjà présent :", newTicker);
    return;
  }

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
    console.log("Réponse POST /portfolio :", data); // ← AJOUT ICI

    if (!res.ok) throw new Error(`Status ${res.status}`);

    await fetchPortfolio();
    setTicker("");
  } catch (err) {
    console.error("Erreur addStock :", err.message);
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
      if (!res.ok) throw new Error(`Status ${res.status}`);
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
      if (!res.ok) throw new Error(`Status ${res.status}`);
    } catch (err) {
      console.error("Sync backend failed:", err.message);
    }
  };

  // Conseil de déconnexion
  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  // Regroupement des totaux par devise
  const totalsByCurrency = stocks.reduce((acc, s) => {
    if (typeof s.close === "number" && typeof s.quantity === "number") {
      acc[s.currency] = (acc[s.currency] || 0) + s.close * s.quantity;
    }
    return acc;
  }, {});

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

      {/* Barre d'actions */}
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
          className="px-6 py-2 bg-[#1E3A8A] text-white rounded-lg hover:bg-[#3B82F6] transition"
        >
          Ajouter
        </button>
        <button
          onClick={fetchPortfolio}
          className="px-6 py-2 border border-[#1E3A8A] text-[#1E3A8A] rounded-lg hover:bg-[#1E3A8A] hover:text-white transition"
        >
          Actualiser
        </button>
        <button
          onClick={() => router.push("/analytics")}
          className="px-6 py-2 border border-[#1E3A8A] text-[#1E3A8A] rounded-lg hover:bg-[#1E3A8A] hover:text-white transition"
        >
          Visualiser
        </button>
      </div>

      {/* Tableau des actions */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1E3A8A] text-white">
            <tr>
              <th className="p-3">Ticker</th>
              <th className="p-3">Pays</th>
              <th className="p-3">Type</th>
              <th className="p-3 cursor-pointer" onClick={handleSortByPrice}>
                Prix Actuel {sortOrder === "asc" ? "↑" : sortOrder === "desc" ? "↓" : ""}
              </th>
              <th className="p-3">Quantité</th>
              <th className="p-3">PRU</th>
              <th className="p-3">Performance</th>
              <th className="p-3">Dividende</th>
              <th className="p-3">Rendement</th>
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
            ) : stocks.length ? (
              stocks.map((stock) => {
                const perf =
                  stock.pru > 0 ? ((stock.close - stock.pru) / stock.pru) * 100 : null;
                const total =
                  typeof stock.close === "number" && typeof stock.quantity === "number"
                    ? stock.close * stock.quantity
                    : null;
                return (
                  <tr key={stock.ticker} className="border-b">
                    <td className="p-3 font-semibold">{stock.ticker}</td>
                    <td className="p-3 text-gray-600">
                      {exchangeToCountry[stock.country] || stock.country}
                    </td>
                    <td className="p-3 text-gray-600">
                      {stock.type || "?"}
                    </td>
                    <td className="p-3 text-gray-600">
                      {stock.close} {formatCurrencySymbol(stock.currency)}
                    </td>
                    <td className="p-3 text-gray-600">
                      <input
                        type="number"
                        value={
                          localEdits[stock.ticker]?.quantity ??
                          stock.quantity ??
                          ""
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
                            const val = parseFloat(
                              localEdits[stock.ticker]?.quantity
                            );
                            if (!isNaN(val))
                              handleUpdateStock(stock.ticker, "quantity", val);
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
                            if (!isNaN(val))
                              handleUpdateStock(stock.ticker, "pru", val);
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
                      {stock.dividend != null ? stock.dividend.toFixed(2) + " " + formatCurrencySymbol(stock.currency) : "--"}
                    </td>
                    <td className="p-3 text-gray-600">
                        {stock.myDividendYield != null ? stock.myDividendYield.toFixed(2) + " %" : "--"}
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

        {/* Totaux par devise – section déroulante */}
        <div className="p-4">
          <button
            onClick={() => setShowTotals((prev) => !prev)}
            className="flex justify-end items-center gap-1 text-[#1E3A8A] hover:text-[#3B82F6]"
          >
            <span>Totaux par devise</span>
            <span>{showTotals ? "▲" : "▼"}</span>
          </button>
          {showTotals && (
            <div className="mt-2 text-right font-semibold space-y-1">
              {Object.entries(totalsByCurrency).map(([cur, tot]) => (
                <div key={cur}>
                  {formatCurrencySymbol(cur)}
                  {tot.toFixed(2)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
