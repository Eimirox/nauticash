// Tests : historique mensuel de la valeur du portefeuille et transactions
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const postHistory = (token, body) => h.request("POST", "/api/user/history", { token, body });
const getHistory = async (token) => (await h.request("GET", "/api/user/history", { token })).body;

describe("/api/user/history", () => {
  test("exige d'être connecté", async () => {
    assert.equal((await h.request("GET", "/api/user/history")).status, 401);
    assert.equal((await h.request("POST", "/api/user/history", { body: { date: "2026-01-15", value: 1 } })).status, 401);
  });

  test("enregistre une valeur par mois (une nouvelle valeur remplace l'ancienne)", async () => {
    const { token } = await h.registerUser();
    assert.equal((await postHistory(token, { date: "2026-03-10", value: 1000 })).status, 201);
    assert.equal((await postHistory(token, { date: "2026-03-28", value: "1250.75" })).status, 201);

    const rows = await getHistory(token);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].year, 2026);
    assert.equal(rows[0].month, "March");
    assert.equal(rows[0].value, 1250.75);
  });

  test("renvoie l'historique trié par ordre chronologique (et non alphabétique)", async () => {
    const { token } = await h.registerUser();
    for (const [date, value] of [
      ["2026-12-15", 12],
      ["2025-11-15", 11],
      ["2026-04-15", 4],
      ["2026-08-15", 8],
      ["2026-02-15", 2],
    ]) {
      await postHistory(token, { date, value });
    }
    const rows = await getHistory(token);
    assert.deepEqual(
      rows.map((r) => `${r.year}-${r.month}`),
      ["2025-November", "2026-February", "2026-April", "2026-August", "2026-December"]
    );
  });

  test("refuse une date ou une valeur invalide", async () => {
    const { token } = await h.registerUser();
    for (const body of [
      { date: "pas-une-date", value: 10 },
      { value: 10 },
      { date: "2026-01-15", value: "abc" },
      { date: "2026-01-15" },
    ]) {
      const res = await postHistory(token, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.deepEqual(await getHistory(token), []);
  });

  test("chaque utilisateur a son propre historique", async () => {
    const alice = await h.registerUser();
    const bob = await h.registerUser();
    await postHistory(alice.token, { date: "2026-05-15", value: 500 });
    await postHistory(bob.token, { date: "2026-05-15", value: 9 });

    const aliceRows = await getHistory(alice.token);
    const bobRows = await getHistory(bob.token);
    assert.equal(aliceRows.length, 1);
    assert.equal(aliceRows[0].value, 500);
    assert.equal(bobRows.length, 1);
    assert.equal(bobRows[0].value, 9);
  });
});

describe("GET /api/transactions", () => {
  test("renvoie uniquement les transactions de l'utilisateur connecté", async () => {
    const alice = await h.registerUser();
    const bob = await h.registerUser();
    const aliceId = new mongoose.Types.ObjectId(jwt.decode(alice.token).userId);
    const bobId = new mongoose.Types.ObjectId(jwt.decode(bob.token).userId);

    await h.db.collection("transactions").insertOne({ userId: aliceId, action: "Ajout", ticker: "AAPL", timestamp: new Date() });
    await h.db.collection("transactions").insertOne({ userId: bobId, action: "Ajout", ticker: "MSFT", timestamp: new Date() });

    const res = await h.request("GET", "/api/transactions", { token: alice.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((t) => t.ticker), ["AAPL"]);
    assert.equal((await h.request("GET", "/api/transactions")).status, 401);
  });
});
