// Tests : symboles hors offre FMP (402) → Yahoo Finance, et recherche de tickers (autocomplétion)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const now = Math.floor(Date.now() / 1000);
const DAY = 86400;

function nvdaChart() {
  return {
    meta: {
      currency: "USD", symbol: "NVDA", exchangeName: "NMS", fullExchangeName: "NasdaqGS", instrumentType: "EQUITY",
      regularMarketPrice: 180.5, regularMarketTime: now, longName: "NVIDIA Corporation", shortName: "NVIDIA Corp",
      regularMarketDayHigh: 182, regularMarketDayLow: 178, regularMarketVolume: 1000,
    },
    timestamp: [now - 2 * DAY, now - DAY, now],
    indicators: { quote: [{ close: [170, 176, 180.5] }] },
    events: {
      dividends: {
        a: { amount: 0.01, date: now - 300 * DAY }, b: { amount: 0.01, date: now - 210 * DAY },
        c: { amount: 0.01, date: now - 120 * DAY }, d: { amount: 0.01, date: now - 30 * DAY },
      },
    },
  };
}
const nvdaSearch = [
  { symbol: "NVDA", longname: "NVIDIA Corporation", quoteType: "EQUITY", exchange: "NMS", exchDisp: "NASDAQ", sector: "Technology", sectorDisp: "Technology", industry: "Semiconductors" },
];

const add = (token, body) => h.request("POST", "/api/user/portfolio", { token, body });

describe("Symbole hors offre FMP", () => {
  test("402 sur le cours → données Yahoo complètes (prix, veille, secteur, pays, dividendes)", async () => {
    h.fmp.notCovered.NVDA = true;
    h.yahoo.charts.NVDA = nvdaChart();
    h.yahoo.search.nvda = nvdaSearch;
    const { token } = await h.registerUser();

    const res = await add(token, { ticker: "nvda", quantity: 10, pru: 100 });
    assert.equal(res.status, 201, res.text);
    const s = res.body.stock;
    assert.equal(s.close, 180.5);
    assert.equal(s.previousClose, 176);
    assert.equal(s.currency, "USD");
    assert.equal(s.name, "NVIDIA Corporation");
    assert.equal(s.sector, "Technology");
    assert.equal(s.industry, "Semiconductors");
    assert.equal(s.country, "États-Unis");
    assert.equal(s.source, "yahoo");
    assert.ok(Math.abs(s.dividend - 0.04) < 1e-9, "4 versements trimestriels");

    const cached = await h.db.collection("prices").findOne({ symbol: "NVDA" });
    assert.ok(cached.fmpNotCoveredAt, "le refus FMP est mémorisé");
  });

  test("une fois le refus mémorisé, FMP n'est plus appelé pour ce symbole", async () => {
    h.fmp.notCovered.NVDA = true;
    h.yahoo.charts.NVDA = nvdaChart();
    h.yahoo.search.nvda = nvdaSearch;
    const { token } = await h.registerUser();
    await add(token, { ticker: "NVDA", quantity: 1 });
    const fmpCalls = h.fmp.calls.filter((c) => c.symbol === "NVDA").length;

    // Actualisation forcée (cooldown ignoré pour un premier rafraîchissement)
    await h.db.collection("prices").updateOne({ symbol: "NVDA" }, { $set: { lastUpdate: new Date(0) } });
    await require("../services/priceStore").refreshTicker("NVDA");
    assert.equal(h.fmp.calls.filter((c) => c.symbol === "NVDA").length, fmpCalls, "aucun nouvel appel FMP");
  });

  test("cours FMP mais profil et dividendes refusés (402) → complétés par Yahoo", async () => {
    h.fmp.quotes.NVDA = { symbol: "NVDA", name: "NVIDIA", price: 181, previousClose: 176, exchange: "NASDAQ", timestamp: now };
    h.fmp.notCovered.NVDA = ["profile", "dividends"];
    h.yahoo.charts.NVDA = nvdaChart();
    h.yahoo.search.nvda = nvdaSearch;
    const { token } = await h.registerUser();

    const s = (await add(token, { ticker: "NVDA", quantity: 1 })).body.stock;
    assert.equal(s.close, 181, "le cours FMP est conservé");
    assert.equal(s.sector, "Technology");
    assert.ok(s.dividend > 0);
  });

  test("symbole introuvable partout → 404", async () => {
    h.fmp.notCovered.ZZZZ = true;
    const { token } = await h.registerUser();
    assert.equal((await add(token, { ticker: "ZZZZ", quantity: 1 })).status, 404);
  });
});

describe("GET /api/market/search", () => {
  const search = (token, q) => h.request("GET", `/api/market/search?q=${encodeURIComponent(q)}`, { token });

  test("exige d'être connecté", async () => {
    assert.equal((await h.request("GET", "/api/market/search?q=goog")).status, 401);
  });

  test("« google » propose GOOG et GOOGL (liste locale), complétés par Yahoo", async () => {
    h.yahoo.search.google = [
      { symbol: "GOOGL", longname: "Alphabet Inc.", quoteType: "EQUITY", exchange: "NMS", sector: "Communication Services" },
      { symbol: "GOOG.MX", longname: "Alphabet Inc.", quoteType: "EQUITY", exchange: "MEX" },
      { symbol: "^GSPC", shortname: "S&P 500", quoteType: "INDEX", exchange: "SNP" },
    ];
    const { token } = await h.registerUser();
    const res = await search(token, "google");
    assert.equal(res.status, 200);
    const symbols = res.body.results.map((r) => r.symbol);
    assert.deepEqual(symbols.slice(0, 2), ["GOOG", "GOOGL"]);
    assert.ok(symbols.includes("GOOG.MX"));
    assert.ok(!symbols.includes("^GSPC"), "les indices ne sont pas proposés");
    assert.equal(res.body.results.find((r) => r.symbol === "GOOGL").sector, "Communication Services");
  });

  test("met les recherches en cache et fonctionne sans Yahoo", async () => {
    const { token } = await h.registerUser();
    await search(token, "nvidia");
    await search(token, "NVIDIA");
    assert.equal(h.yahoo.calls.filter((c) => c.endpoint === "search").length, 1);

    h.yahoo.failWith = 500;
    const res = await search(token, "airbus");
    assert.equal(res.status, 200);
    assert.equal(res.body.results[0].symbol, "AIR.PA");
  });

  test("le ticker exact passe en premier", async () => {
    h.yahoo.search.v = [{ symbol: "VOO", longname: "Vanguard S&P 500", quoteType: "ETF", exchange: "PCX" }, { symbol: "V", longname: "Visa Inc.", quoteType: "EQUITY", exchange: "NYQ" }];
    const { token } = await h.registerUser();
    const res = await search(token, "v");
    assert.equal(res.body.results[0].symbol, "V");
  });
});
