"use client";

import AllocationPie from "./AllocationPie";
import { allocationByType } from "@/lib/wealth";
import { shareSummary } from "@/lib/chartSummary";

// Types d'actif : ordre des séries de DESIGN.md (accent, accent-2, teintes intermédiaires)
export const TYPE_COLORS = {
  "Actions": "#2563EB",
  "ETF et fonds": "#059669",
  "Crypto": "#0891B2",
  "Cash": "#14B8A6",
  "Autres": "#64748B",
};

// Couleurs sectorielles fixes (une famille de teintes par grand secteur)
const SECTOR_COLORS = {
  "Technology": "#10B981",
  "Information Technology": "#10B981",
  "Communication Services": "#8B5CF6",
  "Cryptocurrency": "#F59E0B",
  "Crypto": "#F59E0B",
  "Financial Services": "#4F46E5",
  "Financial": "#4F46E5",
  "Financials": "#4F46E5",
  "Banks": "#6366F1",
  "Insurance": "#818CF8",
  "Healthcare": "#3B82F6",
  "Health Care": "#3B82F6",
  "Biotechnology": "#60A5FA",
  "Energy": "#EAB308",
  "Oil & Gas": "#FBBF24",
  "Consumer Cyclical": "#F97316",
  "Consumer Defensive": "#FB923C",
  "Consumer Discretionary": "#F97316",
  "Consumer Staples": "#FB923C",
  "Industrials": "#6B7280",
  "Industrial": "#6B7280",
  "Basic Materials": "#78716C",
  "Materials": "#78716C",
  "Utilities": "#06B6D4",
  "Real Estate": "#EC4899",
  "Cash": "#22C55E",
  "Dette": "#EF4444",
  "Unknown": "#9CA3AF",
  "Other": "#9CA3AF",
};

const CURRENCY_COLORS = { USD: "#10B981", EUR: "#3B82F6" };

/** Totaux par secteur dans la devise de référence (ETF répartis selon leur composition, cash / dette à part) */
export function totalsBySector(stocks, cash, inBase) {
  const acc = {};
  for (const s of stocks) {
    const valBase = inBase((s.close || 0) * (s.quantity || 0), s.currency);
    if (s.composition && typeof s.composition === "object") {
      for (const [sect, pct] of Object.entries(s.composition)) {
        acc[sect] = (acc[sect] || 0) + (valBase * pct) / 100;
      }
    } else {
      const sect =
        s.sector && s.sector !== "Unknown" ? s.sector : String(s.type).toUpperCase() === "ETF" ? "ETF" : "Non renseigné";
      acc[sect] = (acc[sect] || 0) + valBase;
    }
  }
  if (!isNaN(cash?.amount) && cash?.currency && Math.abs(cash.amount) > 0) {
    const name = cash.amount < 0 ? "Dette" : "Cash";
    acc[name] = (acc[name] || 0) + inBase(Math.abs(cash.amount), cash.currency);
  }
  return acc;
}

/** Totaux par devise de cotation, comparés dans la devise de référence */
export function totalsByCurrency(stocks, inBase) {
  const acc = {};
  for (const s of stocks) {
    if (!s.currency) continue;
    acc[s.currency] = (acc[s.currency] || 0) + inBase((s.close || 0) * (s.quantity || 0), s.currency);
  }
  return acc;
}

function PieCard({ title, icon, rows, colorOf, kind }) {
  const slices = rows.map(([label, value]) => ({ label, value, color: colorOf(label) }));
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-lg">
      <div className="mb-6 flex items-center gap-2">
        <svg className="h-5 w-5 text-accent" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          {icon}
        </svg>
        <h3 className="text-lg font-bold text-ink">{title}</h3>
      </div>
      {slices.length > 0 ? (
        <div
          style={{ height: 320 }}
          role="img"
          aria-label={`Graphique circulaire, ${kind} : ${shareSummary(rows.map(([label, value]) => ({ label, value })))}`}
        >
          <AllocationPie slices={slices} />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Aucune position pour le moment.</p>
      )}
    </div>
  );
}

const ICON_TYPE = (
  <>
    <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
    <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
  </>
);
const ICON_CURRENCY = (
  <path
    fillRule="evenodd"
    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
    clipRule="evenodd"
  />
);
const ICON_SECTOR = (
  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
);

/**
 * Répartition par type d'actif, par devise et par secteur (camemberts recharts).
 * inBase(value, currency) convertit dans la devise de référence ; toBaseOrNull renvoie null si le taux manque.
 */
export default function AllocationBreakdown({ stocks, cash, inBase, toBaseOrNull }) {
  const byType = Object.entries(allocationByType(stocks, cash, toBaseOrNull));
  const byCurrency = Object.entries(totalsByCurrency(stocks, inBase));
  const bySector = Object.entries(totalsBySector(stocks, cash, inBase));

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      <PieCard
        title="Par type d'actif"
        kind="répartition par type d'actif"
        icon={ICON_TYPE}
        rows={byType}
        colorOf={(t) => TYPE_COLORS[t] || TYPE_COLORS.Autres}
      />
      <PieCard
        title="Par devise"
        kind="répartition par devise"
        icon={ICON_CURRENCY}
        rows={byCurrency}
        colorOf={(c) => CURRENCY_COLORS[c] || "#9CA3AF"}
      />
      <PieCard
        title="Par secteur"
        kind="répartition par secteur"
        icon={ICON_SECTOR}
        rows={bySector}
        colorOf={(s) => SECTOR_COLORS[s] || SECTOR_COLORS.Unknown}
      />
    </div>
  );
}
