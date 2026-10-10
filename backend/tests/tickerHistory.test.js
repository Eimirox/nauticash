// Tests : historique d'un titre détenu (GET /api/market/history/:ticker)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const benchmarks = require("../services/benchmarks");
const { lastYear } = require("../services/tickerHistory");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const DAY = 86400;
const day = (daysAgo) => new Date(Date.now() - daysAgo * DAY * 1000).toISOString().slice(0, 10);
// Clôture à 15:30 UTC « il y a n jours » (gmtoffset 0 : la date reste celle du jour)
const stamp = (daysAgo) => Math.floor((Date.now() - daysAgo * DAY * 1000) / 1000 / DAY) * DAY + 15.5 * 3600;

const yahooChart = (rows) => ({
  meta: { gmtoffset: 0 },
  timestamp: rows.map(([d]) => stamp(d)),
  indicators: { quote: [{ close: rows.map(([, c]) => c) }] },
});

const get = (token, ticker) => h.request("GET", `/api/market/history/${ticker}`, { token });
const holder = async () => {
  const user = await h.registerUser();
  const res = await h.request("POST", "/api/user/portfolio", { token: user.token, body: { ticker: "AAPL", quantity: 1, pru: 100 } });
  assert.equal(res.status, 201);
  return user;
};
const chartCalls = () => h.yahoo.calls.filter((c) => c.endpoint === "chart" && c.symbol === "AAPL").length;

describe("GET /api/market/history/:ticker", () => {
  test("exige d'être connecté", async () => {
    assert.equal((await h.request("GET", "/api/market/history/AAPL")).status, 401);
  });

  test("ticker invalide → 400, titre non détenu → 404 sans appel externe", async () => {
    const { token } = await h.registerUser();
    assert.equal((await get(token, "AA%20PL")).status, 400);
    const res = await get(token, "AAPL");
    assert.equal(res.status, 404);
    assert.equal(chartCalls(), 0);
    assert.equal(h.fmp.calls.filter((c) => c.endpoint === "light").length, 0);
  });

  test("renvoie 1 an de clôtures triées via Yahoo (sans quota FMP), jours vides et > 1 an écartés", async () => {
    const { token } = await holder();
    h.yahoo.charts.AAPL = yahooChart([[400, 150], [200, 180], [3, 195], [2, null], [1, 200]]);
    const res = await get(token, "aapl");
    assert.equal(res.status, 200);
    assert.equal(res.body.symbol, "AAPL");
    assert.deepEqual(res.body.points, [
      { date: day(200), close: 180 },
      { date: day(3), close: 195 },
      { date: day(1), close: 200 },
    ]);
    assert.equal(res.body.stale, false);
    assert.equal(h.fmp.calls.filter((c) => c.endpoint === "light").length, 0);
  });

  test("cache partagé : un seul appel pour plusieurs détenteurs", async () => {
    const a = await holder();
    const b = await holder();
    h.yahoo.charts.AAPL = yahooChart([[5, 190], [1, 200]]);
    assert.equal((await get(a.token, "AAPL")).status, 200);
    assert.equal((await get(b.token, "AAPL")).status, 200);
    assert.equal((await get(a.token, "AAPL")).status, 200);
    assert.equal(chartCalls(), 1);
  });

  test("Yahoo indisponible : repli sur FMP", async () => {
    const { token } = await holder();
    h.yahoo.failWith = 500;
    h.fmp.history.AAPL = [
      { symbol: "AAPL", date: day(1), price: 201 },
      { symbol: "AAPL", date: day(2), price: 199 },
    ];
    const res = await get(token, "AAPL");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.points.map((p) => p.close), [199, 201]);
  });

  test("données périmées resservies si les fournisseurs échouent, 503 sans cache", async () => {
    const { token } = await holder();
    h.yahoo.failWith = 500;
    h.fmp.failWith = 500;
    assert.equal((await get(token, "AAPL")).status, 503);

    h.yahoo.failWith = null;
    h.fmp.failWith = null;
    h.yahoo.charts.AAPL = yahooChart([[2, 190], [1, 200]]);
    assert.equal((await get(token, "AAPL")).status, 200);
    await h.db.collection("ticker_history").updateOne(
      { symbol: "AAPL" },
      { $set: { updatedAt: new Date(Date.now() - benchmarks.CACHE_TTL - 1000) } }
    );
    h.yahoo.failWith = 500;
    h.fmp.failWith = 500;
    const res = await get(token, "AAPL");
    assert.equal(res.status, 200);
    assert.equal(res.body.stale, true);
    assert.equal(res.body.points.length, 2);
  });
});

describe("lastYear", () => {
  test("ne garde que les 366 derniers jours", () => {
    const now = Date.UTC(2026, 9, 10);
    const pts = [{ date: "2025-10-08", close: 1 }, { date: "2025-10-09", close: 2 }, { date: "2026-10-09", close: 3 }];
    assert.deepEqual(lastYear(pts, now).map((p) => p.close), [2, 3]);
  });
});
