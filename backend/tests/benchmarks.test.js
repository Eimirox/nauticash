// Tests : indices de référence (GET /api/market/benchmarks)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const benchmarks = require("../services/benchmarks");

before(h.start);
after(h.stop);
beforeEach(() => {
  h.resetState();
  h.fmp.history = {
    "^FCHI": [
      { symbol: "^FCHI", date: "2026-09-25", price: 7800.5, volume: 1 },
      { symbol: "^FCHI", date: "2026-09-24", price: 7750, volume: 1 },
      { symbol: "^FCHI", date: "2026-09-23", price: 0, volume: 1 },
    ],
  };
});

const get = (token, key) => h.request("GET", `/api/market/benchmarks/${key}`, { token });
const historyCalls = () => h.fmp.calls.filter((c) => c.endpoint === "light").length;

describe("GET /api/market/benchmarks", () => {
  test("exige d'être connecté", async () => {
    assert.equal((await h.request("GET", "/api/market/benchmarks")).status, 401);
    assert.equal((await h.request("GET", "/api/market/benchmarks/CAC40")).status, 401);
  });

  test("liste les indices disponibles", async () => {
    const { token } = await h.registerUser();
    const res = await h.request("GET", "/api/market/benchmarks", { token });
    assert.deepEqual(res.body.map((b) => b.key), ["CAC40", "SP500", "MSCIWORLD"]);
  });

  test("renvoie l'historique trié, sans prix nuls", async () => {
    const { token } = await h.registerUser();
    const res = await get(token, "cac40");
    assert.equal(res.status, 200);
    assert.equal(res.body.label, "CAC 40");
    assert.deepEqual(res.body.points, [
      { date: "2026-09-24", close: 7750 },
      { date: "2026-09-25", close: 7800.5 },
    ]);
    assert.equal(res.body.stale, false);
    assert.equal(h.fmp.calls.find((c) => c.endpoint === "light").symbol, "^FCHI");
  });

  test("met en cache : un seul appel FMP pour plusieurs utilisateurs", async () => {
    const a = await h.registerUser();
    const b = await h.registerUser();
    await get(a.token, "CAC40");
    await get(b.token, "CAC40");
    await get(a.token, "CAC40");
    assert.equal(historyCalls(), 1);
  });

  test("données périmées resservies si FMP échoue", async () => {
    const { token } = await h.registerUser();
    await get(token, "CAC40");
    await h.db.collection("benchmarks").updateOne(
      { key: "CAC40" },
      { $set: { updatedAt: new Date(Date.now() - benchmarks.CACHE_TTL - 1000) } }
    );
    h.fmp.failWith = 500;
    const res = await get(token, "CAC40");
    assert.equal(res.status, 200);
    assert.equal(res.body.stale, true);
    assert.equal(res.body.points.length, 2);
  });

  test("503 sans données en cache si FMP échoue, 404 pour un indice inconnu", async () => {
    const { token } = await h.registerUser();
    h.fmp.failWith = 500;
    assert.equal((await get(token, "SP500")).status, 503);
    assert.equal((await get(token, "NASDAQ")).status, 404);
  });
});
