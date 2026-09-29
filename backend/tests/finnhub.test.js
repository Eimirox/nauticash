// Tests : provider Finnhub optionnel (secours US entre FMP et Yahoo), activé ici par une clé de test
process.env.NAUTICASH_TEST_FINNHUB = "1";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const now = Math.floor(Date.now() / 1000);
const add = (token, body) => h.request("POST", "/api/user/portfolio", { token, body });
const googQuote = { c: 170, d: 5, dp: 3.03, h: 171, l: 164, o: 165, pc: 165, t: now };

describe("Finnhub (FINNHUB_API_KEY renseignée)", () => {
  test("provider initialisé et placé entre FMP et Yahoo", () => {
    const priceService = require("../services/priceService");
    assert.ok(priceService.providers.finnhub);
    assert.deepEqual(priceService.getProviderOrder("GOOG"), ["fmp", "finnhub", "yahoo"]);
  });

  test("action US hors offre FMP (402) → cours Finnhub, Yahoo ne sert qu'au profil", async () => {
    h.fmp.notCovered.GOOG = true;
    h.finnhub.quotes.GOOG = googQuote;
    const { token } = await h.registerUser();

    const res = await add(token, { ticker: "GOOG", quantity: 2, pru: 100 });
    assert.equal(res.status, 201, res.text);
    const s = res.body.stock;
    assert.equal(s.close, 170);
    assert.equal(s.previousClose, 165);
    assert.equal(s.dayChange, 5);
    assert.equal(s.currency, "USD");
    assert.equal(s.source, "finnhub");
    assert.deepEqual(h.finnhub.calls, [{ endpoint: "quote", symbol: "GOOG" }]);

    const cached = await h.db.collection("prices").findOne({ symbol: "GOOG" });
    assert.equal(cached.close, 170);
    assert.ok(cached.fmpNotCoveredAt, "le refus FMP reste mémorisé");
  });

  test("FMP couvre le symbole → Finnhub n'est pas appelé", async () => {
    const { token } = await h.registerUser();
    const res = await add(token, { ticker: "AAPL", quantity: 1 });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.stock.source, "fmp");
    assert.equal(h.finnhub.calls.length, 0);
  });

  test("place européenne ou crypto : jamais envoyées à Finnhub (offre gratuite US)", async () => {
    h.fmp.notCovered["AIR.PA"] = true;
    h.fmp.notCovered["BTC-USD"] = true;
    h.yahoo.charts["AIR.PA"] = { meta: { currency: "EUR", regularMarketPrice: 150, previousClose: 148, regularMarketTime: now, instrumentType: "EQUITY", exchangeName: "PAR" } };
    h.yahoo.charts["BTC-USD"] = { meta: { currency: "USD", regularMarketPrice: 60000, previousClose: 59000, regularMarketTime: now, instrumentType: "CRYPTOCURRENCY", exchangeName: "CCC" } };
    const { token } = await h.registerUser();

    assert.equal((await add(token, { ticker: "AIR.PA", quantity: 1 })).body.stock.source, "yahoo");
    assert.equal((await add(token, { ticker: "BTC-USD", quantity: 1 })).body.stock.source, "yahoo");
    assert.equal(h.finnhub.calls.length, 0);
  });

  test("symbole inconnu chez Finnhub (réponse à zéro) ou limite atteinte (429) → Yahoo prend le relais", async () => {
    for (const [sym, price] of [["ZZZ", 12], ["YYY", 34]]) {
      h.fmp.notCovered[sym] = true;
      h.yahoo.charts[sym] = { meta: { currency: "USD", regularMarketPrice: price, previousClose: price - 1, regularMarketTime: now, instrumentType: "EQUITY", exchangeName: "NMS" } };
    }
    const { token } = await h.registerUser();

    const unknown = await add(token, { ticker: "ZZZ", quantity: 1 });
    assert.equal(unknown.status, 201, unknown.text);
    assert.equal(unknown.body.stock.source, "yahoo");
    assert.equal(unknown.body.stock.close, 12);

    h.finnhub.failWith = 429;
    const limited = await add(token, { ticker: "YYY", quantity: 1 });
    assert.equal(limited.status, 201, limited.text);
    assert.equal(limited.body.stock.source, "yahoo");
    assert.equal(h.finnhub.calls.length, 2);
  });

  test("la mesure de couverture inclut Finnhub (non pris en charge hors US)", async () => {
    const admin = await h.registerUser("admin@nauticash.test");
    const u = await h.registerUser();
    await h.db.collection("users").updateOne(
      { email: u.email },
      { $set: { portfolio: [{ ticker: "GOOG", quantity: 1, pru: 0 }, { ticker: "MC.PA", quantity: 1, pru: 0 }] } }
    );
    h.finnhub.quotes.GOOG = googQuote;

    const res = await h.request("GET", "/api/admin/coverage?providers=finnhub", { token: admin.token });
    assert.equal(res.status, 200, res.text);
    const byTicker = Object.fromEntries(res.body.tickers.map((t) => [t.ticker, t.results.finnhub.status]));
    assert.deepEqual(byTicker, { GOOG: "ok", "MC.PA": "unsupported" });
    assert.equal(res.body.summary.finnhub.coverage, 100);
  });
});
