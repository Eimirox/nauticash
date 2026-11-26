// frontend/lib/calendarPerf.js
// Performance par mois civil, par année civile et depuis le début.
//
// Source principale : l'historique quotidien (GET /api/user/history/daily) et son indice « perf »
// (base 100, rendement des cours des lignes détenues la veille) → performance HORS apports et retraits.
// Gain = somme des gains journaliers (dayGain) ; Apports / retraits = variation de valeur − gain.
//
// Avant le début du suivi quotidien : relevé mensuel (GET /api/user/history), simple variation de la valeur
// totale, apports inclus (approx = true, apports / retraits inconnus).
// Les dividendes ne sont pas comptés (performance des cours, comme le bandeau « Performance par période »).

import { performanceSeries } from "./periodPerf.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Mois (1-12) depuis « June », « 6 » ou 6 ; null si illisible */
export function monthNumber(month) {
  if (typeof month === "number") return month >= 1 && month <= 12 ? month : null;
  const byName = MONTH_NAMES.indexOf(String(month));
  if (byName >= 0) return byName + 1;
  const n = parseInt(month, 10);
  return n >= 1 && n <= 12 ? n : null;
}

const pad = (n) => String(n).padStart(2, "0");
const monthIndex = (key) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;

/**
 * Fins de mois : dernier point quotidien de chaque mois ; pour les mois antérieurs au premier
 * point quotidien, la valeur du relevé mensuel.
 * → [{ key: "AAAA-MM", date, eur, idx, legacy, monthly }] trié
 */
function monthEnds(series, history) {
  const ends = new Map();
  for (const p of series) ends.set(p.date.slice(0, 7), p); // série triée : le dernier point du mois gagne
  const firstDaily = series.length ? series[0].date.slice(0, 7) : null;

  const out = [...ends].map(([key, p]) => ({ key, date: p.date, eur: p.eur, idx: p.idx, legacy: p.legacy, monthly: false }));
  for (const h of history || []) {
    const m = monthNumber(h?.month);
    const y = Number(h?.year);
    const value = Number(h?.value);
    if (!m || !Number.isFinite(y) || !Number.isFinite(value)) continue;
    const key = `${y}-${pad(m)}`;
    if (firstDaily && key >= firstDaily) continue; // le quotidien fait foi dès qu'il existe
    // « -31 » : borne de fin de mois en comparaison de chaînes
    out.push({ key, date: `${key}-31`, eur: value, idx: null, legacy: true, monthly: true });
  }
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Performance entre deux fins de période (prev exclu, cur inclus) */
function between(prev, cur, series) {
  const inside = series.filter((p) => p.date > prev.date && p.date <= cur.date);
  // Exacte si la période ne repose que sur l'indice : aucun point « ancien historique » dedans,
  // et une référence prise dans le quotidien (le dernier point sans indice sert de raccord à 100).
  const exact =
    !prev.monthly &&
    !cur.legacy &&
    inside.every((p) => !p.legacy) &&
    prev.idx > 0 &&
    cur.idx > 0;

  let pct = null;
  let amount;
  let flows = null;
  if (exact) {
    pct = (cur.idx / prev.idx - 1) * 100;
    amount = inside.reduce((sum, p) => sum + (Number(p.dayGain) || 0), 0);
    flows = cur.eur - prev.eur - amount;
  } else {
    amount = cur.eur - prev.eur;
    if (prev.eur > 0) pct = (cur.eur / prev.eur - 1) * 100;
  }
  return {
    startValue: prev.eur,
    endValue: cur.eur,
    pct: Number.isFinite(pct) ? pct : null,
    amount,
    flows,
    approx: !exact,
    from: prev.date,
    to: cur.date,
  };
}

/**
 * daily : [{ date, value, perf?, dayGain? }] ; history : [{ year, month, value }]
 * → {
 *   monthly: [{ key, year, month, ...perf, partial, gapMonths }],  // partial : mois précédent absent (gapMonths mois couverts)
 *   yearly:  [{ year, monthsCount, ...perf, partial }],             // partial : pas de fin d'année précédente (ou pas de décembre)
 *   total:   { ...perf } | null,
 * }
 * perf = { startValue, endValue, pct, amount, flows, approx, from, to } ; pct null si la valeur de départ est nulle.
 */
export function calendarPerformance(daily, history) {
  const { series } = performanceSeries(daily);
  const ends = monthEnds(series, history);

  const monthly = [];
  for (let i = 1; i < ends.length; i++) {
    const prev = ends[i - 1];
    const cur = ends[i];
    const gapMonths = monthIndex(cur.key) - monthIndex(prev.key);
    monthly.push({
      key: cur.key,
      year: Number(cur.key.slice(0, 4)),
      month: Number(cur.key.slice(5, 7)),
      ...between(prev, cur, series),
      partial: gapMonths > 1,
      gapMonths,
    });
  }

  const years = [...new Set(ends.map((e) => Number(e.key.slice(0, 4))))].sort((a, b) => a - b);
  const yearly = [];
  for (const year of years) {
    const inYear = ends.filter((e) => Number(e.key.slice(0, 4)) === year);
    const cur = inYear[inYear.length - 1];
    const before = ends.filter((e) => Number(e.key.slice(0, 4)) < year);
    let prev = before[before.length - 1] || null;
    let partial = !prev || prev.key !== `${year - 1}-12`;
    if (!prev) prev = inYear[0];
    if (prev === cur) continue; // un seul relevé dans l'année et rien avant
    yearly.push({ year, monthsCount: inYear.length, ...between(prev, cur, series), partial });
  }

  const total = ends.length >= 2 ? between(ends[0], ends[ends.length - 1], series) : null;
  // Depuis le début : si le suivi quotidien démarre en cours de mois, partir de son premier jour
  const totalDaily =
    series.length >= 2 && !ends[0].monthly && ends[0].date !== series[0].date
      ? between({ ...series[0], monthly: false }, ends[ends.length - 1], series)
      : null;

  return { monthly, yearly, total: totalDaily || total };
}
