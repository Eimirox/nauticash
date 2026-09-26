// backend/services/priceStore.js
// Lecture / écriture du cache de prix en base (collection "prices").
// Point d'entrée unique pour : ajout d'une action, refresh utilisateur, cron.

const mongoose = require("mongoose");
const priceService = require("./priceService");

const prices = () => mongoose.connection.collection("prices");

const pick = (value, fallback) => (value !== null && value !== undefined ? value : fallback ?? null);

/**
 * Construit le document à enregistrer. Quand l'API ne renvoie pas une donnée
 * (dividende, secteur...), on garde l'ancienne valeur plutôt que d'écraser par null.
 */
function buildDoc(ticker, quote, previous = {}) {
  const now = new Date();
  return {
    symbol: ticker,
    close: pick(quote.price || quote.close, previous.close),
    open: pick(quote.open, previous.open),
    high: pick(quote.high, previous.high),
    low: pick(quote.low, previous.low),
    volume: pick(quote.volume, previous.volume),
    previousClose: pick(quote.previousClose, previous.previousClose),
    change: pick(quote.change, previous.change),
    changePercent: pick(quote.changePercent, previous.changePercent),
    marketCap: pick(quote.marketCap, previous.marketCap),
    currency: pick(quote.currency, previous.currency),
    exchange: pick(quote.exchange, previous.exchange),
    country: quote.country && quote.country !== "Unknown" ? quote.country : pick(previous.country, quote.country),
    sector: quote.sector && quote.sector !== "Unknown" ? quote.sector : pick(previous.sector, quote.sector),
    industry: quote.industry && quote.industry !== "Unknown" ? quote.industry : pick(previous.industry, quote.industry),
    type: pick(quote.type, previous.type),
    name: pick(quote.name, previous.name),
    dividend: pick(quote.dividend, previous.dividend),
    dividendYield: pick(quote.dividendYield, previous.dividendYield),
    dividendRate: pick(quote.dividendRate ?? quote.dividend, previous.dividendRate),
    exDividendDate: pick(quote.exDividendDate, previous.exDividendDate),
    paymentDate: pick(quote.paymentDate, previous.paymentDate),
    recordDate: pick(quote.recordDate, previous.recordDate),
    profileUpdatedAt: quote.profileUpdatedAt || previous.profileUpdatedAt || null,
    dividendsUpdatedAt: quote.dividendsUpdatedAt || previous.dividendsUpdatedAt || null,
    source: quote.source || previous.source || null,
    lastUpdate: now,
  };
}

async function getCached(ticker) {
  return prices().findOne({ symbol: ticker });
}

async function getCachedMany(tickers) {
  if (!tickers.length) return [];
  return prices().find({ symbol: { $in: tickers } }).toArray();
}

async function saveQuote(ticker, quote, previous) {
  const old = previous === undefined ? await getCached(ticker) : previous;
  const doc = buildDoc(ticker, quote, old || {});
  await prices().updateOne({ symbol: ticker }, { $set: doc }, { upsert: true });
  return doc;
}

/**
 * Renvoie le prix d'un ticker : depuis la base si la donnée a moins de `maxAgeMs`,
 * sinon depuis l'API (en passant l'ancienne donnée au provider pour éviter
 * de re-télécharger profil et dividendes encore valides).
 */
async function refreshTicker(ticker, { maxAgeMs = 0 } = {}) {
  const cached = await getCached(ticker);
  if (cached && maxAgeMs > 0 && Date.now() - new Date(cached.lastUpdate).getTime() < maxAgeMs) {
    return { doc: cached, fromCache: true };
  }
  const quote = await priceService.getQuote(ticker, { forceRefresh: true, previous: cached });
  const doc = await saveQuote(ticker, quote, cached);
  return { doc, fromCache: false };
}

module.exports = { buildDoc, getCached, getCachedMany, saveQuote, refreshTicker };
