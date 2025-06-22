"use client";

import { Pie } from "react-chartjs-2";
import Chart from "chart.js/auto"; // nécessaire pour react-chartjs-2
import { formatCurrencySymbol } from "../portfolio/utils/formats";
import { exchangeToCountry } from "../portfolio/utils/exchangeMap";

export default function Analytics() {
  // Exemple de données factices ; tu remplaceras par un fetch depuis ton API
  const data = {
    labels: ["USD", "EUR"],
    datasets: [
      {
        data: [60, 40],
        // tu peux ajouter backgroundColor, etc. si tu le souhaites
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        position: "bottom",
      },
    },
  };

  return (
    <main className="flex flex-col items-center p-10">
      <h1 className="text-3xl font-bold mb-6">Analytique de Mon Portefeuille</h1>

      <section className="w-full max-w-md mb-12">
        <h2 className="text-2xl mb-4">Répartition USD / EUR</h2>
        <Pie data={data} options={options} />
      </section>

      <section className="w-full max-w-md">
        <h2 className="text-2xl mb-4">Répartition Sectorielle</h2>
        {/* 
          Même principe ici : tu construiras un jeu de données issu de ta BDD,
          avec labels = secteurs et data = proportions 
        */}
        <Pie
          data={{
            labels: ["Technology", "Health", "Energy"],
            datasets: [{ data: [50, 30, 20] }],
          }}
          options={options}
        />
      </section>
    </main>
);
}
