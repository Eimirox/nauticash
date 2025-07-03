"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pie } from "react-chartjs-2";
import Chart from "chart.js/auto";
import { formatCurrencySymbol } from "../portfolio/utils/formats";
import PortfolioHistoryChart from "./PortfolioHistoryChart";

export default function Analytics() {
  const router = useRouter();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vue");

// Ajouter cash depuis localStorage
const [cash, setCash] = useState({ amount: 0, currency: "EUR" });

  useEffect(() => {
    const saved = localStorage.getItem("cashData");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.amount === "number" && typeof parsed.currency === "string") {
          setCash(parsed);
        }
      } catch (err) {
        console.error("Erreur parsing cash:", err);
      }
    }
  }, []);

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5000/api/user/portfolio", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setStocks(data.stocks || []);
        setCash(data.cash || { amount: 0, currency: "EUR" });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  // Totaux par devise
  const totalsPerCurrency = stocks.reduce((acc, s) => {
    const val = (s.close || 0) * (s.quantity || 0);
    acc[s.currency] = (acc[s.currency] || 0) + val;
    return acc;
  }, {});

  // Totaux par secteur (tenu compte d'une éventuelle composition ETF)
  const totalsPerSector = stocks.reduce((acc, s) => {
    const val = (s.close || 0) * (s.quantity || 0);
    if (s.composition && typeof s.composition === "object") {
      // répartir selon la composition { secteur: %, ... }
      Object.entries(s.composition).forEach(([sect, pct]) => {
        acc[sect] = (acc[sect] || 0) + (val * pct) / 100;
      });
    // Ajouter le cash dans un secteur dédié
    if (!isNaN(cashAmount) && cashCurrency) {
      const secteurCash = cashAmount < 0 ? "Dette" : "Cash";
      totalsPerSector[secteurCash] = (totalsPerSector[secteurCash] || 0) + Math.abs(cashAmount);
    }
    } else {
      // action classique
      const sect = s.sector || "Unknown";
      acc[sect] = (acc[sect] || 0) + val;
    }
    return acc;
  }, {});

  // Couleurs
  const currencyColorMap = { USD: "#10B981", EUR: "#3B82F6" };
  const category10 = [
    "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728",
    "#9467BD", "#8C564B", "#E377C2", "#7F7F7F",
    "#BCBD22", "#17BECF"
  ];

  // Données Pie Devise
  const curLabels = Object.keys(totalsPerCurrency);
  const curData   = Object.values(totalsPerCurrency);
  const pieDevise = {
    labels: curLabels,
    datasets: [{
      data: curData,
      backgroundColor: curLabels.map(c => currencyColorMap[c] || "#9CA3AF"),
    }],
  };

  // Données Pie Secteur
  const secLabels = Object.keys(totalsPerSector);
  const secData   = Object.values(totalsPerSector);
  const pieSecteur = {
    labels: secLabels,
    datasets: [{
      data: secData,
      backgroundColor: secLabels.map((_, i) => category10[i % category10.length]),
    }],
  };

  // Formatage des nombres
  const numberFormatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Options communes aux graphiques
  const pieOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label(ctx) {
            const raw = ctx.parsed;
            const formatted = numberFormatter.format(raw);
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total ? ((raw / total) * 100).toFixed(2) : 0;
            return `${ctx.label}: ${formatted} (${pct}%)`;
          }
        }
      }
    }
  };

  return (
    <main className="p-10">
      <button
        onClick={() => router.push("/portfolio")}
        className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Retour au portefeuille
      </button>

      <h1 className="text-3xl font-bold mb-6">Analytique de Mon Portefeuille</h1>

      <nav className="mb-8 border-b">
        {[
          { key: "vue", label: "Vue" },
          { key: "o1",  label: "Onglet 1" },
          { key: "o2",  label: "Onglet 2" },
          { key: "o3",  label: "Onglet 3" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`mr-4 pb-2 ${
              activeTab === tab.key
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "vue" && (
        <section>
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Informations générales</h2>
            {loading ? (
              <p>Chargement…</p>
            ) : (
              <ul className="space-y-2">
                {curLabels.map(cur => (
                  <li key={cur}>
                    Total en <strong>{cur}</strong> :{" "}
                    <strong>
                      {numberFormatter.format(totalsPerCurrency[cur])}{" "}
                      {formatCurrencySymbol(cur)}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="w-full p-4" style={{ background: "transparent", boxShadow: "none", height: 320 }}>
              <h3 className="text-xl mb-2">Répartition Devise</h3>
              <Pie data={pieDevise} options={pieOptions} height={400} />
            </div>
            <div className="w-full p-4" style={{ background: "transparent", boxShadow: "none", height: 320 }}>
              <h3 className="text-xl mb-2">Répartition Sectorielle</h3>
              <Pie data={pieSecteur} options={pieOptions} height={400} />
            </div>
          </div>

          <div className="mt-10 bg-white p-4 rounded shadow-md">
            <h3 className="text-xl mb-4">Évolution de la Valeur du Portefeuille</h3>
            <PortfolioHistoryChart />
          </div>
        </section>
      )}

      {activeTab !== "vue" && (
        <section>
          <p>Contenu « {activeTab} » à venir…</p>
        </section>
      )}
    </main>
  );
}
