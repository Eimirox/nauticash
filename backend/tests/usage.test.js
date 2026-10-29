// Tests : statistiques de fréquentation (sans cookie, comptages uniquement)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const usage = require("../services/usage");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const ping = (token, path) => h.request("POST", "/api/user/usage/ping", { token, body: { path } });

describe("Fréquentation", () => {
  test("normalise les chemins et ignore les écrans inconnus", () => {
    assert.equal(usage.normalizeScreen("/portfolio"), "/portfolio");
    assert.equal(usage.normalizeScreen("/portfolio/AAPL?x=1"), "/portfolio/[ticker]");
    assert.equal(usage.normalizeScreen("/analyses/dividendes/"), "/analyses/dividendes");
    assert.equal(usage.normalizeScreen("/login"), null);
    assert.equal(usage.normalizeScreen("/portfolio/" + "x".repeat(100)), null);
    assert.equal(usage.normalizeScreen(42), null);
  });

  test("un ping enregistre l'écran et la dernière visite ; sans jeton : refusé", async () => {
    const { token } = await h.registerUser();
    assert.equal((await ping(token, "/portfolio/AAPL")).status, 200);
    assert.equal((await ping(token, "/inconnu")).status, 200);
    assert.equal((await h.request("POST", "/api/user/usage/ping", { body: { path: "/portfolio" } })).status, 401);
    const s = await usage.summary();
    assert.equal(s.screens.length, 1);
    assert.deepEqual(s.screens[0], { screen: "/portfolio/[ticker]", views: 1, users: 1 });
    assert.equal(s.active.day, 1);
  });

  test("résumé admin : actifs sur 7 jours, vues par écran ; route réservée à l'admin", async () => {
    const a = await h.registerUser();
    const b = await h.registerUser();
    await ping(a.token, "/portfolio");
    await ping(a.token, "/portfolio");
    await ping(b.token, "/analyses/dividendes");
    const old = new Date(Date.now() - 20 * 24 * 3600 * 1000);
    await usage.record(b.user?.id || JSON.parse(Buffer.from(b.token.split(".")[1], "base64").toString()).userId, "/objectifs", old);

    const s = await usage.summary({ days: 7 });
    assert.equal(s.active.week, 2);
    assert.equal(s.active.month, 2);
    assert.equal(s.screens[0].screen, "/portfolio");
    assert.equal(s.screens[0].views, 2);
    assert.ok(!s.screens.some((x) => x.screen === "/objectifs"));

    const res = await h.request("GET", "/api/admin/usage", { token: a.token });
    assert.equal(res.status, 403);
  });
});
