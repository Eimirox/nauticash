// backend/services/tickerHistory.js
// Cours de clôture quotidiens d'un titre sur 1 an (page détail d'un titre).
// Même principe que les indices (services/benchmarks.js) : un seul appel par titre et par période
// de CACHE_TTL, points gardés en base (collection « ticker_history ») et partagés entre utilisateurs.
// Yahoo d'abord (sans clé ni quota), FMP seulement en repli pour préserver le quota quotidien.

const mongoose = require("mongoose");
const { fetchHistory, fetchHistoryYahoo, CACHE_TTL } = require("./benchmarks");

const YEAR_DAYS = 366;

const collection = () => mongoose.connection.collection("ticker_history");

const lastYear = (points, now = Date.now()) => {
  const cutoff = new Date(now - YEAR_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return points.filter((p) => p.date >= cutoff);
};

async function fetchAny(symbol) {
  try {
    return await fetchHistoryYahoo(symbol);
  } catch (yahooError) {
    try {
      return await fetchHistory(symbol);
    } catch {
      throw yahooError;
    }
  }
}

/**
 * { symbol, points: [{ date, close }], updatedAt, stale }
 * Cache frais → aucun appel ; sinon nouvel appel, et en cas d'échec les dernières données connues
 * avec stale: true (erreur si rien en cache).
 */
async function getTickerHistory(symbol) {
  const cached = await collection().findOne({ symbol });
  const fresh = cached && Date.now() - new Date(cached.updatedAt).getTime() < CACHE_TTL;
  const payload = (doc, stale) => ({ symbol, points: lastYear(doc.points), updatedAt: doc.updatedAt, stale });
  if (fresh) return payload(cached, false);

  try {
    const points = lastYear(await fetchAny(symbol));
    if (!points.length) throw new Error(`Aucune donnée sur 1 an pour ${symbol}`);
    const doc = { symbol, points, updatedAt: new Date() };
    await collection().updateOne({ symbol }, { $set: doc }, { upsert: true });
    return payload(doc, false);
  } catch (err) {
    if (cached) return payload(cached, true);
    throw err;
  }
}

module.exports = { getTickerHistory, lastYear, YEAR_DAYS };
