// Tests : routes d'administration (réservées aux emails listés dans ADMIN_EMAILS)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const priceUpdater = require("../jobs/updatePrices");
const apiUsage = require("../services/apiUsage");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const ADMIN_EMAIL = "admin@nauticash.test";
const ROUTES = [
  ["GET", "/api/admin/stats"],
  ["GET", "/api/admin/health"],
  ["POST", "/api/admin/update-prices"],
  ["GET", "/api/admin/coverage"],
  ["GET", "/api/admin/diagnose/AAPL"],
  ["POST", "/api/admin/refresh/AAPL"],
];

describe("Accès aux routes /api/admin", () => {
  test("401 sans être connecté", async () => {
    for (const [method, path] of ROUTES) {
      assert.equal((await h.request(method, path)).status, 401, `${method} ${path}`);
    }
  });

  test("403 pour un utilisateur qui n'est pas administrateur", async () => {
    const { token } = await h.registerUser("simple@nauticash.test");
    for (const [method, path] of ROUTES) {
      const res = await h.request(method, path, { token });
      assert.equal(res.status, 403, `${method} ${path}`);
      assert.equal(res.body.message, "Accès réservé à l'administrateur.");
    }
  });

  test("l'email admin est reconnu sans tenir compte de la casse ni des espaces", async () => {
    const previous = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = " autre@nauticash.test , ADMIN@Nauticash.test ";
    try {
      const { token } = await h.registerUser(ADMIN_EMAIL);
      assert.equal((await h.request("GET", "/api/admin/stats", { token })).status, 200);
    } finally {
      process.env.ADMIN_EMAILS = previous;
    }
  });

  test("ADMIN_EMAILS vide : personne n'est administrateur", async () => {
    const previous = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "";
    try {
      const { token } = await h.registerUser(ADMIN_EMAIL);
      assert.equal((await h.request("GET", "/api/admin/stats", { token })).status, 403);
    } finally {
      process.env.ADMIN_EMAILS = previous;
    }
  });
});

describe("Routes admin (connecté en administrateur)", () => {
  test("GET /api/admin/stats renvoie l'utilisation des API et l'état du cron", async () => {
    const admin = await h.registerUser(ADMIN_EMAIL);
    await h.request("POST", "/api/user/portfolio", { token: admin.token, body: { ticker: "AAPL", quantity: 1 } });

    const res = await h.request("GET", "/api/admin/stats", { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.apiUsage.providers.fmp.last24h, 3, "quote + profil + dividendes");
    assert.equal(res.body.apiUsage.providers.fmp.dailyLimit, 250);
    assert.ok("cronJob" in res.body);
  });

  test("GET /api/admin/health interroge chaque provider", async () => {
    const admin = await h.registerUser(ADMIN_EMAIL);
    const ok = await h.request("GET", "/api/admin/health", { token: admin.token });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.fmp.healthy, true);

    h.fmp.failWith = 503;
    const ko = await h.request("GET", "/api/admin/health", { token: admin.token });
    assert.equal(ko.status, 200);
    assert.equal(ko.body.fmp.healthy, false);
  });

  test("POST /api/admin/update-prices lance l'actualisation en arrière-plan", async () => {
    const admin = await h.registerUser(ADMIN_EMAIL);
    const original = priceUpdater.runManual;
    let started = 0;
    priceUpdater.runManual = async () => {
      started++;
    };
    try {
      const res = await h.request("POST", "/api/admin/update-prices", { token: admin.token });
      assert.equal(res.status, 200);
      assert.equal(res.body.message, "Price update started");
      assert.equal(started, 1);
    } finally {
      priceUpdater.runManual = original;
    }
  });
});

describe("GET /api/admin/coverage (couverture des tickers par provider)", () => {
  const now = Math.floor(Date.now() / 1000);
  const chart = (symbol, price) => ({
    meta: { currency: "USD", symbol, instrumentType: "EQUITY", regularMarketPrice: price, regularMarketTime: now, previousClose: price - 1 },
    timestamp: [now],
    indicators: { quote: [{ close: [price] }] },
  });

  // Portefeuilles écrits directement en base : aucun appel API avant la mesure
  async function holdings(portfolios) {
    for (const tickers of portfolios) {
      const u = await h.registerUser();
      await h.db.collection("users").updateOne(
        { email: u.email },
        { $set: { portfolio: tickers.map((ticker) => ({ ticker, quantity: 1, pru: 0 })) } }
      );
    }
  }

  test("teste chaque ticker détenu auprès de chaque provider, sans rien enregistrer", async () => {
    const admin = await h.registerUser(ADMIN_EMAIL);
    await holdings([["AAPL", "NVDA"], ["AAPL", "ZZZZ"]]);
    h.fmp.notCovered.NVDA = true;
    h.yahoo.charts.AAPL = chart("AAPL", 200);
    h.yahoo.charts.NVDA = chart("NVDA", 180);

    const res = await h.request("GET", "/api/admin/coverage", { token: admin.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.providers, ["fmp", "yahoo"]);
    assert.equal(res.body.totalHeld, 3);
    assert.equal(res.body.truncated, false);
    assert.equal(res.body.tickers[0].ticker, "AAPL", "les plus détenus d'abord");
    assert.equal(res.body.tickers[0].holders, 2);

    const byTicker = Object.fromEntries(res.body.tickers.map((t) => [t.ticker, t.results]));
    assert.equal(byTicker.AAPL.fmp.status, "ok");
    assert.equal(byTicker.AAPL.fmp.price, 200);
    assert.equal(byTicker.NVDA.fmp.status, "not_covered", "402 FMP = hors offre");
    assert.equal(byTicker.NVDA.yahoo.status, "ok");
    assert.equal(byTicker.ZZZZ.yahoo.status, "not_covered");

    assert.deepEqual(res.body.summary.fmp, { ok: 1, not_covered: 2, unsupported: 0, quota: 0, error: 0, tested: 3, coverage: 33.3 });
    assert.equal(res.body.summary.yahoo.ok, 2);
    assert.deepEqual(res.body.uncovered, ["ZZZZ"]);

    // Un seul appel « quote » par ticker côté FMP (ni profil ni dividendes), rien d'écrit dans les prix
    assert.deepEqual(h.fmp.calls.map((c) => c.endpoint), ["quote", "quote", "quote"]);
    assert.equal((await h.db.collection("prices").find({}).toArray()).length, 0);
  });

  test("paramètres limit et providers, valeurs invalides refusées", async () => {
    const admin = await h.registerUser(ADMIN_EMAIL);
    await holdings([["AAPL", "MC.PA"]]);

    const one = await h.request("GET", "/api/admin/coverage?limit=1&providers=fmp", { token: admin.token });
    assert.equal(one.status, 200);
    assert.deepEqual(one.body.providers, ["fmp"]);
    assert.equal(one.body.tested, 1);
    assert.equal(one.body.truncated, true);
    assert.equal(h.yahoo.calls.length, 0, "Yahoo non interrogé");

    for (const q of ["limit=0", "limit=201", "limit=abc", "providers=inconnu"]) {
      const bad = await h.request("GET", `/api/admin/coverage?${q}`, { token: admin.token });
      assert.equal(bad.status, 400, q);
      assert.ok(bad.body.error, q);
    }
  });

  test("quota atteint : le provider n'est plus appelé (statut quota)", async () => {
    const admin = await h.registerUser(ADMIN_EMAIL);
    await holdings([["AAPL", "MC.PA"]]);
    const previous = process.env.FMP_DAILY_LIMIT;
    process.env.FMP_DAILY_LIMIT = String((apiUsage.stats().fmp?.last24h || 0) + 1);
    try {
      const res = await h.request("GET", "/api/admin/coverage?providers=fmp", { token: admin.token });
      assert.equal(res.status, 200);
      assert.equal(res.body.summary.fmp.ok, 1);
      assert.equal(res.body.summary.fmp.quota, 1);
      assert.equal(res.body.summary.fmp.coverage, 100, "le quota n'entre pas dans le taux");
      assert.equal(h.fmp.calls.length, 1);
    } finally {
      process.env.FMP_DAILY_LIMIT = previous;
    }
  });

  test("aucun portefeuille : résultat vide", async () => {
    const admin = await h.registerUser(ADMIN_EMAIL);
    const res = await h.request("GET", "/api/admin/coverage", { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.tested, 0);
    assert.equal(res.body.summary.fmp.coverage, null);
    assert.deepEqual(res.body.uncovered, []);
  });
});

describe("En-têtes de sécurité de l'API", () => {
  test("présents sur toutes les réponses", async () => {
    const res = await h.request("GET", "/health");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});
