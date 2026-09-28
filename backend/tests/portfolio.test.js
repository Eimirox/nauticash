// Tests : portefeuille (ajout, lecture, modification, suppression, actualisation) et cash
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const addStock = (token, body) => h.request("POST", "/api/user/portfolio", { token, body });
const getPortfolio = async (token) => (await h.request("GET", "/api/user/portfolio", { token })).body;

describe("POST /api/user/portfolio", () => {
  test("ajoute une action et renvoie les données enrichies (quote + profil + dividendes FMP)", async () => {
    const { token } = await h.registerUser();
    const res = await addStock(token, { ticker: " aapl ", quantity: "10", pru: 150 });

    assert.equal(res.status, 201);
    const stock = res.body.stock;
    assert.equal(stock.ticker, "AAPL", "ticker normalisé en majuscules");
    assert.equal(stock.name, "Apple Inc.");
    assert.equal(stock.quantity, 10);
    assert.equal(stock.pru, 150);
    assert.equal(stock.close, 200);
    assert.equal(stock.total, 2000);
    assert.ok(Math.abs(stock.performance - 33.333) < 0.01);
    assert.equal(stock.currency, "USD");
    assert.equal(stock.country, "États-Unis");
    assert.equal(stock.sector, "Technology");
    assert.equal(stock.dividend, 1, "somme des dividendes des 12 derniers mois");
    assert.ok(Math.abs(stock.dividendYield - 0.5) < 1e-9);

    assert.deepEqual(h.fmp.calls.map((c) => c.endpoint), ["quote", "profile", "dividends"]);

    const cached = await h.db.collection("prices").findOne({ symbol: "AAPL" });
    assert.equal(cached.close, 200, "le prix est mis en cache en base");
  });

  test("quantité et PRU sont optionnels (0 par défaut)", async () => {
    const { token } = await h.registerUser();
    const res = await addStock(token, { ticker: "MC.PA" });
    assert.equal(res.status, 201);
    assert.equal(res.body.stock.quantity, 0);
    assert.equal(res.body.stock.pru, 0);
    assert.equal(res.body.stock.currency, "EUR");
    assert.equal(res.body.stock.country, "France");
  });

  test("valide le ticker, la quantité et le PRU", async () => {
    const { token } = await h.registerUser();
    for (const ticker of ["", "AAPL; DROP", "<script>", "A".repeat(21), 42]) {
      const res = await addStock(token, { ticker, quantity: 1, pru: 1 });
      assert.equal(res.status, 400, `ticker refusé : ${JSON.stringify(ticker)}`);
    }
    for (const bad of [{ quantity: -1 }, { quantity: "abc" }, { pru: -5 }, { pru: 1e13 }, { quantity: "" }]) {
      const res = await addStock(token, { ticker: "AAPL", ...bad });
      assert.equal(res.status, 400, `valeur refusée : ${JSON.stringify(bad)}`);
    }
    assert.equal(h.fmp.calls.length, 0, "aucun appel API pour une requête invalide");
  });

  test("refuse un doublon", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1 });
    const res = await addStock(token, { ticker: "aapl", quantity: 2 });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /déjà dans votre portefeuille/);
  });

  test("ticker inconnu chez FMP : 404 et rien n'est ajouté", async () => {
    const { token } = await h.registerUser();
    const res = await addStock(token, { ticker: "ZZZZ", quantity: 1 });
    assert.equal(res.status, 404);
    assert.match(res.body.error, /Ticker introuvable/);
    assert.deepEqual((await getPortfolio(token)).stocks, []);
  });

  test("API FMP en panne : 404 explicite", async () => {
    const { token } = await h.registerUser();
    h.fmp.failWith = 500;
    const res = await addStock(token, { ticker: "AAPL", quantity: 1 });
    assert.equal(res.status, 404);
  });

  test("réutilise un prix récent déjà en base (aucun nouvel appel API)", async () => {
    const alice = await h.registerUser();
    const bob = await h.registerUser();
    await addStock(alice.token, { ticker: "AAPL", quantity: 1 });
    const callsAfterAlice = h.fmp.calls.length;

    const res = await addStock(bob.token, { ticker: "AAPL", quantity: 3 });
    assert.equal(res.status, 201);
    assert.equal(res.body.stock.close, 200);
    assert.equal(h.fmp.calls.length, callsAfterAlice);
  });

  test("utilisateur supprimé : 404", async () => {
    const token = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toHexString(), email: "parti@nauticash.test" },
      process.env.JWT_SECRET
    );
    const res = await addStock(token, { ticker: "AAPL" });
    assert.equal(res.status, 404);
  });
});

describe("GET /api/user/portfolio", () => {
  test("renvoie les positions enrichies et le cash", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 2, pru: 100 });
    await addStock(token, { ticker: "MC.PA", quantity: 1, pru: 800 });

    const body = await getPortfolio(token);
    assert.equal(body.stocks.length, 2);
    const aapl = body.stocks.find((s) => s.ticker === "AAPL");
    const lvmh = body.stocks.find((s) => s.ticker === "MC.PA");
    assert.equal(aapl.total, 400);
    assert.equal(aapl.performance, 100);
    assert.ok(lvmh.performance < 0);
    assert.deepEqual(body.cash, { amount: 0, currency: "EUR" });
  });

  test("une position sans prix en cache est renvoyée avec une erreur, sans planter", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1 });
    await h.db.collection("prices").deleteMany();

    const body = await getPortfolio(token);
    assert.equal(body.stocks[0].close, 0);
    assert.equal(body.stocks[0].error, "Price not available");
  });

  test("chaque utilisateur ne voit que son portefeuille", async () => {
    const alice = await h.registerUser();
    const bob = await h.registerUser();
    await addStock(alice.token, { ticker: "AAPL", quantity: 5 });

    assert.equal((await getPortfolio(alice.token)).stocks.length, 1);
    assert.deepEqual((await getPortfolio(bob.token)).stocks, []);

    const del = await h.request("DELETE", "/api/user/portfolio/AAPL", { token: bob.token });
    assert.equal(del.status, 404, "Bob ne peut pas supprimer la ligne d'Alice");
    assert.equal((await getPortfolio(alice.token)).stocks.length, 1);
  });
});

describe("PATCH / DELETE /api/user/portfolio/:ticker", () => {
  test("met à jour la quantité et le PRU", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1, pru: 100 });

    const res = await h.request("PATCH", "/api/user/portfolio/aapl", { token, body: { quantity: 4, pru: "120.5" } });
    assert.equal(res.status, 200);

    const [aapl] = (await getPortfolio(token)).stocks;
    assert.equal(aapl.quantity, 4);
    assert.equal(aapl.pru, 120.5);
  });

  test("met à jour un seul champ sans toucher l'autre", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1, pru: 100 });
    await h.request("PATCH", "/api/user/portfolio/AAPL", { token, body: { quantity: 7 } });
    const [aapl] = (await getPortfolio(token)).stocks;
    assert.equal(aapl.quantity, 7);
    assert.equal(aapl.pru, 100);
  });

  test("refuse des valeurs invalides ou une requête vide", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1 });
    assert.equal((await h.request("PATCH", "/api/user/portfolio/AAPL", { token, body: { quantity: -3 } })).status, 400);
    assert.equal((await h.request("PATCH", "/api/user/portfolio/AAPL", { token, body: { pru: "x" } })).status, 400);
    assert.equal((await h.request("PATCH", "/api/user/portfolio/AAPL", { token, body: {} })).status, 400);
  });

  test("404 pour une action absente du portefeuille", async () => {
    const { token } = await h.registerUser();
    const res = await h.request("PATCH", "/api/user/portfolio/TSLA", { token, body: { quantity: 1 } });
    assert.equal(res.status, 404);
  });

  test("supprime une action", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1 });
    await addStock(token, { ticker: "MC.PA", quantity: 1 });

    const res = await h.request("DELETE", "/api/user/portfolio/aapl", { token });
    assert.equal(res.status, 200);
    assert.deepEqual((await getPortfolio(token)).stocks.map((s) => s.ticker), ["MC.PA"]);

    const again = await h.request("DELETE", "/api/user/portfolio/AAPL", { token });
    assert.equal(again.status, 404);
  });
});

describe("POST /api/user/portfolio/force-refresh et GET /portfolio/stats", () => {
  test("portefeuille vide : rien à actualiser", async () => {
    const { token } = await h.registerUser();
    const res = await h.request("POST", "/api/user/portfolio/force-refresh", { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
  });

  test("n'appelle pas l'API pour des prix récents, puis impose 15 min d'attente", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1 });
    const calls = h.fmp.calls.length;

    const first = await h.request("POST", "/api/user/portfolio/force-refresh", { token });
    assert.equal(first.status, 200);
    assert.deepEqual(
      { success: first.body.success, skipped: first.body.skipped, failed: first.body.failed, total: first.body.total },
      { success: 0, skipped: 1, failed: 0, total: 1 }
    );
    assert.equal(h.fmp.calls.length, calls, "prix de moins de 15 min : aucun appel");

    const second = await h.request("POST", "/api/user/portfolio/force-refresh", { token });
    assert.equal(second.status, 429);
    assert.match(second.body.error, /Réessayez dans 15 min/);
  });

  test("actualise les prix périmés et compte les échecs", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1 });
    await addStock(token, { ticker: "MC.PA", quantity: 1 });

    // Prix vieux d'une heure, et MC.PA n'existe plus chez FMP
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await h.db.collection("prices").updateOne({ symbol: "AAPL" }, { $set: { lastUpdate: oneHourAgo, fullUpdateAt: oneHourAgo } });
    await h.db.collection("prices").updateOne({ symbol: "MC.PA" }, { $set: { lastUpdate: oneHourAgo, fullUpdateAt: oneHourAgo } });
    h.fmp.quotes.AAPL.price = 210;
    delete h.fmp.quotes["MC.PA"];
    h.fmp.calls.length = 0;

    const res = await h.request("POST", "/api/user/portfolio/force-refresh", { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, 1);
    assert.equal(res.body.failed, 1);
    assert.deepEqual(
      h.fmp.calls.filter((c) => c.symbol === "AAPL").map((c) => c.endpoint),
      ["quote"],
      "profil (30 j) et dividendes (7 j) encore valides : un seul appel"
    );

    const aapl = (await getPortfolio(token)).stocks.find((s) => s.ticker === "AAPL");
    assert.equal(aapl.close, 210);
    assert.equal(aapl.sector, "Technology", "les données de profil sont conservées");
  });

  test("statistiques du cache de prix", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1 });
    const res = await h.request("GET", "/api/user/portfolio/stats", { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.totalStocks, 1);
    assert.equal(res.body.cachedPrices, 1);
    assert.ok(res.body.cacheAge >= 0);
  });
});

describe("PATCH /api/user/cash", () => {
  test("enregistre le montant et la devise", async () => {
    const user = await h.registerUser();
    const res = await h.request("PATCH", "/api/user/cash", { token: user.token, body: { amount: "1500.5", currency: "usd" } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.cash, { amount: 1500.5, currency: "USD" });

    assert.deepEqual((await getPortfolio(user.token)).cash, { amount: 1500.5, currency: "USD" });
    const me = await h.request("GET", "/api/auth/me", { token: user.token });
    assert.equal(me.body.cashAmount, 1500.5);
    assert.equal(me.body.cashCurrency, "USD");
  });

  test("accepte un montant négatif (découvert)", async () => {
    const { token } = await h.registerUser();
    const res = await h.request("PATCH", "/api/user/cash", { token, body: { amount: -200, currency: "EUR" } });
    assert.equal(res.status, 200);
  });

  test("refuse une devise inconnue ou un montant invalide", async () => {
    const { token } = await h.registerUser();
    for (const body of [
      { amount: 10, currency: "XYZ" },
      { amount: 10 },
      { amount: "abc", currency: "EUR" },
      { amount: "", currency: "EUR" },
      { amount: 1e12, currency: "EUR" },
    ]) {
      const res = await h.request("PATCH", "/api/user/cash", { token, body });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test("l'ancien format { cash: { amount, currency } } est lu puis remplacé à la sauvegarde", async () => {
    const user = await h.registerUser();
    await h.db.collection("users").updateOne(
      { email: user.email },
      { $set: { cash: { amount: 42, currency: "GBP" } } }
    );
    assert.deepEqual((await getPortfolio(user.token)).cash, { amount: 42, currency: "GBP" });

    await h.request("PATCH", "/api/user/cash", { token: user.token, body: { amount: 50, currency: "CHF" } });
    const stored = await h.db.collection("users").findOne({ email: user.email });
    assert.equal(stored.cash, undefined, "l'ancien champ est supprimé");
    assert.deepEqual((await getPortfolio(user.token)).cash, { amount: 50, currency: "CHF" });
  });
});

describe("Enveloppes (PEA, CTO, assurance-vie…)", () => {
  test("enveloppe facultative à l'ajout, renvoyée par GET", async () => {
    const { token } = await h.registerUser();
    assert.equal((await addStock(token, { ticker: "AAPL", quantity: 1, account: "pea" })).status, 201);
    const [stock] = (await getPortfolio(token)).stocks;
    assert.equal(stock.account, "PEA", "normalisée en majuscules");
  });

  test("sans enveloppe : account vaut null", async () => {
    const { token } = await h.registerUser();
    const res = await addStock(token, { ticker: "AAPL", quantity: 1 });
    assert.equal(res.body.stock.account, null);
  });

  test("refuse une enveloppe inconnue", async () => {
    const { token } = await h.registerUser();
    const res = await addStock(token, { ticker: "AAPL", quantity: 1, account: "LIVRET" });
    assert.equal(res.status, 400);
    assert.equal((await getPortfolio(token)).stocks.length, 0);
  });

  test("PATCH change puis retire l'enveloppe", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1 });
    const patch = (body) => h.request("PATCH", "/api/user/portfolio/AAPL", { token, body });

    assert.equal((await patch({ account: "CTO" })).status, 200);
    assert.equal((await getPortfolio(token)).stocks[0].account, "CTO");
    assert.equal((await patch({ account: "Compte épargne" })).status, 400);
    assert.equal((await patch({ account: "" })).status, 200);
    assert.equal((await getPortfolio(token)).stocks[0].account, null);
  });
});

describe("Frais annuels (TER)", () => {
  test("saisis à l'ajout ou par PATCH, retirés avec une valeur vide", async () => {
    const { token } = await h.registerUser();
    assert.equal((await addStock(token, { ticker: "AAPL", quantity: 1, fees: "0,38" })).status, 201);
    assert.equal((await getPortfolio(token)).stocks[0].fees, 0.38);

    const patch = (body) => h.request("PATCH", "/api/user/portfolio/AAPL", { token, body });
    assert.equal((await patch({ fees: 0.2 })).status, 200);
    assert.equal((await getPortfolio(token)).stocks[0].fees, 0.2);
    assert.equal((await patch({ fees: "" })).status, 200);
    assert.equal((await getPortfolio(token)).stocks[0].fees, null);
  });

  test("refuse des frais négatifs ou supérieurs à 10 %", async () => {
    const { token } = await h.registerUser();
    await addStock(token, { ticker: "AAPL", quantity: 1 });
    for (const fees of [-1, 12, "abc"]) {
      const res = await h.request("PATCH", "/api/user/portfolio/AAPL", { token, body: { fees } });
      assert.equal(res.status, 400, String(fees));
    }
    assert.equal((await addStock(token, { ticker: "MSFT", quantity: 1, fees: 50 })).status, 400);
  });
});
