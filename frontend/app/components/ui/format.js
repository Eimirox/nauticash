// Formats français des montants et pourcentages (voir docs/DESIGN.md)
const SYMBOLS = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF", CAD: "CA$", JPY: "¥" };

export function formatMoney(value, currency = "EUR", { decimals = 2 } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
  return `${n.replace(/^-/, "−")} ${SYMBOLS[currency] || currency}`;
}

export function formatPercent(value, { signed = true, decimals = 2 } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const v = Number(value);
  const n = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(v));
  const sign = !signed || v === 0 ? (v < 0 ? "−" : "") : v > 0 ? "+" : "−";
  return `${sign}${n} %`;
}
