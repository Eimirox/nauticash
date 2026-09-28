// frontend/lib/benchmark.js
// Courbes « base 100 » du portefeuille (historique quotidien) et d'un indice de référence.

/**
 * daily : [{ date, value }] ; index : [{ date, close }] (triés ou non)
 * → { series: [{ date, portfolio, index }], portfolioPct, indexPct } ou null si moins de 2 points communs.
 * Pour chaque jour du portefeuille, l'indice retenu est la dernière clôture connue à cette date
 * (week-ends et jours fériés).
 */
export function compareToBenchmark(daily, index) {
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const pts = (daily || []).filter((p) => Number(p.value) > 0).sort(byDate);
  const idx = (index || []).filter((p) => Number(p.close) > 0).sort(byDate);
  if (pts.length < 2 || !idx.length) return null;

  const rows = [];
  let j = -1;
  for (const p of pts) {
    while (j + 1 < idx.length && idx[j + 1].date <= p.date) j++;
    if (j >= 0) rows.push({ date: p.date, value: Number(p.value), close: idx[j].close });
  }
  if (rows.length < 2) return null;

  const v0 = rows[0].value;
  const c0 = rows[0].close;
  const series = rows.map((r) => ({
    date: r.date,
    portfolio: Math.round((r.value / v0) * 10000) / 100,
    index: Math.round((r.close / c0) * 10000) / 100,
  }));
  const last = series[series.length - 1];
  return { series, portfolioPct: last.portfolio - 100, indexPct: last.index - 100, from: rows[0].date };
}
