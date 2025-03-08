"use client"; // Next.js 13+ avec App Router

import { useState, useEffect } from "react";

export default function Portfolio() {
  const [ticker, setTicker] = useState(""); // Champ d'entrée
  const [stocks, setStocks] = useState([]); // Liste des actions

  // Charger les actions sauvegardées en localStorage au démarrage
  useEffect(() => {
    const savedStocks = JSON.parse(localStorage.getItem("stocks")) || [];
    setStocks(savedStocks);
  }, []);

  // Sauvegarder les actions à chaque mise à jour
  useEffect(() => {
    localStorage.setItem("stocks", JSON.stringify(stocks));
  }, [stocks]);

  // Fonction pour récupérer le prix depuis Yahoo Finance
  const fetchStockPrice = async (ticker) => {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`
      );
      const data = await response.json();
      return data.quoteResponse.result[0]?.regularMarketPrice || "N/A";
    } catch (error) {
      console.error("Erreur lors de la récupération des prix :", error);
      return "Erreur";
    }
  };

  // Ajouter une action avec le prix
  const addStock = async () => {
    if (!ticker.trim()) return;
    if (stocks.some(stock => stock.ticker === ticker.toUpperCase())) return; // Évite les doublons

    const price = await fetchStockPrice(ticker.toUpperCase());

    const newStock = { ticker: ticker.toUpperCase(), price: price };
    setStocks([...stocks, newStock]);
    setTicker(""); // Réinitialiser le champ
  };

  // Supprimer une action
  const removeStock = (tickerToRemove) => {
    setStocks(stocks.filter(stock => stock.ticker !== tickerToRemove));
  };

  return (
    <main className="flex flex-col min-h-screen bg-gray-100 p-10">
      {/* Titre */}
      <h1 className="text-4xl font-bold text-[#1E3A8A] mb-6 text-center">
        Mon Portefeuille d'Actions 📊
      </h1>

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

      {/* Tableau des actions */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#1E3A8A] text-white">
            <tr>
              <th className="p-3">Ticker</th>
              <th className="p-3">Prix Actuel</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length > 0 ? (
              stocks.map((stock) => (
                <tr key={stock.ticker} className="border-b">
                  <td className="p-3 font-semibold">{stock.ticker}</td>
                  <td className="p-3 text-gray-600">{stock.price} $</td>
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
