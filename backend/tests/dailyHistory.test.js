// Tests : historique quotidien automatique (services/dailyHistory.js, GET /api/user/history/daily)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const dailyHistory = require("../services/dailyHistory");
const job = require("../jobs/dailySnapshot");
const config = require("../config/providers");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const users = () => h.db.collection("users");
const prices = () => h.db.collection("prices");

// Utilisateur avec positions et cash écrits directement en base (cours en cache, aucun appel API)
async function userWith({ portfolio = [], cashAmount = 0, cashCurrency = "EUR" } = {}) {
  const u = await h.registerUser();
  await users().updateOne({ email: u.email }, { $set: { portfolio, cashAmount, cashCurrency } });
  const doc = await users().findOne({ email: u.email });
  return { ...u, id: String(doc._id) };
}

async function seedPrices() {
  await prices().insertOne({ symbol: "AIR.PA", close: 150, currency: "EUR" });
  await prices().insertOne({ symbol: "AAPL", close: 228, currency: "USD" }); // 228 / 1.14 = 200 €
}

const DAY = new Date("2026-09-28T21:45:00Z");

describe("snapshotAll", () => {
  test("enregistre la valeur du jour en euros (positions converties + cash)", async () => {
    await seedPrices();
    const u = await userWith({
      portfolio: [{ ticker: "AIR.PA", quantity: 10, pru: 100 }, { ticker: "AAPL", quantity: 2, pru: 150 }],
      cashAmount: 114,
      cashCurrency: "USD",
    });

    const result = await dailyHistory.snapshotAll({ date: DAY });
    assert.deepEqual(result, { date: "2026-09-28", users: 1 });

    const rows = await h.db.collection("history_daily").find({ userId: u.id }).toArray();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].date, "2026-09-28");
    assert.equal(rows[0].invested, 1900); // 1500 € + 2 × 200 €
    assert.equal(rows[0].cash, 100);
    assert.equal(rows[0].value, 2000);
    assert.equal(rows[0].missing, 0);
    assert.equal(rows[0].currency, "EUR");
  });

  test("relancé le même jour, remplace la valeur au lieu de créer un doublon", async () => {
    await seedPrices();
    const u = await userWith({ portfolio: [{ ticker: "AIR.PA", quantity: 1 }] });
    await dailyHistory.snapshotAll({ date: DAY });
    await prices().updateOne({ symbol: "AIR.PA" }, { $set: { close: 160 } });
    await dailyHistory.snapshotAll({ date: new Date("2026-09-28T23:00:00Z") });

    const rows = await h.db.collection("history_daily").find({ userId: u.id }).toArray();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].value, 160);
  });

  test("ignore les comptes vides et signale les positions sans cours", async () => {
    await seedPrices();
    await userWith();
    const u = await userWith({ portfolio: [{ ticker: "AIR.PA", quantity: 1 }, { ticker: "INCONNU", quantity: 5 }] });

    const result = await dailyHistory.snapshotAll({ date: DAY });
    assert.equal(result.users, 1);
    const [row] = await h.db.collection("history_daily").find({ userId: u.id }).toArray();
    assert.equal(row.value, 150);
    assert.equal(row.missing, 1);
  });

  test("met à jour le relevé mensuel automatique mais jamais une valeur saisie à la main", async () => {
    await seedPrices();
    const auto = await userWith({ portfolio: [{ ticker: "AIR.PA", quantity: 1 }] });
    const manual = await userWith({ portfolio: [{ ticker: "AIR.PA", quantity: 2 }] });
    await h.request("POST", "/api/user/history", { token: manual.token, body: { date: "2026-09-10", value: 999 } });

    await dailyHistory.snapshotAll({ date: DAY });

    const monthly = h.db.collection("history");
    const a = await monthly.findOne({ userId: auto.id, year: 2026, month: "September" });
    assert.equal(a.value, 150);
    assert.equal(a.auto, true);
    const m = await monthly.findOne({ userId: manual.id, year: 2026, month: "September" });
    assert.equal(m.value, 999, "la saisie manuelle est conservée");

    // Une nouvelle photo manuelle remplace la valeur automatique du mois
    await h.request("POST", "/api/user/history", { token: auto.token, body: { date: "2026-09-29", value: 500 } });
    await dailyHistory.snapshotAll({ date: new Date("2026-09-30T21:45:00Z") });
    assert.equal((await monthly.findOne({ userId: auto.id, year: 2026, month: "September" })).value, 500);
  });

  test("le job planifié exécute la photo et garde le résultat", async () => {
    await seedPrices();
    await userWith({ portfolio: [{ ticker: "AIR.PA", quantity: 1 }] });
    const result = await job.run();
    assert.equal(result.users, 1);
    assert.equal(job.getStats().lastResult.users, 1);
  });

  test("planification : désactivée dans les tests, expression par défaut valide", () => {
    assert.equal(job.start(), null);
    const original = { ...config.cron.dailyHistory };
    try {
      config.cron.dailyHistory.enabled = true;
      assert.ok(job.start());
      job.stop();
      config.cron.dailyHistory.schedule = "n'importe quoi";
      assert.equal(job.start(), null);
    } finally {
      Object.assign(config.cron.dailyHistory, original);
    }
  });
});

describe("GET /api/user/history/daily", () => {
  test("exige d'être connecté", async () => {
    assert.equal((await h.request("GET", "/api/user/history/daily")).status, 401);
  });

  test("renvoie uniquement ses propres points, triés par date", async () => {
    await seedPrices();
    const u = await userWith({ portfolio: [{ ticker: "AIR.PA", quantity: 1 }] });
    const other = await userWith({ portfolio: [{ ticker: "AIR.PA", quantity: 3 }] });
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await dailyHistory.snapshotAll({ date: today });
    await prices().updateOne({ symbol: "AIR.PA" }, { $set: { close: 140 } });
    await dailyHistory.snapshotAll({ date: yesterday });

    const res = await h.request("GET", "/api/user/history/daily?days=30", { token: u.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((p) => p.date), [dailyHistory.dayKey(yesterday), dailyHistory.dayKey(today)]);
    assert.deepEqual(res.body.map((p) => p.value), [140, 150]);
    assert.ok(!("userId" in res.body[0]));

    const res2 = await h.request("GET", "/api/user/history/daily", { token: other.token });
    assert.deepEqual(res2.body.map((p) => p.value), [420, 450]);
  });

  test("la suppression du compte efface aussi l'historique quotidien", async () => {
    await seedPrices();
    const u = await userWith({ portfolio: [{ ticker: "AIR.PA", quantity: 1 }] });
    await dailyHistory.snapshotAll({ date: DAY });
    const res = await h.request("DELETE", "/api/auth/account", { token: u.token, body: { currentPassword: u.password } });
    assert.equal(res.status, 200);
    assert.equal((await h.db.collection("history_daily").find({}).toArray()).length, 0);
  });
});
