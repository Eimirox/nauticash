// frontend/lib/portfolioEvolution.js
// Calculs du graphique « Évolution du portefeuille » : relevés mensuels, variation vs mois N-1,
// dernier relevé valide. Fonctions pures, testées (`cd frontend && npm test`).

export const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

// Le backend a renvoyé tour à tour un numéro, « 04 » ou le nom anglais du mois
const MONTH_MAP = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

/** Numéro de mois (1 à 12) depuis un nombre, « 04 » ou « April » ; null si inconnu */
export function monthNumber(month) {
  if (typeof month === "number") return month >= 1 && month <= 12 ? month : null;
  const parsed = parseInt(month, 10);
  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
  return MONTH_MAP[month] || null;
}

/**
 * Relevés exploitables : année et mois valides, valeur strictement positive.
 * Un mois sans relevé (ou à 0 €, ex. « décembre » créé à vide) n'existe pas pour le graphique.
 * Doublon sur un même mois : le dernier de la liste gagne.
 */
export function validSnapshots(history) {
  const byKey = new Map();
  for (const item of Array.isArray(history) ? history : []) {
    const year = parseInt(item?.year, 10);
    const month = monthNumber(item?.month);
    const value = Number(item?.value);
    if (!Number.isInteger(year) || !month || !Number.isFinite(value) || !(value > 0)) continue;
    byKey.set(year * 12 + (month - 1), { year, month, value });
  }
  return byKey;
}

/** Variation entre deux valeurs : { pct, delta } ; null si la valeur de départ est absente ou nulle */
export function variation(previous, current) {
  const p = Number(previous);
  const c = Number(current);
  if (!Number.isFinite(p) || !Number.isFinite(c) || !(p > 0)) return null;
  return { pct: ((c - p) / p) * 100, delta: c - p };
}

/**
 * 12 mois fixes, une valeur par année sélectionnée :
 *  - `year2026` : valeur du mois (null sans relevé) ;
 *  - `pct2026` / `delta2026` : variation en % et en valeur vs le mois N-1 (null sans relevé du mois précédent ;
 *    janvier se compare à décembre de l'année d'avant).
 */
export function evolutionRows(history, years) {
  const snaps = validSnapshots(history);
  return MONTH_LABELS.map((label, i) => {
    const monthNum = i + 1;
    const row = { monthNum, month: label };
    for (const year of years) {
      const cur = snaps.get(year * 12 + i);
      const prev = snaps.get(year * 12 + i - 1);
      const v = cur && prev ? variation(prev.value, cur.value) : null;
      row[`year${year}`] = cur ? cur.value : null;
      row[`pct${year}`] = v ? v.pct : null;
      row[`delta${year}`] = v ? v.delta : null;
    }
    return row;
  });
}

/** Dernier relevé valide (valeur > 0) et sa variation vs mois N-1 ; null s'il n'y en a aucun */
export function lastSnapshot(history) {
  const snaps = validSnapshots(history);
  if (!snaps.size) return null;
  const key = Math.max(...snaps.keys());
  const cur = snaps.get(key);
  const prev = snaps.get(key - 1);
  const v = prev ? variation(prev.value, cur.value) : null;
  return { year: cur.year, month: cur.month, value: cur.value, pct: v ? v.pct : null, delta: v ? v.delta : null };
}

/** Années disponibles (relevés valides uniquement), de la plus récente à la plus ancienne */
export function availableYears(history) {
  return [...new Set([...validSnapshots(history).values()].map((s) => s.year))].sort((a, b) => b - a);
}

/** Sens d'une variation pour l'affichage : « up », « down », « flat » ou « none » (pas de mois précédent) */
export function direction(pct) {
  if (pct == null || !Number.isFinite(pct)) return "none";
  if (Math.abs(pct) < 0.05) return "flat"; // −0,0 % / +0,0 % : stable
  return pct > 0 ? "up" : "down";
}

const pctFmt = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** « ▲ +3,2 % », « ▼ −1,5 % », « = 0,0 % » ou « — » (jamais la couleur seule : flèche et signe) */
export function formatVariation(pct) {
  const dir = direction(pct);
  if (dir === "none") return "—";
  if (dir === "flat") return "= 0,0 %";
  const arrow = dir === "up" ? "▲" : "▼";
  const sign = dir === "up" ? "+" : "−";
  return `${arrow} ${sign}${pctFmt.format(Math.abs(pct))} %`;
}
