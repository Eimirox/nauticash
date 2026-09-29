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
    quoteCurrency: pick(quote.quoteCurrency, previous.quoteCurrency),
    marketTime: pick(quote.marketTime, previous.marketTime),
    exchange: pick(quote.exchange, previous.exchange),
    country: quote.country && quote.country !== "Unknown" ? quote.country : pick(previous.country, quote.country),
    countryCode: pick(quote.countryCode, previous.countryCode),
    sector: quote.sector && quote.sector !== "Unknown" ? quote.sector : pick(previous.sector, quote.sector),
    industry: quote.industry && quote.industry !== "Unknown" ? quote.industry : pick(previous.industry, quote.industry),
    type: pick(quote.type, previous.type),
    name: pick(quote.name, previous.name),
    dividend: pick(quote.dividend, previous.dividend),
    dividendYield: pick(quote.dividendYield, previous.dividendYield),
    dividendFrequency: pick(quote.dividendFrequency, previous.dividendFrequency),
    dividendRate: pick(quote.dividendRate ?? quote.dividend, previous.dividendRate),
    exDividendDate: pick(quote.exDividendDate, previous.exDividendDate),
    paymentDate: pick(quote.paymentDate, previous.paymentDate),
    recordDate: pick(quote.recordDate, previous.recordDate),
    profileUpdatedAt: quote.profileUpdatedAt || previous.profileUpdatedAt || null,
    dividendsUpdatedAt: quote.dividendsUpdatedAt || previous.dividendsUpdatedAt || null,
    source: quote.source || previous.source || null,
    // Dernière actualisation complète (profil, dividendes) ; les actualisations intraday ne la changent pas
    fullUpdateAt: quote.live ? previous.fullUpdateAt || previous.lastUpdate || null : now,
    fmpNotCoveredAt: quote.fmpNotCoveredAt !== undefined ? quote.fmpNotCoveredAt : previous.fmpNotCoveredAt ?? null,
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
async function refreshTicker(ticker, { maxAgeMs = 0, ageField = "lastUpdate", live = false, providers } = {}) {
  const cached = await getCached(ticker);
  const refDate = cached?.[ageField] || (ageField !== "lastUpdate" ? null : cached?.lastUpdate);
  if (cached && maxAgeMs > 0 && refDate && Date.now() - new Date(refDate).getTime() < maxAgeMs) {
    return { doc: cached, fromCache: true };
  }
  let quote;
  try {
    quote = await priceService.getQuote(ticker, { forceRefresh: true, previous: cached, live, providers });
  } catch (error) {
    // L'échec est mémorisé sur le titre (sans toucher au dernier cours connu) pour le diagnostic
    // et pour signaler un cours non actualisé dans l'interface.
    if (cached) {
      await prices().updateOne(
        { symbol: ticker },
        { $set: { lastError: { message: String(error.message).slice(0, 300), at: new Date(), live: Boolean(live) } } }
      );
    }
    throw error;
  }
  const doc = await saveQuote(ticker, quote, cached);
  if (cached?.lastError) await prices().updateOne({ symbol: ticker }, { $unset: { lastError: "" } });
  return { doc, fromCache: false };
}

module.exports = { buildDoc, getCached, getCachedMany, saveQuote, refreshTicker };
