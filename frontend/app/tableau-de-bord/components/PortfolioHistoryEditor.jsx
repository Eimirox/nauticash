"use client";
import { useState } from "react";

export default function PortfolioHistoryEditor({ onUpdate }) {
  const [year, setYear] = useState("2025");
  const [month, setMonth] = useState("June");
  const [amount, setAmount] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!year || !month || !amount) return;
    const value = parseFloat(amount);
    if (isNaN(value)) return;

    onUpdate(year, month, value);
    setAmount("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-x-2 mb-6">
      <input
        type="text"
        placeholder="Année (ex: 2025)"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        className="border px-2 py-1 rounded"
      />
      <input
        type="text"
        placeholder="Mois (ex: June)"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="border px-2 py-1 rounded"
      />
      <input
        type="number"
        placeholder="Montant"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="border px-2 py-1 rounded"
      />
      <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">
        Ajouter
      </button>
    </form>
  );
}
