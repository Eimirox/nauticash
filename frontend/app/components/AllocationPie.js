"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const numberFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctShort = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/**
 * Camembert de répartition (recharts, seule librairie de graphiques du site).
 * slices : [{ label, value, color }]. Le conteneur parent fixe la hauteur
 * et porte le résumé texte (role="img" + aria-label).
 */
export default function AllocationPie({ slices }) {
  // Aucune part ne partage sa couleur avec une autre : le tableau de données porte la couleur de chaque part
  const data = slices.filter((s) => Number(s.value) > 0);
  const total = data.reduce((sum, s) => sum + Number(s.value), 0);

  const formatTooltip = (value, name) => {
    const pct = total ? pctFormatter.format((Number(value) / total) * 100) : "0";
    // Mode discret : pourcentage seulement
    if (document.documentElement.classList.contains("discreet")) return [`${pct} %`, name];
    return [`${numberFormatter.format(Number(value))} (${pct} %)`, name];
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="45%"
          outerRadius="80%"
          stroke="rgb(var(--surface))"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((s) => (
            <Cell key={s.label} fill={s.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={formatTooltip}
          contentStyle={{ background: "rgba(0, 0, 0, 0.8)", border: "none", borderRadius: 8, padding: 12 }}
          itemStyle={{ color: "#fff", fontSize: 13 }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={10}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value, entry) => {
            // Part en % dans la légende : on lit la valeur sans repasser par la couleur
            const v = Number(entry?.payload?.value ?? entry?.payload?.payload?.value);
            const pct = total && Number.isFinite(v) ? ` ${pctShort.format((v / total) * 100)} %` : "";
            return (
              <span style={{ color: "rgb(var(--text-muted))" }}>
                {value}
                <span className="tabular-nums">{pct}</span>
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
