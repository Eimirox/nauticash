// Tests : fiabilité des cours (secours query2, erreur mémorisée, diagnostic admin), zones et ETF
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const { etfExposure, zoneOf } = require("../services/zones");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const now = Math.floor(Date.now() / 1000);
const chart = (price, prev, extra = {}) => ({
  meta: { currency: "EUR", regularMarketPrice: price, chartPreviousClose: prev, regularMarketTime: now, instrumentType: "EQUITY", exchangeName: "PAR", longName: "TotalEnergies SE", ...extra },
  timestamp: [now - 86400, now],
  indicators: { quote: [{ close: [prev, price] }] },
});
const add = (token, body) => h.request("POST", "/api/user/portfolio", { token, body });

describe("Yahoo bloqué sur le serveur principal", () => {
  test("le second serveur (query2) prend le relais", async () => {
    h.fmp.notCovered["TTE.PA"] = true;
    h.yahoo.blockPrimary = 429;
    h.yahoo.charts["TTE.PA"] = chart(58.4, 57.9);
    const { token } = await h.registerUser();
    const res = await add(token, { ticker: "TTE.PA", quantity: 1 });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.stock.close, 58.4);
    assert.ok(h.yahoo.hosts.includes("query2.finance.yahoo.com"));
  });
});

describe("Échec d'actualisation mémorisé", () => {
  test("le dernier cours reste, l'échec est signalé puis effacé au prochain succès", async () => {
    h.fmp.notCovered["TTE.PA"] = true;
    h.yahoo.charts["TTE.PA"] = chart(58.4, 57.9);
    const { token } = await h.registerUser();
    await add(token, { ticker: "TTE.PA", quantity: 1 });
    const priceStore = require("../services/priceStore");

    h.yahoo.failWith = 500;
    await assert.rejects(priceStore.refreshTicker("TTE.PA"));
    let [s] = (await h.request("GET", "/api/user/portfolio", { token })).body.stocks;
    assert.equal(s.close, 58.4, "le cours précédent est conservé");
    assert.match(s.priceError, /500/);

    h.yahoo.failWith = null;
    await priceStore.refreshTicker("TTE.PA");
    [s] = (await h.request("GET", "/api/user/portfolio", { token })).body.stocks;
    assert.equal(s.priceError, null);
    assert.equal((await h.db.collection("prices").findOne({ symbol: "TTE.PA" })).lastError, undefined);
  });
});

describe("GET /api/admin/diagnose/:ticker", () => {
  test("compare le cours enregistré à chaque fournisseur", async () => {
    h.fmp.notCovered["TTE.PA"] = true;
    h.yahoo.charts["TTE.PA"] = chart(58.4, 57.9);
    const user = await h.registerUser();
    await add(user.token, { ticker: "TTE.PA", quantity: 1 });
    h.yahoo.charts["TTE.PA"] = chart(59, 57.9);

    const admin = await h.registerUser("admin@nauticash.test");
    const res = await h.request("GET", "/api/admin/diagnose/tte.pa", { token: admin.token });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.ticker, "TTE.PA");
    assert.equal(res.body.stored.close, 58.4);
    assert.equal(res.body.providers.fmp.ok, false);
    assert.equal(res.body.providers.fmp.code, "NOT_COVERED");
    assert.equal(res.body.providers.yahoo.ok, true);
    assert.equal(res.body.providers.yahoo.price, 59);
    assert.ok(Math.abs(res.body.providers.yahoo.diffWithStoredPct - ((59 - 58.4) / 58.4) * 100) < 1e-9);
  });

  test("POST /api/admin/refresh/:ticker actualise immédiatement", async () => {
    h.fmp.notCovered["TTE.PA"] = true;
    h.yahoo.charts["TTE.PA"] = chart(58.4, 57.9);
    const user = await h.registerUser();
    await add(user.token, { ticker: "TTE.PA", quantity: 1 });
    h.yahoo.charts["TTE.PA"] = chart(60, 58.4);
    const admin = await h.registerUser("admin@nauticash.test");
    const res = await h.request("POST", "/api/admin/refresh/TTE.PA", { token: admin.token });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.close, 60);
    assert.equal(res.body.previousClose, 58.4);
  });
});

describe("Zones et exposition des ETF", () => {
  const cases = [
    ["BNP Paribas Easy S&P 500 UCITS ETF", "US", "Amérique du Nord"],
    ["Amundi PEA S&P 500 UCITS ETF", "US", "Amérique du Nord"],
    ["Lyxor Nasdaq-100 UCITS ETF", "US", "Amérique du Nord"],
    ["Amundi CAC 40 UCITS ETF-C", "FR", "Europe"],
    ["iShares Core DAX UCITS ETF (DE)", "DE", "Europe"],
    ["iShares Core FTSE 100 UCITS ETF", "GB", "Europe"],
    ["Amundi MSCI World UCITS ETF", null, "Monde"],
    ["iShares Core MSCI World UCITS ETF USD (Acc)", null, "Monde"],
    ["Vanguard FTSE All-World UCITS ETF", null, "Monde"],
    ["Amundi PEA MSCI Emerging Markets UCITS ETF", null, "Émergents"],
    ["iShares Core EURO STOXX 50 UCITS ETF", null, "Europe"],
    ["Amundi Prime Japan UCITS ETF", "JP", "Asie"],
  ];
  for (const [name, country, zone] of cases) {
    test(name, () => {
      const e = etfExposure(name, "ETF");
      assert.ok(e, "indice reconnu");
      assert.equal(e.country, country);
      assert.equal(e.zone, zone);
    });
  }

  test("une action n'est jamais reclassée d'après son nom", () => {
    assert.equal(etfExposure("America Movil SAB", "Stock"), null);
    assert.equal(etfExposure("Europcar Mobility Group", "Stock"), null);
  });

  test("zones par pays", () => {
    assert.equal(zoneOf("FR"), "Europe");
    assert.equal(zoneOf("US"), "Amérique du Nord");
    assert.equal(zoneOf("JP"), "Asie");
  });

  test("GET /portfolio : ETF S&P 500 coté à Paris rattaché aux États-Unis, action française en Europe", async () => {
    h.fmp.notCovered["ESE.PA"] = true;
    h.fmp.notCovered["TTE.PA"] = true;
    h.yahoo.charts["ESE.PA"] = chart(28, 27.8, { instrumentType: "ETF", longName: "BNP Paribas Easy S&P 500 UCITS ETF EUR C" });
    h.yahoo.charts["TTE.PA"] = chart(58.4, 57.9);
    const { token } = await h.registerUser();
    await add(token, { ticker: "ESE.PA", quantity: 1 });
    await add(token, { ticker: "TTE.PA", quantity: 1 });
    const by = Object.fromEntries((await h.request("GET", "/api/user/portfolio", { token })).body.stocks.map((s) => [s.ticker, s]));
    assert.deepEqual([by["ESE.PA"].country, by["ESE.PA"].countryCode, by["ESE.PA"].zone, by["ESE.PA"].exposure], ["États-Unis", "US", "Amérique du Nord", "S&P 500"]);
    assert.equal(by["ESE.PA"].listingCountry, "France");
    assert.deepEqual([by["TTE.PA"].country, by["TTE.PA"].zone], ["France", "Europe"]);
  });
});
