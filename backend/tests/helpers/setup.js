// backend/tests/helpers/setup.js
// Prépare un environnement de test isolé :
//   - variables d'environnement de test (fixées AVANT de charger l'app, dotenv ne les écrase pas)
//   - base MongoDB simulée en mémoire (fakeDb) branchée sur mongoose
//   - API FMP et Resend simulées via un fetch() intercepté (aucun appel réseau sortant)
//   - serveur Express démarré sur un port libre
//
// Chaque fichier de test est exécuté dans son propre processus par `node --test`,
// donc l'état (quotas, rate limiting, base) ne fuit pas d'un fichier à l'autre.

const TEST_ENV = {
  NODE_ENV: "test",
  JWT_SECRET: "secret-de-test-suffisamment-long-pour-les-tests-0123456789",
  MONGO_URI: "mongodb://fake-db-en-memoire/nauticash-test",
  FRONTEND_URL: "http://localhost:3000",
  ADMIN_EMAILS: "admin@nauticash.test",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "Nauticash <no-reply@nauticash.test>",
  FMP_API_KEY: "fmp_test_key",
  FMP_ENABLED: "true",
  PRIMARY_PRICE_PROVIDER: "fmp",
  ACTIVE_PROVIDERS: "fmp",
  ALPHA_VANTAGE_ENABLED: "false",
  ALPHA_VANTAGE_API_KEY: "",
  TWELVE_DATA_ENABLED: "false",
  POLYGON_ENABLED: "false",
  // Finnhub désactivé par défaut (sans clé) ; un fichier de test l'active en posant
  // NAUTICASH_TEST_FINNHUB=1 avant de charger ce module.
  FINNHUB_API_KEY: process.env.NAUTICASH_TEST_FINNHUB ? "finnhub_test_key" : "",
  FINNHUB_ENABLED: "true",
  RATE_LIMITING_ENABLED: "true",
  FMP_DAILY_LIMIT: "",
  CRON_UPDATE_PRICES: "false",
  CRON_DAILY_HISTORY: "false",
  CRON_LIVE_PRICES: "false",
  HEALTHCHECK_ON_START: "false",
};

Object.assign(process.env, TEST_ENV);

const mongoose = require("mongoose");
const { FakeDb } = require("./fakeDb");

// -----------------------------------------------------------------------------
// Logs : les routes loggent beaucoup (emojis, erreurs attendues). On les coupe
// pour garder une sortie de test lisible (TEST_VERBOSE=1 pour les voir).
// -----------------------------------------------------------------------------
if (!process.env.TEST_VERBOSE) {
  for (const level of ["log", "info", "warn", "error"]) console[level] = () => {};
}

// -----------------------------------------------------------------------------
// Base simulée
// -----------------------------------------------------------------------------
const db = new FakeDb();
mongoose.connection.collection = (name) => db.collection(name);

// -----------------------------------------------------------------------------
// API externes simulées (FMP + Resend)
// -----------------------------------------------------------------------------
const realFetch = globalThis.fetch;

const fmp = {
  calls: [],        // { endpoint, symbol }
  quotes: {},       // symbol -> objet "quote" FMP
  profiles: {},     // symbol -> objet "profile" FMP
  dividends: {},    // symbol -> tableau de dividendes FMP
  notCovered: {},   // symbol -> true | ["profile", "dividends"] : réponses 402 simulées
  history: {},      // symbol -> historique de fin de journée (endpoint historical-price-eod/light)
  failWith: null,   // code HTTP à renvoyer pour tous les appels (ex. 500)
};

const fx = {
  calls: 0,
  failWith: null,
  body: { amount: 1, base: "EUR", date: "2026-09-25", rates: { USD: 1.14, GBP: 0.86, CHF: 0.94, JPY: 180 } },
};

// Yahoo Finance simulé : graphiques (cours + dividendes) et recherche
const yahoo = {
  calls: [],        // { endpoint: "chart" | "search", symbol }
  charts: {},       // symbole -> { meta, indicators?, events? }
  search: {},       // requête en minuscules -> tableau « quotes »
  failWith: null,
  blockPrimary: null, // code HTTP renvoyé par query1 uniquement
  hosts: [],
};

// Finnhub simulé : endpoint /quote uniquement
const finnhub = {
  calls: [],        // { endpoint, symbol }
  quotes: {},       // symbole -> { c, pc, d, dp, h, l, o, t } (absent = symbole inconnu, tout à 0)
  failWith: null,   // code HTTP à renvoyer (ex. 429)
};

const mail = {
  sent: [],         // corps JSON envoyés à Resend
  failWith: null,   // code HTTP à renvoyer (ex. 500)
};

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);

  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    return realFetch(input, init);
  }

  if (url.hostname === "financialmodelingprep.com") {
    const endpoint = url.pathname.split("/").pop();
    const symbol = url.searchParams.get("symbol");
    fmp.calls.push({ endpoint, symbol });
    if (url.searchParams.get("apikey") !== process.env.FMP_API_KEY) return jsonResponse(401, { error: "bad key" });
    if (fmp.failWith) return jsonResponse(fmp.failWith, { error: "simulated failure" });
    // Offre gratuite FMP : symbole hors offre → 402 (tous les endpoints ou certains seulement)
    const refused = fmp.notCovered[symbol];
    if (refused === true || (Array.isArray(refused) && refused.includes(endpoint))) {
      return jsonResponse(402, { "Error Message": "Premium Query Parameter: not available under your current subscription" });
    }
    if (endpoint === "quote") {
      return jsonResponse(200, symbol.split(",").map((s) => fmp.quotes[s]).filter(Boolean));
    }
    if (endpoint === "profile") return jsonResponse(200, fmp.profiles[symbol] ? [fmp.profiles[symbol]] : []);
    if (endpoint === "dividends") return jsonResponse(200, fmp.dividends[symbol] || []);
    if (endpoint === "light") return jsonResponse(200, fmp.history[symbol] || []);
    return jsonResponse(404, { error: "unknown endpoint" });
  }

  if (url.hostname === "query1.finance.yahoo.com" || url.hostname === "query2.finance.yahoo.com") {
    if (yahoo.failWith) return jsonResponse(yahoo.failWith, { error: "simulated failure" });
    // Serveur principal bloqué (ex. 429 depuis l'hébergeur) : seul query2 répond
    if (yahoo.blockPrimary && url.hostname === "query1.finance.yahoo.com") return jsonResponse(yahoo.blockPrimary, { error: "blocked" });
    yahoo.hosts.push(url.hostname);
    if (url.pathname.startsWith("/v8/finance/chart/")) {
      const symbol = decodeURIComponent(url.pathname.split("/").pop());
      yahoo.calls.push({ endpoint: "chart", symbol });
      const r = yahoo.charts[symbol];
      if (!r) return jsonResponse(404, { chart: { result: null, error: { code: "Not Found", description: "No data found, symbol may be delisted" } } });
      return jsonResponse(200, { chart: { result: [r], error: null } });
    }
    if (url.pathname === "/v1/finance/search") {
      const q = String(url.searchParams.get("q") || "").toLowerCase();
      yahoo.calls.push({ endpoint: "search", symbol: q });
      return jsonResponse(200, { quotes: yahoo.search[q] || [] });
    }
    return jsonResponse(404, {});
  }

  if (url.hostname === "finnhub.io") {
    const endpoint = url.pathname.split("/").pop();
    const symbol = url.searchParams.get("symbol");
    finnhub.calls.push({ endpoint, symbol });
    if (url.searchParams.get("token") !== process.env.FINNHUB_API_KEY) return jsonResponse(401, { error: "Invalid API key" });
    if (finnhub.failWith) return jsonResponse(finnhub.failWith, { error: "simulated failure" });
    if (endpoint === "quote") {
      return jsonResponse(200, finnhub.quotes[symbol] || { c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 });
    }
    return jsonResponse(404, { error: "unknown endpoint" });
  }

  if (url.hostname === "api.frankfurter.dev") {
    fx.calls++;
    if (fx.failWith) return jsonResponse(fx.failWith, { message: "simulated failure" });
    return jsonResponse(200, fx.body);
  }

  if (url.hostname === "api.resend.com") {
    if (mail.failWith) return jsonResponse(mail.failWith, { message: "simulated failure" });
    mail.sent.push(JSON.parse(init.body));
    return jsonResponse(200, { id: `email_${mail.sent.length}` });
  }

  throw new Error(`Appel réseau non simulé dans les tests : ${url.hostname}`);
};

// Données de marché par défaut
function seedMarket() {
  fmp.quotes.AAPL = {
    symbol: "AAPL", name: "Apple Inc.", price: 200, open: 198, dayHigh: 202, dayLow: 197,
    volume: 1000, previousClose: 199, change: 1, changePercentage: 0.5, marketCap: 3e12,
    exchange: "NASDAQ", currency: "USD",
  };
  fmp.profiles.AAPL = {
    symbol: "AAPL", companyName: "Apple Inc.", sector: "Technology", industry: "Consumer Electronics",
    country: "US", currency: "USD", isEtf: false, isFund: false, lastDividend: 1,
  };
  const recent = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  fmp.dividends.AAPL = [
    { date: recent(10), adjDividend: 0.25, paymentDate: recent(3), recordDate: recent(9) },
    { date: recent(100), adjDividend: 0.25 },
    { date: recent(190), adjDividend: 0.25 },
    { date: recent(280), adjDividend: 0.25 },
  ];
  fmp.quotes["MC.PA"] = {
    symbol: "MC.PA", name: "LVMH", price: 700, exchange: "EURONEXT", currency: "EUR",
  };
  fmp.profiles["MC.PA"] = {
    symbol: "MC.PA", companyName: "LVMH Moët Hennessy", sector: "Consumer Cyclical", industry: "Luxury Goods",
    country: "FR", currency: "EUR",
  };
  fmp.dividends["MC.PA"] = [];
}

// -----------------------------------------------------------------------------
// Modèles mongoose : les méthodes utilisées par les routes lisent/écrivent la base simulée
// -----------------------------------------------------------------------------
const User = require("../../models/user");
const users = () => db.collection("users");

User.findOne = async (filter) => {
  const raw = await users().findOne(filter);
  return raw ? User.hydrate(raw) : null;
};

User.findById = (id) => {
  const run = async (lean) => {
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(String(id));
    } catch {
      return null;
    }
    const raw = await users().findOne({ _id: objectId });
    if (!raw) return null;
    return lean ? raw : User.hydrate(raw);
  };
  return { lean: () => run(true), then: (ok, ko) => run(false).then(ok, ko) };
};

User.create = async (data) => {
  const doc = new User(data);
  await doc.validate();
  if (await users().findOne({ email: doc.email })) {
    const err = new Error("E11000 duplicate key error (email)");
    err.code = 11000;
    throw err;
  }
  const now = new Date();
  await users().insertOne({ ...doc.toObject(), createdAt: now, updatedAt: now });
  return doc;
};

User.prototype.save = async function save() {
  await this.validate();
  await users().replaceById({ ...this.toObject(), updatedAt: new Date() });
  this.isNew = false;
  return this;
};

// -----------------------------------------------------------------------------
// Application + serveur HTTP
// -----------------------------------------------------------------------------
const app = require("../../server");

const Transaction = mongoose.models.Transaction;
Transaction.find = async (filter) => {
  const rows = await db.collection("transactions").find(filter).toArray();
  return rows.map((r) => Transaction.hydrate(r));
};

let server;
let baseUrl;

async function start() {
  seedMarket();
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}

async function stop() {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = null;
}

// Chaque requête peut simuler une IP différente (X-Forwarded-For, trust proxy = 1)
// pour ne pas être bloquée par le rate limiting des routes d'authentification.
let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

async function request(method, path, { body, token, ip, headers = {}, raw } = {}) {
  const res = await realFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "X-Forwarded-For": ip || nextIp(),
      ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, body: json, text, headers: res.headers };
}

const STRONG_PASSWORD = "MotDePasse!2026";

let userCounter = 0;
async function registerUser(email) {
  const address = email || `user${++userCounter}-${Date.now()}@nauticash.test`;
  const res = await request("POST", "/api/auth/register", { body: { email: address, password: STRONG_PASSWORD } });
  if (res.status !== 201) throw new Error(`Inscription impossible (${res.status}) : ${res.text}`);
  return { email: address, password: STRONG_PASSWORD, token: res.body.token };
}

function resetState() {
  db.reset();
  fmp.calls.length = 0;
  fmp.failWith = null;
  mail.sent.length = 0;
  mail.failWith = null;
  fx.calls = 0;
  yahoo.calls.length = 0;
  yahoo.charts = {};
  yahoo.search = {};
  yahoo.failWith = null;
  yahoo.blockPrimary = null;
  yahoo.hosts.length = 0;
  finnhub.calls.length = 0;
  finnhub.quotes = {};
  finnhub.failWith = null;
  fmp.history = {};
  fmp.notCovered = {};
  fx.failWith = null;
  require("../../services/fx")._reset();
  require("../../services/priceService").clearCache();
  seedMarket();
}

module.exports = {
  app,
  db,
  fmp,
  yahoo,
  finnhub,
  fx,
  mail,
  start,
  stop,
  request,
  registerUser,
  resetState,
  STRONG_PASSWORD,
};
