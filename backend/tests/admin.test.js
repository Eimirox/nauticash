// Tests : routes d'administration (réservées aux emails listés dans ADMIN_EMAILS)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const priceUpdater = require("../jobs/updatePrices");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const ADMIN_EMAIL = "admin@nauticash.test";
const ROUTES = [
  ["GET", "/api/admin/stats"],
  ["GET", "/api/admin/health"],
  ["POST", "/api/admin/update-prices"],
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
