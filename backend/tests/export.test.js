// Tests : export RGPD des données du compte (GET /api/user/export)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const users = () => h.db.collection("users");

// Compte rempli directement en base (aucun appel de cours)
async function seededUser() {
  const u = await h.registerUser();
  const doc = await users().findOne({ email: u.email });
  const id = String(doc._id);
  await users().updateOne(
    { _id: doc._id },
    {
      $set: {
        portfolio: [
          { ticker: "AIR.PA", quantity: 10, pru: 101.5, account: "PEA", fees: null },
          { ticker: "CW8.PA", quantity: 2, pru: 400, account: null, fees: 0.38 },
        ],
        cashAmount: 1234.5,
        cashCurrency: "EUR",
        profile: { displayName: "Alex" },
        resetPasswordToken: "secret-hash",
      },
    }
  );
  await h.db.collection("history").insertOne({ userId: id, year: 2026, month: "Septembre", value: 5000, auto: true });
  await h.db.collection("history_daily").insertOne({ userId: id, date: "2026-09-28", value: 5100, invested: 4000, cash: 1234.5, currency: "EUR" });
  await h.db.collection("history_daily").insertOne({ userId: id, date: "2026-09-27", value: 5000, invested: 4000, cash: 1234.5, currency: "EUR" });
  await h.db.collection("transactions").insertOne({ userId: doc._id, action: "Ajout", ticker: "AIR.PA", timestamp: new Date("2026-09-01T10:00:00Z") });
  return { ...u, id, _id: doc._id };
}

describe("GET /api/user/export", () => {
  test("JSON : toutes les données du compte, sans secrets ni données des autres", async () => {
    const u = await seededUser();
    const other = await seededUser();

    const res = await h.request("GET", "/api/user/export", { token: u.token });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition"), /attachment; filename="nauticash-export-\d{4}-\d{2}-\d{2}\.json"/);
    assert.equal(res.headers.get("cache-control"), "no-store");

    const data = res.body;
    assert.equal(data.account.email, u.email);
    assert.equal(data.account.profile.displayName, "Alex");
    assert.deepEqual(data.portfolio.map((p) => p.ticker), ["AIR.PA", "CW8.PA"]);
    assert.equal(data.portfolio[1].fees, 0.38);
    assert.deepEqual(data.cash, { amount: 1234.5, currency: "EUR" });
    assert.equal(data.history.monthly.length, 1);
    assert.deepEqual(data.history.daily.map((d) => d.date), ["2026-09-27", "2026-09-28"], "triées par date");
    assert.equal(data.transactions.length, 1);
    assert.equal(data.transactions[0].ticker, "AIR.PA");

    assert.ok(!res.text.includes("password"), "aucun mot de passe (même hashé)");
    assert.ok(!res.text.includes("secret-hash"), "aucun jeton de réinitialisation");
    assert.ok(!res.text.includes(other.email));
    assert.ok(!res.text.includes(other.id));
  });

  test("CSV positions : séparateur ; et virgule décimale, ligne de cash, BOM UTF-8", async () => {
    const u = await seededUser();
    const res = await h.request("GET", "/api/user/export?format=csv&dataset=positions", { token: u.token });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /^text\/csv/);
    assert.match(res.headers.get("content-disposition"), /nauticash-positions-\d{4}-\d{2}-\d{2}\.csv/);

    const lines = res.text.replace(/^﻿/, "").trim().split("\r\n");
    assert.equal(lines[0], "ticker;quantite;pru;enveloppe;frais_annuels_pct;devise");
    assert.equal(lines[1], "AIR.PA;10;101,5;PEA;;");
    assert.equal(lines[2], "CW8.PA;2;400;;0,38;");
    assert.equal(lines[3], "CASH;1234,5;;;;EUR");
  });

  test("CSV historique : valeurs quotidiennes triées", async () => {
    const u = await seededUser();
    const res = await h.request("GET", "/api/user/export?format=csv&dataset=history", { token: u.token });
    assert.equal(res.status, 200);
    const lines = res.text.replace(/^﻿/, "").trim().split("\r\n");
    assert.deepEqual(lines, ["date;valeur;investi;cash;devise", "2026-09-27;5000;4000;1234,5;EUR", "2026-09-28;5100;4000;1234,5;EUR"]);
  });

  test("CSV : neutralise les formules (injection CSV)", async () => {
    const u = await seededUser();
    await users().updateOne({ _id: u._id }, { $set: { portfolio: [{ ticker: "=HYPERLINK(1)", quantity: 1, pru: 1 }] } });
    const res = await h.request("GET", "/api/user/export?format=csv", { token: u.token });
    assert.ok(res.text.includes("'=HYPERLINK(1)"));
  });

  test("compte vide : export valide", async () => {
    const u = await h.registerUser();
    const res = await h.request("GET", "/api/user/export", { token: u.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.portfolio, []);
    assert.deepEqual(res.body.history, { monthly: [], daily: [] });
    assert.deepEqual(res.body.cash, { amount: 0, currency: "EUR" });
  });

  test("paramètres invalides et accès non connecté", async () => {
    const u = await h.registerUser();
    assert.equal((await h.request("GET", "/api/user/export?format=xml", { token: u.token })).status, 400);
    assert.equal((await h.request("GET", "/api/user/export?format=csv&dataset=users", { token: u.token })).status, 400);
    assert.equal((await h.request("GET", "/api/user/export")).status, 401);
  });

  test("compte supprimé : 404", async () => {
    const u = await h.registerUser();
    await users().deleteOne({ email: u.email });
    assert.equal((await h.request("GET", "/api/user/export", { token: u.token })).status, 404);
  });
});

