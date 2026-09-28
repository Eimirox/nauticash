// frontend/lib/periodPerf.js
// Performance par période à partir de l'historique quotidien (GET /api/user/history/daily).
// Il s'agit de la variation de la valeur du portefeuille : les achats et ventes de la
// période sont inclus (ce n'est pas une performance « pondérée dans le temps »).

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
  const pts = (points || [])
    .filter((p) => p && p.date && Number.isFinite(Number(p.value)))
    .map((p) => ({ date: p.date, value: Number(p.value) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (pts.length < 2) {
    return periods.map((p) => ({ key: p.key, label: p.label, pct: null, amount: null, from: null, partial: false }));
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
      return { key: period.key, label: period.label, pct: null, amount: null, from: ref.date, partial };
    }
    const amount = last.value - ref.value;
    return {
      key: period.key,
      label: period.label,
      amount,
      pct: ref.value > 0 ? (amount / ref.value) * 100 : null,
      from: ref.date,
      partial,
    };
  });
}
