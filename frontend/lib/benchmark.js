// frontend/lib/benchmark.js
// Courbes « base 100 » du portefeuille (historique quotidien) et d'un indice de référence,
// plus une courbe estimée « dividendes réinvestis » (sans appel API : dates reconstituées à partir
// du dernier détachement et de la fréquence, montant = dividende annuel actuel ÷ fréquence).

import { addMonths } from "./dividendCalendar.js";

const isoDay = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Versements estimés entre deux jours (« AAAA-MM-JJ », bornes incluses).
 * positions : sortie de dividendPositions (totalAnnualBase, frequency, lastExDate) ;
 * → [{ date, amount }] triés par date. Les lignes sans montant converti ou sans date connue sont ignorées.
 */
import { performanceSeries } from "./periodPerf.js";

export function estimatePastDividends(positions, from, to) {
  const out = [];
  for (const p of positions || []) {
    const annual = Number(p.totalAnnualBase);
    const freq = Number(p.frequency);
    const anchor = p.lastExDate ? new Date(p.lastExDate) : null;
    if (!(annual > 0) || !(freq > 0) || !anchor || Number.isNaN(anchor.getTime())) continue;
    const step = 12 / freq;
    const amount = annual / freq;
    for (let k = -120; k <= 120; k++) {
      const day = isoDay(addMonths(anchor, k * step));
      if (day >= from && day <= to) out.push({ date: day, amount });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * daily : [{ date, value }] ; index : [{ date, close }] (triés ou non)
 * → { series: [{ date, portfolio, index }], portfolioPct, indexPct } ou null si moins de 2 points communs.
 * Pour chaque jour du portefeuille, l'indice retenu est la dernière clôture connue à cette date
 * (week-ends et jours fériés).
 * payments (optionnel) : [{ date, amount }] de estimatePastDividends → ajoute la courbe « dividendes
 * réinvestis » (`withDividends`) : chaque versement est remis dans le portefeuille à sa valeur du jour.
 * L'indice n'est pas modifié.
 */
export function compareToBenchmark(daily, index, payments = []) {
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  // Courbe du portefeuille : indice hors apports (raccordé à l'ancien historique), sinon valeur totale.
  // `eur` garde la valeur réelle en euros (nécessaire pour remettre les dividendes dans le portefeuille).
  const pts = performanceSeries(daily).series.map((p) => ({ date: p.date, value: p.idx, eur: p.eur }));
  const idx = (index || []).filter((p) => Number(p.close) > 0).sort(byDate);
  if (pts.length < 2 || !idx.length) return null;

  const rows = [];
  let j = -1;
  for (const p of pts) {
    while (j + 1 < idx.length && idx[j + 1].date <= p.date) j++;
    if (j >= 0) rows.push({ date: p.date, value: p.value, eur: p.eur, close: idx[j].close });
  }
  if (rows.length < 2) return null;

  const v0 = rows[0].value;
  const c0 = rows[0].close;
  // Chaque versement s'applique au premier jour de l'historique égal ou postérieur à sa date
  // (ceux d'avant le début ou d'après la fin sont ignorés) : le total versé est remis dans le portefeuille.
  const byRow = new Map();
  for (const p of payments || []) {
    if (!p?.date || !(Number(p.amount) > 0) || p.date <= rows[0].date) continue;
    const i = rows.findIndex((r) => r.date >= p.date);
    if (i > 0) byRow.set(i, (byRow.get(i) || 0) + Number(p.amount));
  }
  let factor = 1;
  const series = rows.map((r, i) => {
    if (byRow.has(i)) factor *= 1 + byRow.get(i) / r.eur;
    const point = {
      date: r.date,
      portfolio: Math.round((r.value / v0) * 10000) / 100,
      index: Math.round((r.close / c0) * 10000) / 100,
    };
    if (byRow.size) point.withDividends = Math.round((r.value / v0) * factor * 10000) / 100;
    return point;
  });
  const last = series[series.length - 1];
  const out = { series, portfolioPct: last.portfolio - 100, indexPct: last.index - 100, from: rows[0].date };
  if (byRow.size) out.dividendsPct = last.withDividends - 100;
  return out;
}

export const BENCH_PERIODS = [
  { key: "1m", label: "1 M", months: 1 },
  { key: "3m", label: "3 M", months: 3 },
  { key: "6m", label: "6 M", months: 6 },
  { key: "ytd", label: "Cette année", ytd: true },
  { key: "all", label: "Tout" },
];

/** Garde les jours de l'historique compris dans la période (jusqu'au dernier jour connu) ; « all » = tout */
export function sliceDaily(daily, periodKey) {
  const period = BENCH_PERIODS.find((p) => p.key === periodKey);
  const pts = (daily || []).filter((p) => p?.date);
  if (!period || period.key === "all" || !pts.length) return pts;
  const last = pts.reduce((m, p) => (p.date > m ? p.date : m), pts[0].date);
  const d = new Date(`${last}T12:00:00Z`);
  let from;
  if (period.ytd) from = `${d.getUTCFullYear()}-01-01`;
  else {
    d.setUTCMonth(d.getUTCMonth() - period.months);
    from = d.toISOString().slice(0, 10);
  }
  return pts.filter((p) => p.date >= from);
}

/** Écart en points de % entre le portefeuille et l'indice (positif = le portefeuille fait mieux) */
export function gapPoints(cmp) {
  return cmp ? cmp.portfolioPct - cmp.indexPct : null;
}
