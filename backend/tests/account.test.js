// Tests : page « Mon compte » (changement de mot de passe, suppression du compte)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const NEW_PASSWORD = "Nouveau#Cap2026";
const login = (email, password) => h.request("POST", "/api/auth/login", { body: { email, password } });

describe("POST /api/auth/change-password", () => {
  test("change le mot de passe si l'actuel est correct", async () => {
    const u = await h.registerUser();
    const res = await h.request("POST", "/api/auth/change-password", {
      token: u.token,
      body: { currentPassword: u.password, password: NEW_PASSWORD },
    });
    assert.equal(res.status, 200);
    assert.equal((await login(u.email, u.password)).status, 401, "l'ancien mot de passe ne marche plus");
    assert.equal((await login(u.email, NEW_PASSWORD)).status, 200, "le nouveau fonctionne");
  });

  test("refuse un mot de passe actuel incorrect", async () => {
    const u = await h.registerUser();
    const res = await h.request("POST", "/api/auth/change-password", {
      token: u.token,
      body: { currentPassword: "Mauvais#Mdp123", password: NEW_PASSWORD },
    });
    assert.equal(res.status, 403);
    assert.equal((await login(u.email, u.password)).status, 200, "mot de passe inchangé");
  });

  test("applique les règles de robustesse et refuse le même mot de passe", async () => {
    const u = await h.registerUser();
    for (const password of ["court", "sansmajuscule#123", u.password]) {
      const res = await h.request("POST", "/api/auth/change-password", {
        token: u.token,
        body: { currentPassword: u.password, password },
      });
      assert.equal(res.status, 400, `refusé : ${password}`);
    }
  });

  test("exige d'être connecté", async () => {
    const res = await h.request("POST", "/api/auth/change-password", {
      body: { currentPassword: "x", password: NEW_PASSWORD },
    });
    assert.equal(res.status, 401);
  });
});

describe("DELETE /api/auth/account", () => {
  test("supprime le compte et toutes ses données", async () => {
    const u = await h.registerUser();
    const other = await h.registerUser();
    await h.request("POST", "/api/user/portfolio", { token: u.token, body: { ticker: "AAPL", quantity: 1 } });
    await h.request("POST", "/api/user/history", { token: u.token, body: { date: "2026-01-15", value: 100 } });
    await h.request("POST", "/api/user/history", { token: other.token, body: { date: "2026-01-15", value: 200 } });

    const res = await h.request("DELETE", "/api/auth/account", { token: u.token, body: { currentPassword: u.password } });
    assert.equal(res.status, 200);

    assert.equal(await h.db.collection("users").findOne({ email: u.email }), null, "utilisateur supprimé");
    assert.equal((await login(u.email, u.password)).status, 401);
    const history = await h.db.collection("history").find({}).toArray();
    assert.equal(history.length, 1, "seul l'historique de l'autre utilisateur reste");
    assert.ok(await h.db.collection("users").findOne({ email: other.email }), "les autres comptes sont intacts");

    const after = await h.request("GET", "/api/user/portfolio", { token: u.token });
    assert.equal(after.status, 404, "l'ancien jeton ne donne plus accès à des données");
  });

  test("refuse sans le bon mot de passe", async () => {
    const u = await h.registerUser();
    for (const body of [{}, { currentPassword: "Mauvais#Mdp123" }]) {
      const res = await h.request("DELETE", "/api/auth/account", { token: u.token, body });
      assert.ok([400, 403].includes(res.status));
    }
    assert.ok(await h.db.collection("users").findOne({ email: u.email }), "compte conservé");
  });
});
