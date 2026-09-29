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

// L'ancienne version (script Python, 2025) enregistrait une fiche par ticker ET par jour :
// plusieurs documents peuvent exister pour un même symbole. On retient toujours la fiche
// la plus récente (lastUpdate, sinon ancien champ « date ») et on supprime les autres.
const timeOf = (d) => {
  const t = new Date(d?.lastUpdate || d?.date || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Fiche la plus fiable : celle actualisée par le code actuel (lastUpdate), la plus récente d'abord */
function pickLatest(docs) {
  let best = null;
  for (const d of docs) {
    if (!best) best = d;
    else if (Boolean(d.lastUpdate) !== Boolean(best.lastUpdate)) best = d.lastUpdate ? d : best;
    else if (timeOf(d) > timeOf(best)) best = d;
  }
  return best;
}

async function getCached(ticker) {
  const docs = await prices().find({ symbol: ticker }).toArray();
  return pickLatest(docs);
}

async function getCachedMany(tickers) {
  if (!tickers.length) return [];
  const docs = await prices().find({ symbol: { $in: tickers } }).toArray();
  const bySymbol = new Map();
  for (const d of docs) bySymbol.set(d.symbol, pickLatest([bySymbol.get(d.symbol), d].filter(Boolean)));
  return [...bySymbol.values()];
}

/** Supprime les fiches en double d'un symbole en gardant `keep` (ou la plus récente) */
async function removeDuplicates(ticker, keep = null) {
  const docs = await prices().find({ symbol: ticker }).toArray();
  if (docs.length < 2) return 0;
  const kept = keep ? docs.find((d) => String(d._id) === String(keep._id)) || pickLatest(docs) : pickLatest(docs);
  const others = docs.filter((d) => String(d._id) !== String(kept._id)).map((d) => d._id);
  if (!others.length) return 0;
  const { deletedCount } = await prices().deleteMany({ _id: { $in: others } });
  return deletedCount || 0;
}

/** Nettoyage global des doublons (lancé au démarrage du serveur) */
async function dedupeAll() {
  const docs = await prices().find({}).toArray();
  const counts = new Map();
  for (const d of docs) counts.set(d.symbol, (counts.get(d.symbol) || 0) + 1);
  let removed = 0;
  for (const [symbol, n] of counts) if (n > 1) removed += await removeDuplicates(symbol);
  return removed;
}

async function saveQuote(ticker, quote, previous) {
  const old = previous === undefined ? await getCached(ticker) : previous;
  const doc = buildDoc(ticker, quote, old || {});
  // Écrit dans la fiche retenue (par son _id) pour ne pas mettre à jour un ancien doublon
  const filter = old?._id ? { _id: old._id } : { symbol: ticker };
  await prices().updateOne(filter, { $set: doc }, { upsert: true });
  if (old?._id) await removeDuplicates(ticker, old);
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
        { _id: cached._id },
        { $set: { lastError: { message: String(error.message).slice(0, 300), at: new Date(), live: Boolean(live) } } }
      );
    }
    throw error;
  }
  const doc = await saveQuote(ticker, quote, cached);
  if (cached?.lastError) await prices().updateOne({ _id: cached._id }, { $unset: { lastError: "" } });
  return { doc, fromCache: false };
}

module.exports = { pickLatest, removeDuplicates, dedupeAll, buildDoc, getCached, getCachedMany, saveQuote, refreshTicker };
