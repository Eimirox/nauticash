// Tests : sans FINNHUB_API_KEY, Finnhub est désactivé et n'est jamais appelé
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

test("sans clé : provider absent, ordre FMP puis Yahoo, aucun appel Finnhub", async () => {
  const priceService = require("../services/priceService");
  assert.equal(priceService.providers.finnhub, undefined);
  assert.deepEqual(priceService.getProviderOrder("GOOG"), ["fmp", "yahoo"]);

  const now = Math.floor(Date.now() / 1000);
  h.fmp.notCovered.GOOG = true;
  h.yahoo.charts.GOOG = { meta: { currency: "USD", regularMarketPrice: 170, previousClose: 165, regularMarketTime: now, instrumentType: "EQUITY", exchangeName: "NMS" } };
  const { token } = await h.registerUser();
  const res = await h.request("POST", "/api/user/portfolio", { token, body: { ticker: "GOOG", quantity: 1 } });
  assert.equal(res.status, 201, res.text);
  assert.equal(res.body.stock.source, "yahoo");
  assert.equal(h.finnhub.calls.length, 0);
});
