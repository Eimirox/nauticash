// Tests : quotas des API de marché (services/apiUsage.js) et leur effet sur les routes
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const apiUsage = require("../services/apiUsage");
const priceStore = require("../services/priceStore");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

// Le compteur d'appels est en mémoire pour tout le processus : chaque test utilise
// un nom de provider distinct, ou un quota calculé à partir des appels déjà faits.
const usedToday = (provider) => apiUsage.stats()[provider]?.last24h || 0;

// Épuise le quota FMP : au moins un appel compté, puis limite = appels déjà faits.
// (FMP_DAILY_LIMIT=0 n'est pas utilisé car il signifie « pas de limite ».)
function exhaustFmpQuota() {
  if (usedToday("fmp") === 0) apiUsage.record("fmp");
  process.env.FMP_DAILY_LIMIT = String(usedToday("fmp"));
}

describe("services/apiUsage", () => {
  test("bloque un provider au-delà de son quota journalier (FMP_DAILY_LIMIT)", () => {
    process.env.FMP_DAILY_LIMIT = String(usedToday("fmp") + 2);
    try {
      assert.equal(apiUsage.canCall("fmp"), true);
      apiUsage.record("fmp");
      apiUsage.record("fmp");
      assert.equal(apiUsage.canCall("fmp"), false);
      assert.equal(apiUsage.stats().fmp.dailyLimit, Number(process.env.FMP_DAILY_LIMIT));
    } finally {
      process.env.FMP_DAILY_LIMIT = "";
    }
    assert.equal(apiUsage.canCall("fmp"), true, "limite par défaut (250) de l'offre gratuite");
  });

  test("respecte la limite par minute des offres gratuites (Alpha Vantage : 5/min)", () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(apiUsage.canCall("alphavantage"), true);
      apiUsage.record("alphavantage");
    }
    assert.equal(apiUsage.canCall("alphavantage"), false);
    assert.equal(apiUsage.stats().alphavantage.minuteLimit, 5);
  });

  test("trackedFetchJson compte chaque appel HTTP et n'appelle plus l'API une fois le quota atteint", async () => {
    process.env.FMP_DAILY_LIMIT = String(usedToday("fmp") + 1);
    try {
      const url = `https://financialmodelingprep.com/stable/quote?symbol=AAPL&apikey=${process.env.FMP_API_KEY}`;
      const data = await apiUsage.trackedFetchJson("fmp", url);
      assert.equal(data[0].symbol, "AAPL");
      assert.equal(h.fmp.calls.length, 1);

      await assert.rejects(apiUsage.trackedFetchJson("fmp", url), (err) => {
        assert.equal(err.code, "QUOTA_EXCEEDED");
        assert.ok(err instanceof apiUsage.QuotaExceededError);
        return true;
      });
      assert.equal(h.fmp.calls.length, 1, "aucun appel réseau quand le quota est atteint");
    } finally {
      process.env.FMP_DAILY_LIMIT = "";
    }
  });

  test("une erreur HTTP est remontée avec son code (et compte dans le quota)", async () => {
    h.fmp.failWith = 429;
    const before = usedToday("fmp");
    await assert.rejects(
      apiUsage.trackedFetchJson("fmp", `https://financialmodelingprep.com/stable/quote?symbol=AAPL&apikey=${process.env.FMP_API_KEY}`),
      (err) => err.status === 429
    );
    assert.equal(usedToday("fmp"), before + 1);
  });

  test("RATE_LIMITING_ENABLED=false désactive le contrôle", () => {
    const config = require("../config/providers");
    const previous = config.rateLimiting.enabled;
    exhaustFmpQuota();
    assert.equal(apiUsage.canCall("fmp"), false);
    config.rateLimiting.enabled = false;
    try {
      assert.equal(apiUsage.canCall("fmp"), true);
    } finally {
      config.rateLimiting.enabled = previous;
      process.env.FMP_DAILY_LIMIT = "";
    }
  });
});

describe("Quota atteint : effet sur les routes", () => {
  test("ajout d'une nouvelle action refusé proprement, sans appel API", async () => {
    const { token } = await h.registerUser();
    exhaustFmpQuota();
    try {
      const res = await h.request("POST", "/api/user/portfolio", { token, body: { ticker: "AAPL", quantity: 1 } });
      assert.equal(res.status, 404);
      assert.equal(h.fmp.calls.length, 0);
    } finally {
      process.env.FMP_DAILY_LIMIT = "";
    }
  });

  test("quota atteint pendant l'enrichissement : le quote est gardé, profil/dividendes au prochain passage", async () => {
    // Un seul appel restant : le quote passe, le profil lève QUOTA_EXCEEDED
    process.env.FMP_DAILY_LIMIT = String(usedToday("fmp") + 1);
    try {
      await assert.rejects(priceStore.refreshTicker("AAPL"), /Quota|All providers failed/);
    } finally {
      process.env.FMP_DAILY_LIMIT = "";
    }
    assert.equal(await h.db.collection("prices").findOne({ symbol: "AAPL" }), null, "rien d'incomplet n'est enregistré");
  });

  test("une action déjà en cache reste ajoutable même quand le quota est atteint", async () => {
    const alice = await h.registerUser();
    const bob = await h.registerUser();
    await h.request("POST", "/api/user/portfolio", { token: alice.token, body: { ticker: "AAPL", quantity: 1 } });

    exhaustFmpQuota();
    try {
      const res = await h.request("POST", "/api/user/portfolio", { token: bob.token, body: { ticker: "AAPL", quantity: 2 } });
      assert.equal(res.status, 201);
      assert.equal(res.body.stock.close, 200);
    } finally {
      process.env.FMP_DAILY_LIMIT = "";
    }
  });
});
