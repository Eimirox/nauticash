// backend/services/benchmarks.js
// Indices de référence pour comparer l'évolution d'un portefeuille (données FMP de fin de journée).
// Un seul appel API par indice et par période de CACHE_TTL : les points sont gardés en base
// (collection « benchmarks ») et resservis à tous les utilisateurs.

const mongoose = require("mongoose");
const config = require("../config/providers");
const { trackedFetchJson } = require("./apiUsage");
const YahooProvider = require("./providers/yahoo");

const yahoo = new YahooProvider();

const BENCHMARKS = {
  CAC40: { symbol: "^FCHI", label: "CAC 40", currency: "EUR" },
  SP500: { symbol: "^GSPC", label: "S&P 500", currency: "USD" },
};

const CACHE_TTL = 12 * 60 * 60 * 1000;
const HISTORY_DAYS = 400;

const collection = () => mongoose.connection.collection("benchmarks");

function list() {
  return Object.entries(BENCHMARKS).map(([key, b]) => ({ key, label: b.label, currency: b.currency }));
}

async function fetchHistory(symbol) {
  const { baseUrl, apiKey, enabled } = config.fmp;
  if (!enabled || !apiKey) throw new Error("FMP non configuré");
  const from = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const query = new URLSearchParams({ symbol, from, apikey: apiKey }).toString();
  const data = await trackedFetchJson("fmp", `${baseUrl}/historical-price-eod/light?${query}`);
  const rows = Array.isArray(data) ? data : Array.isArray(data?.historical) ? data.historical : [];
  const points = rows
    .map((r) => ({ date: String(r.date).slice(0, 10), close: Number(r.price ?? r.close) }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.close > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!points.length) throw new Error(`Aucune donnée pour ${symbol}`);
  return points;
}

// Yahoo Finance (sans clé) : couvre les indices (^FCHI, ^GSPC) que l'offre gratuite FMP refuse parfois
async function fetchHistoryYahoo(symbol) {
  if (!yahoo.config.enabled) throw new Error("Yahoo désactivé");
  const data = await yahoo.request(`v8/finance/chart/${encodeURIComponent(symbol)}`, { range: "2y", interval: "1d" });
  const result = data?.chart?.result?.[0];
  const stamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const offset = Number(result?.meta?.gmtoffset) || 0;
  const cutoff = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const byDate = new Map();
  stamps.forEach((t, i) => {
    const close = Number(closes[i]);
    if (!(close > 0)) return;
    const date = new Date((Number(t) + offset) * 1000).toISOString().slice(0, 10);
    if (date >= cutoff) byDate.set(date, close);
  });
  const points = [...byDate].map(([date, close]) => ({ date, close })).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!points.length) throw new Error(`Aucune donnée Yahoo pour ${symbol}`);
  return points;
}

// FMP d'abord, Yahoo si FMP refuse ou ne renvoie rien
async function fetchAny(symbol) {
  try {
    return await fetchHistory(symbol);
  } catch (fmpError) {
    try {
      return await fetchHistoryYahoo(symbol);
    } catch {
      throw fmpError;
    }
  }
}

/**
 * { key, label, currency, points: [{ date, close }], updatedAt, stale }
 * Données en cache si elles ont moins de CACHE_TTL ; sinon nouvel appel FMP,
 * et en cas d'échec (quota, réseau) les dernières données connues avec stale: true.
 */
async function getBenchmark(key) {
  const def = BENCHMARKS[key];
  if (!def) return null;

  const cached = await collection().findOne({ key });
  const fresh = cached && Date.now() - new Date(cached.updatedAt).getTime() < CACHE_TTL;
  const payload = (doc, stale) => ({
    key,
    label: def.label,
    currency: def.currency,
    points: doc.points,
    updatedAt: doc.updatedAt,
    stale,
  });
  if (fresh) return payload(cached, false);

  try {
    const points = await fetchAny(def.symbol);
    const doc = { key, symbol: def.symbol, points, updatedAt: new Date() };
    await collection().updateOne({ key }, { $set: doc }, { upsert: true });
    return payload(doc, false);
  } catch (err) {
    if (cached) return payload(cached, true);
    throw err;
  }
}

module.exports = { BENCHMARKS, list, getBenchmark, CACHE_TTL };
