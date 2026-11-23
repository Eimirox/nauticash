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
 * points : [{ date: "AAAA-MM-JJ", value }] triés ou non.
 * Renvoie pour chaque période { key, label, pct, amount, from, partial } :
 * - référence = dernier point à la date de début ou avant ;
 * - s'il n'existe pas (historique trop court), premier point disponible et partial = true ;
 * - pct/amount null s'il n'y a pas au moins deux points distincts.
 */
export function periodPerformance(points, periods = PERIODS) {
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const clean = (points || []).filter((p) => p && p.date && Number.isFinite(Number(p.value)));
  // Indice hors apports : seules les photos qui en ont un, si au moins deux
  const withPerf = clean
    .filter((p) => Number.isFinite(Number(p.perf)) && Number(p.perf) > 0)
    .map((p) => ({ date: p.date, value: Number(p.value), perf: Number(p.perf), dayGain: Number(p.dayGain) || 0 }))
    .sort(byDate);
  const useIndex = withPerf.length >= 2;
  const pts = useIndex
    ? withPerf
    : clean.map((p) => ({ date: p.date, value: Number(p.value) })).sort(byDate);

  if (pts.length < 2) {
    return periods.map((p) => ({ key: p.key, label: p.label, pct: null, amount: null, from: null, partial: false, approx: !useIndex }));
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
    if (ref.date === last.date) {
      return { key: period.key, label: period.label, pct: null, amount: null, from: ref.date, partial, approx: !useIndex };
    }
    if (useIndex) {
      // Gain en euros = somme des gains journaliers (cours seuls) après la date de référence ; % = variation de l'indice
      const amount = pts.filter((p) => p.date > ref.date && p.date <= last.date).reduce((sum, p) => sum + p.dayGain, 0);
      return {
        key: period.key,
        label: period.label,
        amount,
        pct: (last.perf / ref.perf - 1) * 100,
        from: ref.date,
        partial,
        approx: false,
      };
    }
    const amount = last.value - ref.value;
    return {
      key: period.key,
      label: period.label,
      amount,
      pct: ref.value > 0 ? (amount / ref.value) * 100 : null,
      from: ref.date,
      partial,
      approx: true,
    };
  });
}
