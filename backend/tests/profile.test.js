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

  test("stratégie : style, allocation cible et limite par ligne enregistrés et normalisés", async () => {
    const u = await h.registerUser();
    const res = await patch(u.token, {
      strategy: "dividendes",
      targetAllocation: { europe: "45", northAmerica: 35, asiaPacific: 10, emerging: "4,5", commodities: 5.5 },
      maxPositionWeight: "8",
    });
    assert.equal(res.status, 200);
    const p = res.body.profile;
    assert.equal(p.strategy, "dividendes");
    assert.deepEqual(p.targetAllocation, {
      europe: 45, northAmerica: 35, asiaPacific: 10, emerging: 4.5, world: 0, commodities: 5.5, crypto: 0,
    });
    assert.equal(p.maxPositionWeight, 8);

    // Nouvelle allocation : remplace entièrement l'ancienne
    await patch(u.token, { targetAllocation: { world: 90, emerging: 10 } });
    const again = (await get(u.token)).body.profile;
    assert.equal(again.targetAllocation.europe, 0);
    assert.equal(again.targetAllocation.world, 90);
    assert.equal(again.strategy, "dividendes", "les autres champs sont conservés");

    const cleared = await patch(u.token, { strategy: null, targetAllocation: null, maxPositionWeight: "" });
    assert.equal(cleared.body.profile.strategy, null);
    assert.equal(cleared.body.profile.targetAllocation, null);
    assert.equal(cleared.body.profile.maxPositionWeight, null);
  });

  test("stratégie : valeurs invalides refusées sans rien modifier", async () => {
    const u = await h.registerUser();
    await patch(u.token, { strategy: "passive", targetAllocation: { world: 100 }, maxPositionWeight: 50 });
    const bad = [
      { strategy: "spéculative" },
      { strategy: 3 },
      { targetAllocation: { world: 60 } }, // total 60 %
      { targetAllocation: { world: 80, europe: 30 } }, // total 110 %
      { targetAllocation: { world: 90, mars: 10 } }, // poche inconnue
      { targetAllocation: { world: 110, europe: -10 } },
      { targetAllocation: { world: "tout" } },
      { targetAllocation: [100] },
      { targetAllocation: "world" },
      { maxPositionWeight: 0 },
      { maxPositionWeight: 101 },
    ];
    for (const body of bad) {
      const res = await patch(u.token, body);
      assert.equal(res.status, 400, `refusé : ${JSON.stringify(body)}`);
    }
    const p = (await get(u.token)).body.profile;
    assert.equal(p.strategy, "passive");
    assert.equal(p.targetAllocation.world, 100);
    assert.equal(p.maxPositionWeight, 50);
  });

  test("un utilisateur ne modifie que son propre profil", async () => {
    const a = await h.registerUser();
    const b = await h.registerUser();
    await patch(a.token, { displayName: "Alice" });
    assert.equal((await get(b.token)).body.profile.displayName, "");
  });
});

describe("Préférences d'affichage (profile.viewPrefs)", () => {
  test("vides par défaut pour un nouveau compte", async () => {
    const u = await h.registerUser();
    assert.deepEqual((await get(u.token)).body.profile.viewPrefs, {});
  });

  test("enregistre le tri des dividendes et les années du graphique, relus à la connexion suivante", async () => {
    const u = await h.registerUser();
    const res = await patch(u.token, {
      viewPrefs: { dividendSort: { key: "yieldOnCost", dir: "asc" }, historyYears: [2025, 2026, 2025] },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.profile.viewPrefs, {
      dividendSort: { key: "yieldOnCost", dir: "asc" },
      historyYears: [2026, 2025],
    });
    // Nouvelle « session » : un nouveau login relit les mêmes préférences
    const login = await h.request("POST", "/api/auth/login", { body: { email: u.email, password: u.password } });
    const again = (await get(login.body.token || u.token)).body.profile.viewPrefs;
    assert.deepEqual(again.dividendSort, { key: "yieldOnCost", dir: "asc" });
  });

  test("fusion clé par clé : une préférence n'écrase pas les autres, null efface seulement la sienne", async () => {
    const u = await h.registerUser();
    await patch(u.token, { viewPrefs: { dividendSort: { key: "totalAnnual", dir: "desc" } } });
    await patch(u.token, { viewPrefs: { portfolioSort: { key: "performance", dir: "desc" }, portfolioAccount: "PEA" } });
    let prefs = (await get(u.token)).body.profile.viewPrefs;
    assert.equal(prefs.dividendSort.key, "totalAnnual");
    assert.equal(prefs.portfolioSort.key, "performance");
    assert.equal(prefs.portfolioAccount, "PEA");

    const cleared = await patch(u.token, { viewPrefs: { dividendSort: null } });
    assert.equal(cleared.status, 200);
    prefs = cleared.body.profile.viewPrefs;
    assert.equal(prefs.dividendSort, undefined, "préférence effacée");
    assert.equal(prefs.portfolioAccount, "PEA", "les autres sont conservées");
    const stored = await h.db.collection("users").findOne({ email: u.email });
    assert.equal(stored.profile.viewPrefs.dividendSort, undefined, "supprimée en base, pas laissée à null");
  });

  test("n'écrase pas le reste du profil (et inversement)", async () => {
    const u = await h.registerUser();
    await patch(u.token, { displayName: "Alex", viewPrefs: { historyYears: [2026] } });
    await patch(u.token, { theme: "dark" });
    const p = (await get(u.token)).body.profile;
    assert.equal(p.displayName, "Alex");
    assert.equal(p.theme, "dark");
    assert.deepEqual(p.viewPrefs.historyYears, [2026]);
  });

  test("liste blanche : clés inconnues et valeurs invalides refusées sans rien écrire", async () => {
    const u = await h.registerUser();
    const bad = [
      { viewPrefs: {} },
      { viewPrefs: [] },
      { viewPrefs: "tri" },
      { viewPrefs: null },
      { viewPrefs: { monMotDePasse: "x" } },
      { viewPrefs: { __proto__: { admin: true }, constructor: 1 } },
      { viewPrefs: { "a.b": 1 } },
      { viewPrefs: { dividendSort: { key: "ticker", dir: "asc" } } }, // colonne non triable
      { viewPrefs: { dividendSort: { key: "yieldPercent", dir: "up" } } },
      { viewPrefs: { dividendSort: { key: "yieldPercent", dir: "asc", extra: 1 } } },
      { viewPrefs: { dividendSort: "yieldPercent" } },
      { viewPrefs: { portfolioSort: { key: "$where", dir: "asc" } } },
      { viewPrefs: { portfolioSort: { key: "total", dir: "none" } } },
      { viewPrefs: { portfolioAccount: "" } },
      { viewPrefs: { portfolioAccount: "<script>" } },
      { viewPrefs: { portfolioAccount: "x".repeat(41) } },
      { viewPrefs: { historyYears: [] } },
      { viewPrefs: { historyYears: [1999] } },
      { viewPrefs: { historyYears: ["2026"] } },
      { viewPrefs: { historyYears: [2020, 2021, 2022, 2023, 2024, 2025, 2026] } },
      { viewPrefs: { historyYears: 2026 } },
      // une seule valeur invalide refuse toute la requête
      { viewPrefs: { historyYears: [2026], dividendSort: { key: "x", dir: "asc" } } },
    ];
    for (const body of bad) {
      const res = await patch(u.token, body);
      assert.equal(res.status, 400, `refusé : ${JSON.stringify(body)}`);
    }
    const stored = await h.db.collection("users").findOne({ email: u.email });
    assert.equal(stored.profile, undefined, "aucune écriture en base");
  });

  test("message précis sur la préférence refusée", async () => {
    const u = await h.registerUser();
    const unknown = await patch(u.token, { viewPrefs: { couleur: "rose" } });
    assert.match(unknown.body.error, /inconnue : couleur/);
    const badSort = await patch(u.token, { viewPrefs: { dividendSort: { key: "x", dir: "asc" } } });
    assert.match(badSort.body.error, /Tri des dividendes/);
  });

  test("valeurs invalides déjà en base ignorées à la lecture", async () => {
    const u = await h.registerUser();
    await h.db.collection("users").updateOne(
      { email: u.email },
      { $set: { "profile.viewPrefs": { dividendSort: { key: "piratage", dir: "asc" }, historyYears: [2026], inconnue: 1 } } },
    );
    assert.deepEqual((await get(u.token)).body.profile.viewPrefs, { historyYears: [2026] });
  });

  test("exige d'être connecté et chaque utilisateur garde ses préférences", async () => {
    assert.equal((await h.request("PATCH", "/api/user/profile", { body: { viewPrefs: { historyYears: [2026] } } })).status, 401);
    const a = await h.registerUser();
    const b = await h.registerUser();
    await patch(a.token, { viewPrefs: { portfolioAccount: "CTO" } });
    assert.deepEqual((await get(b.token)).body.profile.viewPrefs, {});
  });
});
