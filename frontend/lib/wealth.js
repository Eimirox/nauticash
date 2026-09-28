// frontend/lib/wealth.js
// Synthèse du patrimoine dans la devise de référence (partagée par le portefeuille et la vue d'ensemble).

/**
 * @param stocks positions ({ close, quantity, currency, dayChangeValue, pru })
 * @param cash { amount, currency }
 * @param toBase (montant, devise) => montant converti ou null si la devise n'est pas convertible
 * @returns { missing, total, invested, cash, dayChange, dayChangePct, gain, gainPct }
 */
export function wealthSummary(stocks, cash, toBase) {
  let value = 0, dayChange = 0, prevValue = 0, cost = 0, costedValue = 0, missing = false;
  for (const s of stocks || []) {
    const qty = Number(s.quantity) || 0;
    const v = toBase((s.close || 0) * qty, s.currency);
    if (v === null || v === undefined) { missing = true; continue; }
    value += v;
    if (Number.isFinite(s.dayChangeValue)) {
      const d = toBase(s.dayChangeValue, s.currency) ?? 0;
      dayChange += d;
      prevValue += v - d;
    }
    if (s.pru > 0) {
      cost += toBase(s.pru * qty, s.currency) ?? 0;
      costedValue += v;
    }
  }
  const cashAmount = Number(cash?.amount) || 0;
  const cashBase = cashAmount ? toBase(cashAmount, cash?.currency) : 0;
  if ((cashBase === null || cashBase === undefined) && cashAmount) missing = true;
  return {
    missing,
    total: value + (cashBase ?? 0),
    invested: value,
    cash: cashBase ?? 0,
    dayChange,
    dayChangePct: prevValue > 0 ? (dayChange / prevValue) * 100 : null,
    gain: costedValue - cost,
    gainPct: cost > 0 ? ((costedValue - cost) / cost) * 100 : null,
  };
}

// Type d'actif normalisé (le backend renvoie « Stock », « ETF », « Crypto »…)
export function assetTypeLabel(type) {
  const t = String(type || "").toUpperCase();
  if (t === "STOCK" || t === "EQUITY") return "Actions";
  if (t === "ETF" || t === "FUND" || t === "MUTUALFUND") return "ETF et fonds";
  if (t === "CRYPTO" || t === "CRYPTOCURRENCY") return "Crypto";
  return "Autres";
}

/** Répartition { libellé: montant } par type d'actif, cash positif compris */
export function allocationByType(stocks, cash, toBase) {
  const acc = {};
  for (const s of stocks || []) {
    const v = toBase((s.close || 0) * (Number(s.quantity) || 0), s.currency);
    if (!(v > 0)) continue;
    const key = assetTypeLabel(s.type);
    acc[key] = (acc[key] || 0) + v;
  }
  const c = Number(cash?.amount) || 0;
  if (c > 0) {
    const v = toBase(c, cash?.currency);
    if (v > 0) acc.Cash = (acc.Cash || 0) + v;
  }
  return acc;
}

/**
 * Angle du « cap » (DESIGN.md) : 0° = plein est (stable), vers le haut si hausse.
 * ±3 % et au-delà → ±60°, proportionnel entre les deux.
 */
export function headingAngle(pct) {
  if (!Number.isFinite(pct)) return 0;
  const clamped = Math.max(-3, Math.min(3, pct));
  return -(clamped / 3) * 60;
}
