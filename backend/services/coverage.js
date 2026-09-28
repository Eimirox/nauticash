// backend/services/coverage.js
// Mesure de la couverture des tickers détenus par chaque provider (route admin GET /api/admin/coverage).
// Lecture seule : aucun prix n'est enregistré. Chaque test coûte au plus 1 appel API par provider
// et par ticker, et un provider dont le quota est atteint n'est plus appelé (statut « quota »).

const mongoose = require("mongoose");
const priceService = require("./priceService");
const apiUsage = require("./apiUsage");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const STATUSES = ["ok", "not_covered", "unsupported", "quota", "error"];

/**
 * Tickers distincts des portefeuilles, avec le nombre de comptes qui les détiennent
 * (les plus détenus d'abord, puis ordre alphabétique).
 */
async function heldTickers() {
  const users = await mongoose.connection.collection("users").find({}).toArray();
  const holders = new Map();
  for (const u of users) {
    const seen = new Set();
    for (const p of u.portfolio || []) {
      const t = String(p?.ticker || "").trim().toUpperCase();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      holders.set(t, (holders.get(t) || 0) + 1);
    }
  }
  return [...holders.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([ticker, count]) => ({ ticker, holders: count }));
}

/**
 * Appel le plus léger possible pour savoir si le provider cote ce ticker.
 * Renvoie { status, price?, message? }.
 */
async function probe(name, provider, ticker) {
  if (typeof provider.supportsTickerType === "function" && !provider.supportsTickerType(ticker)) {
    return { status: "unsupported" };
  }
  if (!apiUsage.canCall(name)) return { status: "quota" };

  try {
    let price = null;
    if (name === "fmp") {
      const symbol = provider.config?.tickerMapping?.[ticker] || ticker;
      const data = await provider.request("quote", { symbol });
      price = Array.isArray(data) && data[0] ? Number(data[0].price) : null;
    } else if (name === "alphavantage") {
      const data = await provider.request({ function: "GLOBAL_QUOTE", symbol: ticker });
      price = Number(data?.["Global Quote"]?.["05. price"]);
    } else {
      // Yahoo et futurs providers : cours seul (mode intraday, sans profil ni dividendes)
      const quote = await provider.getQuote(ticker, { live: true });
      price = Number(quote?.price ?? quote?.close);
    }
    if (price > 0) return { status: "ok", price };
    return { status: "not_covered", message: "Aucun cours renvoyé" };
  } catch (err) {
    if (err.code === "QUOTA_EXCEEDED" || /rate limit/i.test(err.message)) return { status: "quota" };
    if (err.code === "NOT_COVERED" || err.status === 402 || err.status === 404 || /no data/i.test(err.message)) {
      return { status: "not_covered", message: err.message };
    }
    return { status: "error", message: err.message };
  }
}

function parseLimit(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_LIMIT;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    throw Object.assign(new Error(`limit doit être un entier entre 1 et ${MAX_LIMIT}`), { status: 400 });
  }
  return n;
}

function parseProviders(value) {
  const available = Object.keys(priceService.providers);
  if (!value) return available;
  const asked = String(value).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const unknown = asked.filter((p) => !available.includes(p));
  if (unknown.length) {
    throw Object.assign(
      new Error(`Provider inconnu ou désactivé : ${unknown.join(", ")} (disponibles : ${available.join(", ") || "aucun"})`),
      { status: 400 }
    );
  }
  return [...new Set(asked)];
}

/**
 * Teste chaque ticker détenu (jusqu'à `limit`) auprès de chaque provider demandé.
 */
async function measureCoverage({ limit, providers } = {}) {
  const max = parseLimit(limit);
  const names = parseProviders(providers);
  const all = await heldTickers();
  const tested = all.slice(0, max);

  const cached = await mongoose.connection
    .collection("prices")
    .find({ symbol: { $in: tested.map((t) => t.ticker) } })
    .toArray();
  const sourceOf = new Map(cached.map((d) => [d.symbol, d.source || null]));

  const summary = {};
  for (const name of names) {
    summary[name] = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  }

  const tickers = [];
  for (const { ticker, holders } of tested) {
    const results = {};
    for (const name of names) {
      const r = await probe(name, priceService.providers[name], ticker);
      results[name] = r;
      summary[name][r.status]++;
    }
    tickers.push({ ticker, holders, currentSource: sourceOf.get(ticker) || null, results });
  }

  for (const name of names) {
    const s = summary[name];
    const answered = s.ok + s.not_covered; // hors quota, erreurs et types non pris en charge
    s.tested = tested.length;
    s.coverage = answered ? Math.round((s.ok / answered) * 1000) / 10 : null; // en %
  }

  // Tickers qu'aucun provider ne cote (à corriger en priorité)
  const uncovered = tickers
    .filter((t) => names.length && names.every((n) => t.results[n].status !== "ok"))
    .map((t) => t.ticker);

  return {
    providers: names,
    totalHeld: all.length,
    tested: tested.length,
    truncated: all.length > tested.length,
    summary,
    uncovered,
    tickers,
    measuredAt: new Date(),
  };
}

module.exports = { measureCoverage, heldTickers, probe, DEFAULT_LIMIT, MAX_LIMIT };
