"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Portfolio() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Vérifier l'authentification et charger les actions
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login"); // 🔀 Redirige vers login si non connecté
      return;
    }

    const fetchPortfolio = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/user/portfolio", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Erreur lors de la récupération du portefeuille.");

        const data = await res.json();
        setStocks(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  // Ajouter une action au portefeuille
  const addStock = async () => {
    if (!ticker.trim()) return;
    if (stocks.includes(ticker.toUpperCase())) return; // Évite les doublons

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

      if (!res.ok) throw new Error("Erreur lors de l'ajout de l'action.");

      const updatedPortfolio = await res.json();
      setStocks(updatedPortfolio);
      setTicker(""); // Réinitialiser le champ
    } catch (err) {
      setError(err.message);
    }
  };

  // Supprimer une action du portefeuille
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

      const updatedPortfolio = await res.json();
      setStocks(updatedPortfolio);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-gray-100 p-10">
      <h1 className="text-4xl font-bold text-[#1E3A8A] mb-6 text-center">
        Mon Portefeuille d'Actions 📊
      </h1>

      {error && <p className="text-red-500 text-center">{error}</p>}

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
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="2" className="p-3 text-center">Chargement...</td>
              </tr>
            ) : stocks.length > 0 ? (
              stocks.map((stock) => (
                <tr key={stock} className="border-b">
                  <td className="p-3 font-semibold">{stock}</td>
                  <td className="p-3">
                    <button
                      onClick={() => removeStock(stock)}
                      className="px-4 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" className="p-3 text-center text-gray-500">
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
