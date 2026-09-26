// Tests : inscription, connexion, /me, protection des routes, anti brute-force
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

describe("POST /api/auth/register", () => {
  test("crée un compte et renvoie un token JWT valable", async () => {
    const res = await h.request("POST", "/api/auth/register", {
      body: { email: "Nouveau@Nauticash.test", password: h.STRONG_PASSWORD },
    });
    assert.equal(res.status, 201);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    assert.equal(payload.email, "nouveau@nauticash.test", "l'email est normalisé en minuscules");

    const stored = await h.db.collection("users").findOne({ email: "nouveau@nauticash.test" });
    assert.ok(stored, "l'utilisateur est enregistré");
    assert.notEqual(stored.password, h.STRONG_PASSWORD, "le mot de passe n'est jamais stocké en clair");
    assert.ok(await bcrypt.compare(h.STRONG_PASSWORD, stored.password));
    assert.equal(stored.cashAmount, 0);
    assert.equal(stored.cashCurrency, "EUR");
    assert.deepEqual(stored.portfolio, []);
  });

  test("refuse un email invalide", async () => {
    const res = await h.request("POST", "/api/auth/register", { body: { email: "pas-un-email", password: h.STRONG_PASSWORD } });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.some((d) => d.field === "email"));
  });

  test("refuse un mot de passe faible avec des messages en français", async () => {
    const res = await h.request("POST", "/api/auth/register", { body: { email: "faible@nauticash.test", password: "court" } });
    assert.equal(res.status, 400);
    const messages = res.body.details.filter((d) => d.field === "password").map((d) => d.msg);
    assert.ok(messages.some((m) => m.includes("10 caractères")));
    assert.ok(messages.some((m) => m.includes("majuscule")));
    assert.ok(messages.some((m) => m.includes("chiffre")));
    assert.ok(messages.some((m) => m.includes("caractère spécial")));
  });

  test("refuse un email déjà utilisé (quelle que soit la casse)", async () => {
    await h.registerUser("doublon@nauticash.test");
    const res = await h.request("POST", "/api/auth/register", {
      body: { email: "DOUBLON@nauticash.test", password: h.STRONG_PASSWORD },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, "Email déjà utilisé.");
  });

  test("limite les créations de compte par IP (5 par heure)", async () => {
    const ip = "203.0.113.50";
    for (let i = 0; i < 5; i++) {
      const res = await h.request("POST", "/api/auth/register", {
        ip, body: { email: `rafale${i}@nauticash.test`, password: h.STRONG_PASSWORD },
      });
      assert.equal(res.status, 201);
    }
    const blocked = await h.request("POST", "/api/auth/register", {
      ip, body: { email: "rafale6@nauticash.test", password: h.STRONG_PASSWORD },
    });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  });
});

describe("POST /api/auth/login", () => {
  test("connecte avec les bons identifiants", async () => {
    const user = await h.registerUser("connexion@nauticash.test");
    const res = await h.request("POST", "/api/auth/login", { body: { email: "CONNEXION@nauticash.test", password: user.password } });
    assert.equal(res.status, 200);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    assert.equal(payload.email, "connexion@nauticash.test");
    assert.ok(payload.userId);
  });

  test("renvoie le même message pour un mauvais mot de passe et un compte inconnu", async () => {
    await h.registerUser("secret@nauticash.test");
    const wrongPassword = await h.request("POST", "/api/auth/login", { body: { email: "secret@nauticash.test", password: "Mauvais!2026x" } });
    const unknown = await h.request("POST", "/api/auth/login", { body: { email: "inconnu@nauticash.test", password: "Mauvais!2026x" } });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrongPassword.body.message, unknown.body.message);
  });

  test("exige un mot de passe", async () => {
    const res = await h.request("POST", "/api/auth/login", { body: { email: "a@nauticash.test" } });
    assert.equal(res.status, 400);
  });

  test("bloque après 10 tentatives depuis la même IP", async () => {
    const ip = "203.0.113.10";
    for (let i = 0; i < 10; i++) {
      const res = await h.request("POST", "/api/auth/login", { ip, body: { email: "x@nauticash.test", password: "Mauvais!2026x" } });
      assert.equal(res.status, 401);
    }
    const blocked = await h.request("POST", "/api/auth/login", { ip, body: { email: "x@nauticash.test", password: "Mauvais!2026x" } });
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.message, /Trop de tentatives/);

    // Une autre IP n'est pas impactée
    const other = await h.request("POST", "/api/auth/login", { ip: "203.0.113.11", body: { email: "x@nauticash.test", password: "Mauvais!2026x" } });
    assert.equal(other.status, 401);
  });
});

describe("GET /api/auth/me et protection des routes", () => {
  test("renvoie l'email et le cash de l'utilisateur connecté", async () => {
    const user = await h.registerUser("moi@nauticash.test");
    const res = await h.request("GET", "/api/auth/me", { token: user.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { email: "moi@nauticash.test", cashAmount: 0, cashCurrency: "EUR" });
    assert.equal(res.body.password, undefined);
  });

  test("refuse sans token ou avec un token invalide", async () => {
    assert.equal((await h.request("GET", "/api/auth/me")).status, 401);
    assert.equal((await h.request("GET", "/api/auth/me", { token: "abc.def.ghi" })).status, 401);
  });

  test("les routes protégées refusent un token absent, mal formé, signé avec un autre secret ou expiré", async () => {
    const user = await h.registerUser();
    const { userId, email } = jwt.decode(user.token);

    const noToken = await h.request("GET", "/api/user/portfolio");
    assert.equal(noToken.status, 401);
    assert.match(noToken.body.message, /Token manquant/);

    const badFormat = await h.request("GET", "/api/user/portfolio", { headers: { Authorization: user.token } });
    assert.equal(badFormat.status, 401);

    const forged = jwt.sign({ userId, email }, "un-autre-secret-de-test-assez-long-000000");
    assert.equal((await h.request("GET", "/api/user/portfolio", { token: forged })).status, 401);

    const expired = jwt.sign({ userId, email, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
    const res = await h.request("GET", "/api/user/portfolio", { token: expired });
    assert.equal(res.status, 401);
    assert.match(res.body.message, /expiré/);
  });
});

describe("Réponses d'erreur génériques", () => {
  test("route inconnue : 404 en JSON", async () => {
    const res = await h.request("GET", "/api/nexiste-pas");
    assert.equal(res.status, 404);
    assert.match(res.body.message, /Route introuvable/);
  });

  test("JSON mal formé : 400 en JSON", async () => {
    const res = await h.request("POST", "/api/auth/login", { raw: "{pas du json" });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /JSON mal formé/);
  });

  test("health check", async () => {
    const res = await h.request("GET", "/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "OK");
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});
