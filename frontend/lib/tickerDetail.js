// frontend/lib/tickerDetail.js
// Page détail d'un titre : poids de la ligne dans le portefeuille et synthèse du cours sur 1 an.

/**
 * Poids de la ligne (en %) dans la valeur des titres détenus (hors liquidités),
 * montants convertis dans la devise de référence avec toBase(montant, devise) (null si non convertible).
 * null si la ligne est absente, si une ligne n'est pas convertible (taux absents) ou si le total est nul.
 */
export function positionWeight(stocks, ticker, toBase) {
  const key = String(ticker || "").toUpperCase();
  let total = 0;
  let mine = null;
  for (const s of stocks || []) {
    const v = toBase((Number(s.close) || 0) * (Number(s.quantity) || 0), s.currency);
    if (v == null || !Number.isFinite(v)) return null;
    total += v;
    if (String(s.ticker).toUpperCase() === key) mine = v;
  }
  return mine != null && total > 0 ? (mine / total) * 100 : null;
}

/**
 * points : [{ date: "AAAA-MM-JJ", close }] (ordre quelconque)
 * → { first, last, changePct, min, max, from, to, series (points triés) } ou null s'il y a moins de 2 cours exploitables.
 */
export function priceSummary(points) {
  const valid = (points || [])
    .filter((p) => p && typeof p.date === "string" && Number.isFinite(Number(p.close)) && Number(p.close) > 0)
    .map((p) => ({ date: p.date, close: Number(p.close) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (valid.length < 2) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  let min = first;
  let max = first;
  for (const p of valid) {
    if (p.close < min.close) min = p;
    if (p.close > max.close) max = p;
  }
  return {
    first: first.close,
    last: last.close,
    changePct: ((last.close - first.close) / first.close) * 100,
    min,
    max,
    from: first.date,
    to: last.date,
    series: valid,
  };
}
