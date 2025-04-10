"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sortByPrice } from "./utils/sort";
import { formatCurrencySymbol } from "./utils/formats";

export default function Portfolio() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState("none");

  // Vérifier l'authentification et charger les actions au montage
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
      return;
    }

    const fetchPortfolio = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/user/portfolio", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Erreur lors de la récupération du portefeuille.");

        const tickers = await res.json();
        const stocksWithPrices = await fetchStockPrices(tickers);
        setStocks(stocksWithPrices);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  //  Fonction pour récupérer les prix des actions avec délai pour éviter 429 Too Many Requests
  const fetchStockPrices = async (tickers) => {
    const results = [];

    for (const ticker of tickers) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pause de 1s entre chaque requête

      const { price, country, currency } = await fetchStockPrice(ticker);
      results.push({ ticker, price, country, currency });
    }

    return results;
  };

  const fetchStockPrice = async (ticker) => {
    try {
      const response = await fetch(
        `https://yh-finance.p.rapidapi.com/market/v2/get-quotes?region=US&symbols=${ticker}`,
        {
          headers: {
            "X-RapidAPI-Key": "74165ac8a1msh6505a6041df5d2ap1fd4cfjsnb9639d21ce02",
            "X-RapidAPI-Host": "yh-finance.p.rapidapi.com",
          },
        }
      );
  
      const data = await response.json();
      const result = data?.quoteResponse?.result?.[0];
  
      if (!result) {
        return {
          price: "Donnée non disponible",
          country: "Inconnu",
          currency: "?"
        };
      }
  
      return {
        price: typeof result.regularMarketPrice === "number" ? result.regularMarketPrice : "N/A",
        country: result.fullExchangeName || "Inconnu",
        currency: result.currency || "?"
      };
  
    } catch (error) {
      return {
        price: "Erreur",
        country: "Erreur",
        currency: "?"
      };
    }
  };


  //  Ajouter une action au portefeuille
  const addStock = async () => {
    if (!ticker.trim()) return;
    const newTicker = ticker.toUpperCase();
  
    if (stocks.some((stock) => stock.ticker === newTicker)) return;
  
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
  
      //  Récupérer juste le prix de la nouvelle action
      const { price, country, currency } = await fetchStockPrice(newTicker);
  
      //  Ajouter immédiatement au state sans recharger tout
      setStocks([...stocks, { ticker: newTicker, price, country, currency }]);
      setTicker(""); // reset champ
  
    } catch (err) {
      setError(err.message);
    }
  };
  // Suprréssion des actions
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
  
      //  Supprimer localement sans recharger les prix de toutes les actions
      setStocks(stocks.filter((stock) => stock.ticker !== tickerToRemove));
  
    } catch (err) {
      setError(err.message);
    }
  };

  //  Fonction pour se déconnecter
  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const handleSortByPrice = () => {
    let newOrder = "asc";
    if (sortOrder === "asc") newOrder = "desc";
    else if (sortOrder === "desc") newOrder = "none";
  
    setSortOrder(newOrder);
  
    if (newOrder === "none") return;
  
    const sorted = sortByPrice(stocks, newOrder);
    setStocks(sorted);
  };

  return (
    <main className="flex flex-col min-h-screen bg-gray-100 p-10">
      {/* Bouton Déconnexion */}
      <button
        onClick={logout}
        className="absolute top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
      >
        Déconnexion
      </button>

      <h1 className="text-4xl font-bold text-[#1E3A8A] mb-6 text-center">
        Mon Portefeuille d'Actions 
      </h1>

      {error && <p className="text-red-500 text-center">{error}</p>}

      {/* Barre d'ajout de ticker */}
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
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1E3A8A] text-white">
            <tr>
              <th className="p-3">Ticker</th>
              <th className="p-3">Pays</th>
              <th className="p-3 cursor-pointer select-none" 
              onClick={handleSortByPrice}
              >Prix Actuel {sortOrder === "asc" ? "↑" : sortOrder === "desc" ? "↓" : ""}    </th>
              <th className="p-3">Quantité</th>
              <th className="p-3">PRU</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="3" className="p-3 text-center">Chargement...</td>
              </tr>
            ) : stocks.length > 0 ? (
              stocks.map((stock) => (
                <tr key={stock.ticker} className="border-b">
                  <td className="p-3 font-semibold">{stock.ticker}</td>
                  <td className="p-3 text-gray-600">{stock.country || "--"}</td>
                  <td className="p-3 text-gray-600">
                  {stock.price} {formatCurrencySymbol(stock.currency)}
                  </td>
                  <td className="p-3 text-gray-600">--</td>      {/* Quantité */}
                  <td className="p-3 text-gray-600">--</td>      {/* PRU */}
                  <td className="p-3">
                    <button
                      onClick={() => removeStock(stock.ticker)}
                      className="px-4 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="p-3 text-center text-gray-500">
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
