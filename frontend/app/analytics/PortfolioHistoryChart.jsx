"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function PortfolioHistoryChart() {
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ date: "", value: "" });
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  useEffect(() => {
    const savedStart = localStorage.getItem("historyStartYear");
    const savedEnd = localStorage.getItem("historyEndYear");
    if (savedStart) setStartYear(savedStart);
    if (savedEnd) setEndYear(savedEnd);
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/user/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(data);
    };
    fetchHistory();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const payload = {
      date: form.date,
      value: parseFloat(form.value),
    };
    if (!isNaN(payload.value) && form.date) {
      await fetch("http://localhost:5000/api/user/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const res = await fetch("http://localhost:5000/api/user/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = await res.json();
      setHistory(updated);
      setForm({ date: "", value: "" });
    }
  };

  const filtered = history.filter(({ year }) => {
    const y = parseInt(year);
    const min = parseInt(startYear) || 0;
    const max = parseInt(endYear) || 9999;
    return y >= min && y <= max;
  });

  const transformed = filtered.map((item) => ({
    date: `${item.year}-${item.month}`,
    value: item.value,
  }));

  const sortedData = [...transformed].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="p-4 bg-white rounded shadow-md mt-8">
      <h2 className="text-xl font-bold mb-4 text-blue-800">Historique du Portefeuille</h2>

      {/* Filtre de plage */}
      <div className="flex gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm">Année de début</label>
          <input
            type="number"
            value={startYear}
            onChange={(e) => {
              const val = e.target.value;
              setStartYear(val);
              localStorage.setItem("historyStartYear", val);
            }}
            className="border p-2 rounded w-32"
          />
        </div>
        <div>
          <label className="block text-sm">Année de fin</label>
          <input
            type="number"
            value={endYear}
            onChange={(e) => {
              const val = e.target.value;
              setEndYear(val);
              localStorage.setItem("historyEndYear", val);
            }}
            className="border p-2 rounded w-32"
          />
        </div>
      </div>

      {/* Formulaire d'ajout */}
      <form onSubmit={handleSubmit} className="flex gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm">Date (AAAA-MM)</label>
          <input
            type="month"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
            className="border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm">Valeur (€)</label>
          <input
            type="number"
            step="0.01"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            required
            className="border p-2 rounded"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Ajouter
        </button>
      </form>

      {/* Graphique */}
      {sortedData.length === 0 ? (
        <p className="text-gray-500 italic">Aucune donnée sur la période sélectionnée.</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={sortedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const [year, month] = value.split("-");
                return new Date(`${value}-01`).toLocaleString("default", {
                  month: "short",
                  year: "2-digit",
                });
              }}
              interval={0}
              angle={-40}
              textAnchor="end"
            />
            <YAxis
              tickFormatter={(v) => v.toLocaleString("fr-FR")}
              domain={['dataMin - 1000', 'dataMax + 1000']}
            />
            <Tooltip formatter={(val) => `${val.toLocaleString("fr-FR")} €`} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#1E3A8A"
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: "#1E3A8A", fill: "white" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
