// backend/routes/user.js
// Routes utilisateur : portefeuille, cash, statistiques

const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const priceStore = require("../services/priceStore");
const { validateProfilePatch, readProfile } = require("../services/profile");
const { resolveCountry } = require("../services/countries");
const { exchangeLabel, logoUrl } = require("../services/exchanges");

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

/** Prochain détachement estimé : dernier détachement + 12/fréquence mois, jusqu'à dépasser aujourd'hui */
function nextExDate(lastExDate, frequency) {
  const f = Number(frequency);
  const last = lastExDate ? new Date(lastExDate).getTime() : NaN;
  if (!Number.isFinite(last) || !(f > 0) || Date.now() - last > 400 * 24 * 60 * 60 * 1000) return null;
  const step = (12 / f) * MONTH_MS;
  let next = last;
  while (next <= Date.now()) next += step;
  return new Date(next).toISOString().slice(0, 10);
}

const router = express.Router();

const users = () => mongoose.connection.collection("users");
const userFilter = (req) => ({ _id: new mongoose.Types.ObjectId(req.user.userId) });

// Un ticker = lettres/chiffres et . - ^ = (ex : AAPL, MC.PA, BTC-USD, ^GSPC)
const TICKER_RE = /^[A-Z0-9.\-^=]{1,20}$/;
const normalizeTicker = (t) => (typeof t === "string" ? t.trim().toUpperCase() : "");

const toNumber = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
const isValidAmount = (n) => Number.isFinite(n) && n >= 0 && n < 1e12;

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "JPY"];

// Données de prix réutilisées si elles ont moins de 15 min (ajout d'une action déjà suivie)
const FRESH_PRICE_MS = 15 * 60 * 1000;
// Actualisation manuelle : au plus une toutes les 15 min par utilisateur
const FORCE_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;

// Cash : format cashAmount/cashCurrency. L'ancien champ "cash" (écrit par l'ancienne
// route) reste prioritaire s'il existe encore ; il est supprimé à la prochaine sauvegarde.
function readCash(user) {
  if (user.cash && typeof user.cash.amount === "number") {
    return { amount: user.cash.amount, currency: user.cash.currency || "EUR" };
  }
  return { amount: user.cashAmount ?? 0, currency: user.cashCurrency ?? "EUR" };
}

// Pays normalisé (nom français + codes ISO pour la carte), y compris pour les anciennes données en base
function countryFields(ticker, priceInfo = {}) {
  const c = resolveCountry({
    countryCode: priceInfo.countryCode,
    country: priceInfo.country,
    exchange: priceInfo.exchange,
    ticker,
    type: priceInfo.type,
  });
  return { country: c.name, countryCode: c.code, countryNumeric: c.numeric };
}

function enrich(position, priceInfo) {
  if (!priceInfo) {
    return {
      ticker: position.ticker,
      name: position.ticker,
      quantity: position.quantity,
      pru: position.pru,
      account: position.account || null,
      fees: position.fees ?? null,
      exchange: exchangeLabel(position.ticker, null),
      logo: logoUrl(position.ticker),
      close: 0,
      currency: "USD",
      performance: 0,
      total: 0,
      ...countryFields(position.ticker),
      error: "Price not available",
    };
  }

  const close = priceInfo.close || 0;
  const previousClose = priceInfo.previousClose > 0 ? priceInfo.previousClose : null;
  // Variation du jour : écart au cours de clôture de la veille (même devise que le prix)
  const dayChange = previousClose ? close - previousClose : Number.isFinite(priceInfo.change) ? priceInfo.change : null;
  const dayChangePercent = previousClose ? (dayChange / previousClose) * 100 : priceInfo.changePercent ?? null;
  return {
    ticker: position.ticker,
    name: priceInfo.name || position.ticker,
    quantity: position.quantity,
    pru: position.pru,
    account: position.account || null,
    fees: position.fees ?? null,
    close,
    currency: priceInfo.currency || "USD",
    performance: position.pru > 0 ? ((close - position.pru) / position.pru) * 100 : 0,
    total: close * position.quantity,
    previousClose,
    dayChange,
    dayChangePercent,
    dayChangeValue: dayChange !== null ? dayChange * position.quantity : null,
    priceTime: priceInfo.marketTime || priceInfo.lastUpdate || null,
    dividend: priceInfo.dividend ?? null,
    dividendYield: priceInfo.dividendYield ?? null,
    dividendFrequency: priceInfo.dividendFrequency ?? null,
    nextExDividendDate: nextExDate(priceInfo.exDividendDate, priceInfo.dividendFrequency),
    exchange: exchangeLabel(position.ticker, priceInfo.exchange, priceInfo.type),
    logo: logoUrl(position.ticker),
    myDividendYield: priceInfo.dividend && close > 0 ? (priceInfo.dividend / close) * 100 : null,
    exDividendDate: priceInfo.exDividendDate || null,
    paymentDate: priceInfo.paymentDate || null,
    recordDate: priceInfo.recordDate || null,
    ...countryFields(position.ticker, priceInfo),
    sector: priceInfo.sector || null,
    industry: priceInfo.industry || null,
    type: priceInfo.type || "Stock",
    lastUpdate: priceInfo.lastUpdate,
    source: priceInfo.source,
  };
}

// Enveloppes fiscales / comptes (champ optionnel de chaque position)
const ACCOUNTS = ["PEA", "CTO", "AV", "PER", "CRYPTO"];

/** undefined = champ absent ; null = aucune enveloppe ; false = valeur invalide */
function readAccount(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const v = String(value).toUpperCase();
  return ACCOUNTS.includes(v) ? v : false;
}

/** Frais annuels (TER) en % : undefined = absent ; null = retirés ; false = invalide (0 à 10 %) */
function readFees(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = toNumber(typeof value === "string" ? value.trim().replace(",", ".") : value);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? Math.round(n * 1000) / 1000 : false;
}

// =============================================================================
// GET /api/user/portfolio
// =============================================================================
router.get("/portfolio", auth, async (req, res) => {
  try {
    const user = await users().findOne(userFilter(req));
    if (!user) return res.status(404).json({ error: "User not found" });

    const portfolio = user.portfolio || [];
    const pricesData = await priceStore.getCachedMany(portfolio.map((p) => p.ticker));
    const bySymbol = new Map(pricesData.map((p) => [p.symbol, p]));

    res.json({
      stocks: portfolio.map((p) => enrich(p, bySymbol.get(p.ticker))),
      cash: readCash(user),
    });
  } catch (err) {
    console.error("❌ Error GET /portfolio:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// POST /api/user/portfolio  { ticker, quantity?, pru? }
// =============================================================================
router.post("/portfolio", auth, async (req, res) => {
  try {
    const ticker = normalizeTicker(req.body.ticker);
    const quantity = req.body.quantity === undefined ? 0 : toNumber(req.body.quantity);
    const pru = req.body.pru === undefined ? 0 : toNumber(req.body.pru);
    const account = readAccount(req.body.account);

    if (account === false) return res.status(400).json({ error: "Enveloppe invalide." });
    const fees = readFees(req.body.fees);
    if (fees === false) return res.status(400).json({ error: "Frais annuels invalides (entre 0 et 10 %)." });
    if (!TICKER_RE.test(ticker)) return res.status(400).json({ error: "Ticker invalide." });
    if (!isValidAmount(quantity) || !isValidAmount(pru)) {
      return res.status(400).json({ error: "Quantité ou PRU invalide." });
    }

    const user = await users().findOne(userFilter(req), { projection: { portfolio: 1 } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if ((user.portfolio || []).some((p) => p.ticker === ticker)) {
      return res.status(409).json({ error: `${ticker} est déjà dans votre portefeuille.` });
    }

    let doc;
    try {
      ({ doc } = await priceStore.refreshTicker(ticker, { maxAgeMs: FRESH_PRICE_MS }));
    } catch (error) {
      return res.status(404).json({ error: `Ticker introuvable : ${ticker}`, details: error.message });
    }

    await users().updateOne(userFilter(req), {
      $push: { portfolio: { _id: new mongoose.Types.ObjectId(), ticker, quantity, pru, account: account ?? null, fees: fees ?? null } },
    });

    res.status(201).json({
      message: "Stock added successfully",
      stock: enrich({ ticker, quantity, pru, account: account ?? null, fees: fees ?? null }, doc),
    });
  } catch (err) {
    console.error("❌ Error POST /portfolio:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// PATCH /api/user/portfolio/:ticker  { quantity?, pru?, account?, fees? }
// =============================================================================
router.patch("/portfolio/:ticker", auth, async (req, res) => {
  try {
    const ticker = normalizeTicker(req.params.ticker);
    const $set = {};

    for (const field of ["quantity", "pru"]) {
      if (req.body[field] === undefined) continue;
      const value = toNumber(req.body[field]);
      if (!isValidAmount(value)) return res.status(400).json({ error: `${field} invalide.` });
      $set[`portfolio.$.${field}`] = value;
    }
    const account = readAccount(req.body.account);
    if (account === false) return res.status(400).json({ error: "Enveloppe invalide." });
    if (account !== undefined) $set["portfolio.$.account"] = account;
    const fees = readFees(req.body.fees);
    if (fees === false) return res.status(400).json({ error: "Frais annuels invalides (entre 0 et 10 %)." });
    if (fees !== undefined) $set["portfolio.$.fees"] = fees;
    if (!Object.keys($set).length) return res.status(400).json({ error: "Rien à mettre à jour." });

    const result = await users().updateOne({ ...userFilter(req), "portfolio.ticker": ticker }, { $set });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Stock not found in portfolio" });

    res.json({ message: "Stock updated" });
  } catch (err) {
    console.error("❌ Error PATCH /portfolio:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// DELETE /api/user/portfolio/:ticker
// =============================================================================
router.delete("/portfolio/:ticker", auth, async (req, res) => {
  try {
    const ticker = normalizeTicker(req.params.ticker);
    const result = await users().updateOne(userFilter(req), { $pull: { portfolio: { ticker } } });

    if (result.modifiedCount === 0) return res.status(404).json({ error: "Stock not found in portfolio" });
    res.json({ message: "Stock removed successfully" });
  } catch (err) {
    console.error("❌ Error DELETE /portfolio:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// POST /api/user/portfolio/force-refresh
// Actualise les prix du portefeuille. Limité à une fois toutes les 15 min.
// =============================================================================
router.post("/portfolio/force-refresh", auth, async (req, res) => {
  try {
    const user = await users().findOne(userFilter(req), { projection: { portfolio: 1, lastForceRefresh: 1 } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const since = user.lastForceRefresh ? Date.now() - new Date(user.lastForceRefresh).getTime() : Infinity;
    if (since < FORCE_REFRESH_COOLDOWN_MS) {
      const waitMin = Math.ceil((FORCE_REFRESH_COOLDOWN_MS - since) / 60000);
      return res.status(429).json({ error: `Prix déjà actualisés récemment. Réessayez dans ${waitMin} min.` });
    }

    const tickers = (user.portfolio || []).map((p) => p.ticker);
    if (!tickers.length) return res.json({ message: "No stocks to refresh", success: 0, failed: 0, skipped: 0, total: 0 });

    await users().updateOne(userFilter(req), { $set: { lastForceRefresh: new Date() } });

    let success = 0, failed = 0, skipped = 0;
    for (const ticker of tickers) {
      try {
        // Les tickers actualisés il y a moins de 15 min (par le cron ou un autre utilisateur) ne coûtent pas d'appel API
        const { fromCache } = await priceStore.refreshTicker(ticker, { maxAgeMs: FRESH_PRICE_MS, ageField: "fullUpdateAt" });
        fromCache ? skipped++ : success++;
      } catch (error) {
        console.error(`❌ Failed to refresh ${ticker}:`, error.message);
        failed++;
      }
    }

    res.json({ message: "Portfolio refreshed", success, failed, skipped, total: tickers.length });
  } catch (err) {
    console.error("❌ Error force-refresh:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// PATCH /api/user/cash  { amount, currency }
// =============================================================================
router.patch("/cash", auth, async (req, res) => {
  try {
    const amount = toNumber(req.body.amount);
    const currency = typeof req.body.currency === "string" ? req.body.currency.toUpperCase() : "";

    if (!Number.isFinite(amount) || Math.abs(amount) >= 1e12 || !CURRENCIES.includes(currency)) {
      return res.status(400).json({ error: "Invalid cash data" });
    }

    await users().updateOne(userFilter(req), {
      $set: { cashAmount: amount, cashCurrency: currency },
      $unset: { cash: "" },
    });

    res.json({ success: true, cash: { amount, currency } });
  } catch (err) {
    console.error("❌ Error PATCH /cash:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// GET /api/user/portfolio/stats
// =============================================================================
router.get("/portfolio/stats", auth, async (req, res) => {
  try {
    const user = await users().findOne(userFilter(req), { projection: { portfolio: 1 } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const portfolio = user.portfolio || [];
    const pricesData = await priceStore.getCachedMany(portfolio.map((p) => p.ticker));
    const dates = pricesData.map((p) => new Date(p.lastUpdate).getTime()).filter(Number.isFinite);
    const oldest = dates.length ? new Date(Math.min(...dates)) : null;
    const newest = dates.length ? new Date(Math.max(...dates)) : null;

    res.json({
      totalStocks: portfolio.length,
      cachedPrices: pricesData.length,
      oldestPriceUpdate: oldest,
      newestPriceUpdate: newest,
      cacheAge: oldest ? Date.now() - oldest.getTime() : null,
    });
  } catch (err) {
    console.error("❌ Error GET /portfolio/stats:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================================================================
// PROFIL : GET /api/user/profile, PATCH /api/user/profile (mise à jour partielle)
// =============================================================================
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await users().findOne(userFilter(req), { projection: { email: 1, profile: 1 } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ email: user.email, profile: readProfile(user) });
  } catch (err) {
    console.error("❌ Error GET /profile:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/profile", auth, async (req, res) => {
  try {
    const { value, errors } = validateProfilePatch(req.body);
    if (errors) {
      return res.status(400).json({ error: errors[0].msg, details: errors });
    }

    const $set = Object.fromEntries(Object.entries(value).map(([k, v]) => [`profile.${k}`, v]));
    const result = await users().updateOne(userFilter(req), { $set });
    if (result.matchedCount === 0) return res.status(404).json({ error: "User not found" });

    const user = await users().findOne(userFilter(req), { projection: { email: 1, profile: 1 } });
    res.json({ email: user.email, profile: readProfile(user) });
  } catch (err) {
    console.error("❌ Error PATCH /profile:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
