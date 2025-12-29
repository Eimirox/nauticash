"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Mapping mois anglais -> numéro
const MONTH_MAP = {
  "January": 1, "February": 2, "March": 3, "April": 4,
  "May": 5, "June": 6, "July": 7, "August": 8,
  "September": 9, "October": 10, "November": 11, "December": 12
};

export default function PortfolioHistoryChart() {
  const [history, setHistory] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [manualForm, setManualForm] = useState({ date: "", value: "" });
  const [usdToEur, setUsdToEur] = useState(0.92);

  const yearColors = {
    2023: "#6B7280",
    2024: "#3B82F6",
    2025: "#10B981",
    2026: "#F59E0B",
    2027: "#8B5CF6",
    2028: "#EC4899",
  };

  // Convertir mois (string ou number) en numéro
  const getMonthNumber = (month) => {
    // Si c'est déjà un nombre
    if (typeof month === 'number') return month;
    
    // Si c'est un string numérique "04"
    const parsed = parseInt(month);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
    
    // Si c'est un nom en anglais "April"
    return MONTH_MAP[month] || null;
  };

  // Fetch taux de change
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

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/user/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      console.log("📊 Données reçues:", data);
      setHistory(data);

      // Extraire années
      const years = [...new Set(data.map((item) => parseInt(item.year)))].sort(
        (a, b) => b - a
      );
      setAvailableYears(years);
      console.log("📅 Années:", years);

      // Auto-sélection
      if (years.length > 0 && selectedYears.length === 0) {
        const toSelect = years.slice(0, Math.min(2, years.length));
        setSelectedYears(toSelect);
        console.log("✅ Années sélectionnées:", toSelect);
      }

      // Dernier snapshot
      if (data.length > 0) {
        const sorted = [...data].sort((a, b) => {
          const yearDiff = b.year - a.year;
          if (yearDiff !== 0) return yearDiff;
          return getMonthNumber(b.month) - getMonthNumber(a.month);
        });
        setLastSnapshot({
          year: sorted[0].year,
          month: sorted[0].month,
          value: sorted[0].value,
        });
      }
    } catch (err) {
      console.error("❌ Erreur:", err);
    }
  };

  const saveManualSnapshot = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const [year, month] = manualForm.date.split("-");
      const value = parseFloat(manualForm.value);

      if (isNaN(value) || !year || !month) {
        alert("❌ Valeur ou date invalide");
        return;
      }

      await fetch("http://localhost:5000/api/user/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date: manualForm.date, value }),
      });

      await fetchHistory();
      setManualForm({ date: "", value: "" });
      setShowManualEdit(false);
      alert(`✅ Sauvegardé : ${value.toFixed(2)}€`);
    } catch (err) {
      console.error(err);
      alert("❌ Erreur");
    } finally {
      setLoading(false);
    }
  };

  const saveSnapshot = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const portfolioRes = await fetch("http://localhost:5000/api/user/portfolio", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const portfolioData = await portfolioRes.json();

      let totalValueEUR = 0;
      
      (portfolioData.stocks || []).forEach((stock) => {
        const value = (stock.close || 0) * (stock.quantity || 0);
        if (stock.currency === "USD") {
          totalValueEUR += value * usdToEur;
        } else {
          totalValueEUR += value;
        }
      });

      const cashValue = portfolioData.cash?.amount || 0;
      if (portfolioData.cash?.currency === "USD") {
        totalValueEUR += cashValue * usdToEur;
      } else {
        totalValueEUR += cashValue;
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");

      await fetch("http://localhost:5000/api/user/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: `${year}-${month}`,
          value: totalValueEUR,
        }),
      });

      await fetchHistory();
      alert(`✅ Snapshot : ${totalValueEUR.toFixed(2)}€`);
    } catch (err) {
      console.error(err);
      alert("❌ Erreur");
    } finally {
      setLoading(false);
    }
  };

  const toggleYear = (year) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  // Transformer données - 12 MOIS FIXES
  const transformData = () => {
    const months = [
      { monthNum: 1, month: "Jan" },
      { monthNum: 2, month: "Fév" },
      { monthNum: 3, month: "Mar" },
      { monthNum: 4, month: "Avr" },
      { monthNum: 5, month: "Mai" },
      { monthNum: 6, month: "Juin" },
      { monthNum: 7, month: "Juil" },
      { monthNum: 8, month: "Août" },
      { monthNum: 9, month: "Sep" },
      { monthNum: 10, month: "Oct" },
      { monthNum: 11, month: "Nov" },
      { monthNum: 12, month: "Déc" },
    ];

    return months.map((monthData) => {
      const result = { ...monthData };

      selectedYears.forEach((year) => {
        const found = history.find((item) => {
          const itemYear = parseInt(item.year);
          const itemMonth = getMonthNumber(item.month);
          return itemYear === year && itemMonth === monthData.monthNum;
        });
        
        if (found) {
          result[`year${year}`] = found.value;
        }
      });

      return result;
    });
  };

  const chartData = transformData();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry, index) => {
            if (entry.value != null) {
              return (
                <p key={index} className="text-sm" style={{ color: entry.color }}>
                  {entry.name}: {entry.value.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}€
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }
    return null;
  };

  const hasData = history.length > 0 && selectedYears.length > 0;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Comparer :</span>
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-all ${
                selectedYears.includes(year)
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              style={
                selectedYears.includes(year)
                  ? { borderColor: yearColors[year] || "#10B981" }
                  : {}
              }
            >
              {year}
            </button>
          ))}
          {availableYears.length === 0 && (
            <span className="text-sm text-slate-500 italic">Aucune donnée</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualEdit(!showManualEdit)}
            className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Éditer
          </button>
          <button
            onClick={saveSnapshot}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-blue-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sauvegarde...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Snapshot auto
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info taux */}
      <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        💱 Taux USD→EUR : {usdToEur.toFixed(4)}
      </div>

      {/* Édition manuelle */}
      {showManualEdit && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Ajouter/Modifier</h4>
          <form onSubmit={saveManualSnapshot} className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
              <input
                type="month"
                value={manualForm.date}
                onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                required
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Valeur (€)</label>
              <input
                type="number"
                step="0.01"
                value={manualForm.value}
                onChange={(e) => setManualForm({ ...manualForm, value: e.target.value })}
                required
                placeholder="15000.00"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-32"
              />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition">
                Sauvegarder
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowManualEdit(false);
                  setManualForm({ date: "", value: "" });
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dernier snapshot */}
      {lastSnapshot && (
        <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span>Dernier : {lastSnapshot.month} {lastSnapshot.year}</span>
          </div>
          <span className="font-semibold text-slate-900">
            {lastSnapshot.value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </span>
        </div>
      )}

      {/* Chart */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium mb-1">
            {history.length === 0 ? "Aucune donnée" : "Sélectionnez une année"}
          </p>
          <p className="text-sm mb-4">
            {history.length === 0 ? "Créez votre premier snapshot" : "Cliquez sur une année ci-dessus"}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "#64748B", fontSize: 12 }}
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                return `${value}`;
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: "20px" }} formatter={(value) => value.replace("year", "")} />
            {selectedYears.map((year) => (
              <Bar
                key={year}
                dataKey={`year${year}`}
                name={`${year}`}
                fill={yearColors[year] || "#9CA3AF"}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Astuce */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">💡 Snapshot mensuel</p>
            <p className="text-blue-700">
              Le "Snapshot auto" calcule la valeur totale (stocks + cash) et convertit USD→EUR automatiquement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
