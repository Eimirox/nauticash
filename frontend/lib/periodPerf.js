// frontend/lib/periodPerf.js
// Performance par période à partir de l'historique quotidien (GET /api/user/history/daily).
// Quand l'historique contient l'indice « perf » (base 100, calculé sur les cours des lignes détenues la veille),
// la performance est pondérée dans le temps : apports, retraits et changements de lignes n'ont aucun effet.
// Sinon (photos d'avant ce suivi), repli sur la variation de la valeur totale, achats et ventes inclus (approx = true).

export const PERIODS = [
  { key: "1d", label: "1 J", days: 1 },
  { key: "7d", label: "7 J", days: 7 },
  { key: "1m", label: "1 M", months: 1 },
  { key: "ytd", label: "Depuis le 1er janvier", ytd: true },
  { key: "1y", label: "1 an", months: 12 },
];

const toDate = (key) => new Date(`${key}T12:00:00Z`);

function startOf(period, end) {
  const d = new Date(end);
  if (period.days) d.setUTCDate(d.getUTCDate() - period.days);
  else if (period.months) d.setUTCMonth(d.getUTCMonth() - period.months);
  else if (period.ytd) return new Date(Date.UTC(end.getUTCFullYear() - 1, 11, 31, 12));
  return d;
}

/**
 * Série de performance continue, base commune « idx » :
 * - tant qu'il y a moins de 2 photos avec indice (`perf`), simple valeur totale (indexed = false) ;
 * - sinon, l'indice à partir de la première photo qui en a un, PRÉCÉDÉ de l'ancien historique (sans indice)
 *   remis à l'échelle pour se raccorder à 100 : le jour de raccord compte pour un rendement nul (on ne peut pas
 *   savoir ce qui a bougé ce jour-là), et l'ancien historique reste approximatif (apports inclus, legacy = true).
 * Chaque point : { date, idx, eur (valeur réelle en €), dayGain (€, null pour l'ancien historique), legacy }.
 */
export function performanceSeries(points) {
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const clean = (points || []).filter((p) => p && p.date && Number.isFinite(Number(p.value)) && Number(p.value) > 0);
  const withPerf = clean.filter((p) => Number(p.perf) > 0).sort(byDate);
  if (withPerf.length < 2) {
    return {
      indexed: false,
      series: clean
        .map((p) => ({ date: p.date, idx: Number(p.value), eur: Number(p.value), dayGain: null, legacy: true }))
        .sort(byDate),
    };
  }
  const first = withPerf[0];
  const legacy = clean.filter((p) => !(Number(p.perf) > 0) && p.date < first.date).sort(byDate);
  const anchor = legacy.length ? legacy[legacy.length - 1] : null;
  const series = [];
  if (anchor) {
    for (const p of legacy) {
      series.push({ date: p.date, idx: (100 * Number(p.value)) / Number(anchor.value), eur: Number(p.value), dayGain: null, legacy: true });
    }
  }
  for (const p of withPerf) {
    series.push({ date: p.date, idx: Number(p.perf), eur: Number(p.value), dayGain: Number(p.dayGain) || 0, legacy: false });
  }
  return { indexed: true, series };
}

/**
 * points : [{ date: "AAAA-MM-JJ", value, perf?, dayGain? }] triés ou non.
 * Renvoie pour chaque période { key, label, pct, amount, from, partial, approx } :
 * - référence = dernier point à la date de début ou avant ;
 * - s'il n'existe pas (historique trop court), premier point disponible et partial = true ;
 * - pct/amount null s'il n'y a pas au moins deux points distincts ;
 * - approx = true si la période s'appuie sur l'ancien historique (variation de la valeur totale, apports inclus).
 */
export function periodPerformance(points, periods = PERIODS) {
  const { indexed, series: pts } = performanceSeries(points);

  if (pts.length < 2) {
    return periods.map((p) => ({ key: p.key, label: p.label, pct: null, amount: null, from: null, partial: false, approx: !indexed }));
  }

  const last = pts[pts.length - 1];
  const end = toDate(last.date);

  return periods.map((period) => {
    const start = startOf(period, end);
    let ref = null;
    for (const p of pts) {
      if (toDate(p.date) <= start) ref = p;
      else break;
    }
    const partial = !ref;
    if (!ref) ref = pts[0];
    const approx = !indexed || ref.legacy;
    if (ref.date === last.date) {
      return { key: period.key, label: period.label, pct: null, amount: null, from: ref.date, partial, approx };
    }
    let amount;
    if (indexed) {
      // Gains journaliers (cours seuls) après la référence ; la part d'ancien historique compte pour la variation de valeur
      const legacyPart = ref.legacy ? pts.filter((p) => p.legacy).slice(-1)[0].eur - ref.eur : 0;
      amount = legacyPart + pts.filter((p) => !p.legacy && p.date > ref.date).reduce((sum, p) => sum + p.dayGain, 0);
    } else {
      amount = last.eur - ref.eur;
    }
    return {
      key: period.key,
      label: period.label,
      amount,
      pct: ref.idx > 0 ? (last.idx / ref.idx - 1) * 100 : null,
      from: ref.date,
      partial,
      approx,
    };
  });
}
