// Tests : profil utilisateur (GET / PATCH /api/user/profile)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const { DEFAULT_PROFILE } = require("../services/profile");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const get = (token) => h.request("GET", "/api/user/profile", { token });
const patch = (token, body) => h.request("PATCH", "/api/user/profile", { token, body });

describe("GET /api/user/profile", () => {
  test("renvoie les valeurs par défaut pour un nouveau compte", async () => {
    const u = await h.registerUser();
    const res = await get(u.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.email, u.email);
    assert.deepEqual(res.body.profile, { ...DEFAULT_PROFILE });
  });

  test("exige d'être connecté", async () => {
    assert.equal((await h.request("GET", "/api/user/profile")).status, 401);
  });
});

describe("PATCH /api/user/profile", () => {
  test("met à jour partiellement et normalise les valeurs", async () => {
    const u = await h.registerUser();
    const res = await patch(u.token, {
      displayName: "  Alex   G ",
      baseCurrency: "usd",
      theme: "dark",
      discreetMode: true,
      goalAmount: "150000,5",
      goalDate: "2030-12-31",
      horizon: "long",
      riskProfile: "dynamique",
    });
    assert.equal(res.status, 200);
    const p = res.body.profile;
    assert.equal(p.displayName, "Alex G");
    assert.equal(p.baseCurrency, "USD");
    assert.equal(p.goalAmount, 150000.5);
    assert.equal(p.avatarColor, "emerald", "champ non envoyé : valeur par défaut conservée");

    await patch(u.token, { theme: "light" });
    const again = (await get(u.token)).body.profile;
    assert.equal(again.theme, "light");
    assert.equal(again.displayName, "Alex G", "les autres champs sont conservés");
  });

  test("permet d'effacer un objectif (null ou chaîne vide)", async () => {
    const u = await h.registerUser();
    await patch(u.token, { goalAmount: 50000, horizon: "moyen" });
    const res = await patch(u.token, { goalAmount: null, horizon: "" });
    assert.equal(res.body.profile.goalAmount, null);
    assert.equal(res.body.profile.horizon, null);
  });

  test("refuse les valeurs invalides et les champs inconnus sans rien modifier", async () => {
    const u = await h.registerUser();
    const bad = [
      { baseCurrency: "JPY" },
      { theme: "rose" },
      { discreetMode: "oui" },
      { goalAmount: -10 },
      { goalAmount: 1e13 },
      { goalDate: "2030-02-30" },
      { displayName: "x".repeat(41) },
      { displayName: "<script>" },
      { homePage: "https://exemple.com" },
      { homePage: "/analytics/inconnue" },
      { homePage: "constructor" },
      { email: "pirate@exemple.fr" },
      { password: "Nouveau#123456" },
      {},
    ];
    for (const body of bad) {
      const res = await patch(u.token, body);
      assert.equal(res.status, 400, `refusé : ${JSON.stringify(body)}`);
    }
    const stored = await h.db.collection("users").findOne({ email: u.email });
    assert.equal(stored.profile, undefined, "aucune écriture en base");
    assert.equal((await h.request("POST", "/api/auth/login", { body: { email: u.email, password: u.password } })).status, 200);
  });

  test("page d'accueil : nouvelles adresses acceptées, anciennes (/analytics…) converties", async () => {
    const u = await h.registerUser();
    const res = await patch(u.token, { homePage: "/tableau-de-bord" });
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.homePage, "/tableau-de-bord");

    const legacy = await patch(u.token, { homePage: "/analytics/geographie" });
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.profile.homePage, "/analyses/repartition");
    const stored = await h.db.collection("users").findOne({ email: u.email });
    assert.equal(stored.profile.homePage, "/analyses/repartition", "enregistrée sous la nouvelle adresse");
  });

  test("page d'accueil enregistrée avant les onglets : relue sous la nouvelle adresse", async () => {
    const u = await h.registerUser();
    await h.db.collection("users").updateOne({ email: u.email }, { $set: { "profile.homePage": "/analytics" } });
    assert.equal((await get(u.token)).body.profile.homePage, "/tableau-de-bord");
  });

  test("objectifs : rente visée et hypothèses de projection enregistrées et normalisées", async () => {
    const u = await h.registerUser();
    const res = await patch(u.token, {
      goalAmount: 1000000,
      incomeGoalMonthly: "2000",
      monthlySavings: 500,
      expectedReturn: "6,5",
      dividendYield: 3.456,
      inflationRate: 2,
    });
    assert.equal(res.status, 200);
    const p = res.body.profile;
    assert.equal(p.incomeGoalMonthly, 2000);
    assert.equal(p.monthlySavings, 500);
    assert.equal(p.expectedReturn, 6.5);
    assert.equal(p.dividendYield, 3.46);
    assert.equal(p.inflationRate, 2);
    const again = (await get(u.token)).body.profile;
    assert.equal(again.expectedReturn, 6.5, "relu après enregistrement");

    const cleared = await patch(u.token, { incomeGoalMonthly: null, expectedReturn: "" });
    assert.equal(cleared.body.profile.incomeGoalMonthly, null);
    assert.equal(cleared.body.profile.expectedReturn, null);
    assert.equal(cleared.body.profile.monthlySavings, 500, "les autres hypothèses sont conservées");
  });

  test("objectifs : rendement négatif accepté, hypothèses hors bornes refusées", async () => {
    const u = await h.registerUser();
    assert.equal((await patch(u.token, { expectedReturn: -2 })).status, 200);
    const bad = [
      { incomeGoalMonthly: -1 },
      { monthlySavings: "beaucoup" },
      { expectedReturn: 25 },
      { expectedReturn: -11 },
      { dividendYield: 0 },
      { dividendYield: 16 },
      { inflationRate: -1 },
      { inflationRate: 20 },
      { inflationRate: true },
    ];
    for (const body of bad) {
      const res = await patch(u.token, body);
      assert.equal(res.status, 400, `refusé : ${JSON.stringify(body)}`);
    }
    assert.equal((await get(u.token)).body.profile.expectedReturn, -2, "rien d'autre n'est modifié");
  });

  test("un utilisateur ne modifie que son propre profil", async () => {
    const a = await h.registerUser();
    const b = await h.registerUser();
    await patch(a.token, { displayName: "Alice" });
    assert.equal((await get(b.token)).body.profile.displayName, "");
  });
});
