// Tests : contrôle quotidien de cohérence des cours (jobs/priceCheck.js, étape 2/2)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const config = require("../config/providers");
const priceCheck = require("../jobs/priceCheck");

before(h.start);
after(h.stop);
beforeEach(() => {
  h.resetState();
  priceCheck.lastSummary = null;
  priceCheck.lastRun = null;
  delete process.env.YAHOO_DAILY_LIMIT;
  config.cron.priceCheck.delayMs = 0;
});

// Mercredi soir, après l'actualisation de 21:15 UTC
const NOW = new Date("2026-10-07T21:35:00Z");
const MARKET_TIME = new Date("2026-10-07T20:00:00Z");

const hold = (...tickers) =>
  h.db.collection("users").insertOne({ email: `u${Math.random()}@nauticash.test`, portfolio: tickers.map((ticker) => ({ ticker })) });

const price = (symbol, close, extra = {}) =>
  h.db.collection("prices").insertOne({ symbol, close, marketTime: MARKET_TIME, lastUpdate: MARKET_TIME, source: "fmp", ...extra });

const chart = (symbol, regularMarketPrice, currency = "USD") => {
  h.yahoo.charts[symbol] = {
    meta: { symbol, currency, regularMarketPrice, regularMarketTime: Math.floor(MARKET_TIME.getTime() / 1000), instrumentType: "EQUITY" },
    timestamp: [],
    indicators: { quote: [{ close: [] }] },
  };
};

const run = () => priceCheck.run({ now: NOW });
const byTicker = (summary) => Object.fromEntries(summary.issues.map((r) => [r.ticker, r]));

describe("Contrôle de cohérence des cours", () => {
  test("compare au cours Yahoo (appel léger) et signale les écarts, sans appeler FMP", async () => {
    await hold("AAPL", "TTE.PA");
    await hold("AAPL");
    await price("AAPL", 100);
    await price("TTE.PA", 50, { currency: "EUR" });
    chart("AAPL", 120);
    chart("TTE.PA", 50.5, "EUR");

    const summary = await run();
    assert.equal(summary.total, 2);
    assert.equal(summary.counts.ecart, 1);
    assert.equal(summary.counts.ok, 1);
    assert.equal(summary.issues.length, 1);
    const aapl = summary.issues[0];
    assert.equal(aapl.ticker, "AAPL");
    assert.equal(aapl.status, "ecart");
    assert.equal(aapl.referencePrice, 120);
    assert.equal(aapl.referenceSource, "Yahoo");
    assert.equal(aapl.deviation, 16.67);

    assert.equal(h.fmp.calls.length, 0, "le quota FMP est réservé à l'actualisation du soir");
    assert.deepEqual(h.yahoo.calls.map((c) => c.symbol).sort(), ["AAPL", "TTE.PA"]);
  });

  test("titre sans cours : en échec, sans appel au second fournisseur", async () => {
    await hold("NOPE");
    const summary = await run();
    assert.equal(summary.counts.echec, 1);
    assert.equal(byTicker(summary).NOPE.message, "Aucun cours enregistré");
    assert.equal(h.yahoo.calls.length, 0);
  });

  test("cours venant déjà de Yahoo et pas d'autre fournisseur : non vérifié (Yahoo n'est pas comparé à lui-même)", async () => {
    await hold("AAPL");
    await price("AAPL", 100, { source: "yahoo" });
    chart("AAPL", 150);
    const summary = await run();
    assert.equal(summary.counts.non_verifie, 1);
    assert.equal(summary.issues.length, 0, "non vérifié n'est pas une alerte");
    assert.equal(h.yahoo.calls.length, 0);
  });

  test("quota Yahoo atteint : aucun appel, titres non vérifiés", async () => {
    process.env.YAHOO_DAILY_LIMIT = "0";
    await hold("AAPL");
    await price("AAPL", 100);
    chart("AAPL", 150);
    const summary = await run();
    assert.equal(summary.counts.non_verifie, 1);
    assert.equal(h.yahoo.calls.length, 0);
  });

  test("Yahoo ne répond pas : non vérifié ; cours non daté ou ancien détectés", async () => {
    await hold("AAPL", "MSFT", "KO");
    await price("AAPL", 100); // pas de graphique Yahoo → 404
    await price("MSFT", 300, { marketTime: null });
    await price("KO", 60, { marketTime: new Date("2026-09-30T20:00:00Z") });
    chart("MSFT", 300);
    chart("KO", 60);
    const summary = await run();
    assert.equal(summary.counts.non_verifie, 1);
    const issues = byTicker(summary);
    assert.equal(issues.MSFT.status, "non_date");
    assert.equal(issues.KO.status, "ancien");
  });

  test("au plus PRICE_CHECK_MAX titres, les plus détenus d'abord", async () => {
    const original = config.cron.priceCheck.maxTickers;
    config.cron.priceCheck.maxTickers = 1;
    try {
      await hold("AAPL", "KO");
      await hold("KO");
      await price("AAPL", 100);
      await price("KO", 60);
      chart("AAPL", 100);
      chart("KO", 60);
      const summary = await run();
      assert.equal(summary.total, 1);
      assert.deepEqual(h.yahoo.calls.map((c) => c.symbol), ["KO"]);
    } finally {
      config.cron.priceCheck.maxTickers = original;
    }
  });

  test("dernier résumé enregistré en base, relu après un redémarrage et exposé dans /api/admin/stats", async () => {
    await hold("AAPL");
    await price("AAPL", 100);
    chart("AAPL", 120);
    await run();

    const saved = await h.db.collection("jobRuns").findOne({ _id: "priceCheck" });
    assert.ok(saved, "résumé enregistré");
    assert.equal(saved.total, 1);
    assert.equal(saved.results.length, 1, "détail par titre conservé");

    priceCheck.lastSummary = null; // simule un redémarrage du serveur
    const { token } = await h.registerUser("admin@nauticash.test");
    const res = await h.request("GET", "/api/admin/stats", { token });
    assert.equal(res.status, 200, res.text);
    const stats = res.body.priceCheck;
    assert.equal(stats.enabled, false, "désactivé en test");
    assert.equal(stats.schedule, config.cron.priceCheck.schedule);
    assert.equal(stats.lastSummary.total, 1);
    assert.equal(stats.lastSummary.counts.ecart, 1);
    assert.equal(stats.lastSummary.issues[0].ticker, "AAPL");
  });

  test("/api/admin/stats sans contrôle encore lancé : lastSummary null", async () => {
    const { token } = await h.registerUser("admin@nauticash.test");
    const res = await h.request("GET", "/api/admin/stats", { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.priceCheck.lastSummary, null);
  });
});

describe("Choix du second fournisseur", () => {
  const yahoo = { supportsTickerType: () => true };
  const finnhub = { supportsTickerType: (t) => /^[A-Z]{1,5}$/.test(t) };

  test("Yahoo par défaut, Finnhub pour une action US déjà cotée par Yahoo, jamais FMP", () => {
    const providers = { fmp: {}, yahoo, finnhub };
    assert.equal(priceCheck.pickReference("AAPL", "fmp", { providers }), "yahoo");
    assert.equal(priceCheck.pickReference("AAPL", "yahoo", { providers }), "finnhub");
    assert.equal(priceCheck.pickReference("AIR.PA", "yahoo", { providers }), null);
    assert.equal(priceCheck.pickReference("AAPL", "yahoo", { providers: { fmp: {}, yahoo } }), null);
  });

  test("un fournisseur à court de quota pendant le contrôle n'est plus choisi", () => {
    const providers = { yahoo, finnhub };
    assert.equal(priceCheck.pickReference("AAPL", "fmp", { providers, exhausted: new Set(["yahoo"]) }), "finnhub");
  });
});

describe("Planification", () => {
  test("planification par défaut valide, démarrage et arrêt propres", () => {
    const original = { ...config.cron.priceCheck };
    try {
      config.cron.priceCheck.enabled = true;
      const task = priceCheck.start();
      assert.ok(task);
      priceCheck.stop();
      assert.equal(priceCheck.task, null);
    } finally {
      Object.assign(config.cron.priceCheck, original);
    }
  });

  test("planification invalide : contrôle désactivé sans planter", () => {
    const original = { ...config.cron.priceCheck };
    try {
      Object.assign(config.cron.priceCheck, { enabled: true, schedule: "n'importe quoi" });
      assert.equal(priceCheck.start(), null);
    } finally {
      Object.assign(config.cron.priceCheck, original);
    }
  });
});
