// Tests : cohérence des données de marché (devises, sous-unités, dividendes, variation du jour, taux de change)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const { annualizeDividends } = require("../services/dividends");
const { detectQuoteCurrency, normalizeQuoteUnits } = require("../services/currency");
const fx = require("../services/fx");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const DAY = 86400000;
const NOW = Date.parse("2026-09-27T12:00:00Z");
const ago = (d) => new Date(NOW - d * DAY).toISOString().slice(0, 10);
const addStock = (token, body) => h.request("POST", "/api/user/portfolio", { token, body });

describe("Dividende annuel", () => {
  test("5 versements trimestriels dans les 365 jours : on n'en compte que 4", () => {
    const rows = [0, 91, 182, 273, 363].map((d) => ({ date: ago(d + 2), adjDividend: 0.26 }));
    const { annual, frequency } = annualizeDividends(rows, NOW);
    assert.equal(frequency, 4);
    assert.ok(Math.abs(annual - 1.04) < 1e-9, `attendu 1,04, obtenu ${annual}`);
  });

  test("hausse de dividende confirmée : dernier versement × fréquence (cas NVDA)", () => {
    const rows = [[18, 0.25], [116, 0.25], [201, 0.01], [298, 0.01]].map(([d, a]) => ({ date: ago(d), dividend: a }));
    assert.equal(annualizeDividends(rows, NOW).annual, 1);
  });

  test("dividende exceptionnel isolé : pas extrapolé sur l'année", () => {
    const rows = [[10, 2], [100, 0.5], [190, 0.5], [280, 0.5]].map(([d, a]) => ({ date: ago(d), dividend: a }));
    assert.equal(annualizeDividends(rows, NOW).annual, 3.5);
  });

  test("fréquence déclarée par l'API (mensuel)", () => {
    const rows = Array.from({ length: 13 }, (_, i) => ({ date: ago(i * 30 + 5), adjDividend: 0.1, frequency: "Monthly" }));
    assert.ok(Math.abs(annualizeDividends(rows, NOW).annual - 1.2) < 1e-9);
  });

  test("versement annuel unique et semestriel déduits des écarts", () => {
    assert.equal(annualizeDividends([{ date: ago(60), dividend: 13 }, { date: ago(425), dividend: 12 }], NOW).annual, 13);
    const semi = [{ date: ago(40), dividend: 1.5 }, { date: ago(220), dividend: 1 }, { date: ago(405), dividend: 1 }];
    assert.equal(annualizeDividends(semi, NOW).annual, 2.5);
  });

  test("dividende suspendu depuis plus de 18 mois → aucun dividende", () => {
    assert.equal(annualizeDividends([{ date: ago(700), dividend: 1 }, { date: ago(790), dividend: 1 }], NOW).annual, null);
  });

  test("un versement annoncé dans le futur lointain est ignoré", () => {
    const rows = [{ date: new Date(NOW + 200 * DAY).toISOString().slice(0, 10), dividend: 5 },
      ...[10, 100, 190, 280].map((d) => ({ date: ago(d), dividend: 0.5 }))];
    assert.equal(annualizeDividends(rows, NOW).annual, 2);
  });
});

describe("Devises de cotation", () => {
  test("suffixes et places de cotation", () => {
    assert.equal(detectQuoteCurrency({ ticker: "SAP.DE" }), "EUR");
    assert.equal(detectQuoteCurrency({ ticker: "NESN.SW" }), "CHF");
    assert.equal(detectQuoteCurrency({ ticker: "SHEL.L" }), "GBp");
    assert.equal(detectQuoteCurrency({ ticker: "7203.T" }), "JPY");
    assert.equal(detectQuoteCurrency({ ticker: "AAPL", exchange: "NASDAQ" }), "USD");
    assert.equal(detectQuoteCurrency({ ticker: "BTC-USD" }), "USD");
    assert.equal(detectQuoteCurrency({ ticker: "CSPX.L", apiCurrency: "USD" }), "USD", "la devise du profil prime sur le suffixe");
  });

  test("les pence sont convertis en livres", () => {
    const q = normalizeQuoteUnits({ price: 2712, close: 2712, previousClose: 2700, change: 12, dividend: 104.5 }, "GBp");
    assert.equal(q.currency, "GBP");
    assert.equal(q.quoteCurrency, "GBp");
    assert.equal(q.price, 27.12);
    assert.equal(q.previousClose, 27);
    assert.equal(q.dividend, 1.045);
  });

  test("action londonienne ajoutée : prix, total et dividende en livres", async () => {
    h.fmp.quotes["SHEL.L"] = { symbol: "SHEL.L", name: "Shell", price: 2712, previousClose: 2700, change: 12, exchange: "LSE" };
    h.fmp.profiles["SHEL.L"] = { symbol: "SHEL.L", companyName: "Shell plc", sector: "Energy", industry: "Oil", country: "GB", currency: "GBp" };
    h.fmp.dividends["SHEL.L"] = [10, 100, 190, 280].map((d) => ({ date: new Date(Date.now() - d * DAY).toISOString().slice(0, 10), adjDividend: 26 }));
    const { token } = await h.registerUser();
    const res = await addStock(token, { ticker: "SHEL.L", quantity: 10, pru: 25 });
    assert.equal(res.status, 201);
    const s = res.body.stock;
    assert.equal(s.currency, "GBP");
    assert.equal(s.close, 27.12);
    assert.ok(Math.abs(s.total - 271.2) < 1e-9);
    assert.ok(Math.abs(s.dividend - 1.04) < 1e-9);
    assert.ok(Math.abs(s.dividendYield - (104 / 2712) * 100) < 1e-9);
    assert.ok(Math.abs(s.performance - 8.48) < 1e-9);
  });

  test("action allemande sans devise dans la cotation : EUR (et non USD)", async () => {
    h.fmp.quotes["SAP.DE"] = { symbol: "SAP.DE", name: "SAP", price: 230, exchange: "XETRA" };
    const { token } = await h.registerUser();
    const res = await addStock(token, { ticker: "SAP.DE", quantity: 1 });
    assert.equal(res.body.stock.currency, "EUR");
  });

  test("un prix à 0 n'est jamais enregistré", async () => {
    h.fmp.quotes.ZERO = { symbol: "ZERO", name: "Zero", price: 0, exchange: "NASDAQ" };
    const { token } = await h.registerUser();
    const res = await addStock(token, { ticker: "ZERO", quantity: 1 });
    assert.equal(res.status, 404);
    assert.equal(await h.db.collection("prices").findOne({ symbol: "ZERO" }), null);
  });
});

describe("Variation du jour", () => {
  test("calculée depuis la clôture de la veille, en valeur et en %", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 10, pru: 150 });
    const { body } = await h.request("GET", "/api/user/portfolio", { token });
    const s = body.stocks[0];
    assert.equal(s.previousClose, 199);
    assert.equal(s.dayChange, 1);
    assert.ok(Math.abs(s.dayChangePercent - (1 / 199) * 100) < 1e-9);
    assert.equal(s.dayChangeValue, 10);
  });
});

describe("GET /api/fx", () => {
  test("renvoie les taux BCE (base EUR) et les met en cache", async () => {
    const a = await h.request("GET", "/api/fx");
    assert.equal(a.status, 200);
    assert.equal(a.body.base, "EUR");
    assert.equal(a.body.rates.EUR, 1);
    assert.equal(a.body.rates.USD, 1.14);
    assert.equal(a.body.stale, false);
    await h.request("GET", "/api/fx");
    assert.equal(h.fx.calls, 1, "un seul appel à Frankfurter grâce au cache");
  });

  test("API indisponible : taux de secours signalés comme périmés", async () => {
    h.fx.failWith = 503;
    const res = await h.request("GET", "/api/fx");
    assert.equal(res.status, 200);
    assert.equal(res.body.stale, true);
    assert.ok(res.body.rates.USD > 0);
  });

  test("conversion en euros", () => {
    const rates = { USD: 1.14, GBP: 0.86 };
    assert.ok(Math.abs(fx.toEUR(114, "USD", rates) - 100) < 1e-9);
    assert.equal(fx.toEUR(50, "EUR", rates), 50);
    assert.equal(fx.toEUR(10, "XYZ", rates), null);
  });
});
