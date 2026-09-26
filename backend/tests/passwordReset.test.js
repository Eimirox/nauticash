// Tests : mot de passe oublié / réinitialisation (email simulé via l'API Resend)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);

const NEW_PASSWORD = "NouveauMdp#2026";
const GENERIC = "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.";

function tokenFromLastEmail() {
  const email = h.mail.sent.at(-1);
  const match = email.text.match(/reset-password\?token=([a-f0-9]{64})/);
  assert.ok(match, "le lien de réinitialisation est dans l'email");
  return match[1];
}

describe("POST /api/auth/forgot-password", () => {
  test("envoie un email avec un lien valable et stocke le token hashé", async () => {
    await h.registerUser("oubli@nauticash.test");
    const res = await h.request("POST", "/api/auth/forgot-password", { body: { email: "oubli@nauticash.test" } });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, GENERIC);
    assert.equal(h.mail.sent.length, 1);

    const email = h.mail.sent[0];
    assert.equal(email.to, "oubli@nauticash.test");
    assert.equal(email.from, process.env.EMAIL_FROM);
    assert.match(email.text, /^[\s\S]*http:\/\/localhost:3000\/reset-password\?token=/);

    const rawToken = tokenFromLastEmail();
    const stored = await h.db.collection("users").findOne({ email: "oubli@nauticash.test" });
    assert.notEqual(stored.resetPasswordToken, rawToken, "le token n'est pas stocké en clair");
    assert.equal(stored.resetPasswordToken, crypto.createHash("sha256").update(rawToken).digest("hex"));
    const ttl = new Date(stored.resetPasswordExpires).getTime() - Date.now();
    assert.ok(ttl > 55 * 60 * 1000 && ttl <= 60 * 60 * 1000, "lien valable 1 heure");
  });

  test("répond pareil pour un email inconnu, sans envoyer d'email", async () => {
    const res = await h.request("POST", "/api/auth/forgot-password", { body: { email: "fantome@nauticash.test" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, GENERIC);
    assert.equal(h.mail.sent.length, 0);
  });

  test("n'envoie pas un second email moins de 2 minutes après le premier", async () => {
    await h.registerUser("spam@nauticash.test");
    await h.request("POST", "/api/auth/forgot-password", { body: { email: "spam@nauticash.test" } });
    const second = await h.request("POST", "/api/auth/forgot-password", { body: { email: "spam@nauticash.test" } });
    assert.equal(second.status, 200);
    assert.equal(second.body.message, GENERIC);
    assert.equal(h.mail.sent.length, 1);
  });

  test("renvoie 502 et annule le token si l'email ne part pas", async () => {
    await h.registerUser("panne@nauticash.test");
    h.mail.failWith = 500;
    const res = await h.request("POST", "/api/auth/forgot-password", { body: { email: "panne@nauticash.test" } });
    assert.equal(res.status, 502);
    const stored = await h.db.collection("users").findOne({ email: "panne@nauticash.test" });
    assert.equal(stored.resetPasswordToken, null);
    assert.equal(stored.resetPasswordExpires, null);
  });

  test("refuse un email invalide", async () => {
    const res = await h.request("POST", "/api/auth/forgot-password", { body: { email: "nope" } });
    assert.equal(res.status, 400);
  });
});

describe("POST /api/auth/reset-password", () => {
  test("change le mot de passe avec un lien valide, une seule fois", async () => {
    const user = await h.registerUser("reset@nauticash.test");
    await h.request("POST", "/api/auth/forgot-password", { body: { email: user.email } });
    const token = tokenFromLastEmail();

    const res = await h.request("POST", "/api/auth/reset-password", { body: { token, password: NEW_PASSWORD } });
    assert.equal(res.status, 200);
    assert.match(res.body.message, /Mot de passe mis à jour/);

    const oldLogin = await h.request("POST", "/api/auth/login", { body: { email: user.email, password: user.password } });
    assert.equal(oldLogin.status, 401, "l'ancien mot de passe ne fonctionne plus");
    const newLogin = await h.request("POST", "/api/auth/login", { body: { email: user.email, password: NEW_PASSWORD } });
    assert.equal(newLogin.status, 200, "le nouveau mot de passe fonctionne");

    const reuse = await h.request("POST", "/api/auth/reset-password", { body: { token, password: "EncoreAutre#2026" } });
    assert.equal(reuse.status, 400, "le lien ne peut pas servir deux fois");
  });

  test("refuse un lien expiré", async () => {
    const user = await h.registerUser("expire@nauticash.test");
    await h.request("POST", "/api/auth/forgot-password", { body: { email: user.email } });
    const token = tokenFromLastEmail();

    await h.db.collection("users").updateOne(
      { email: user.email },
      { $set: { resetPasswordExpires: new Date(Date.now() - 1000) } }
    );

    const res = await h.request("POST", "/api/auth/reset-password", { body: { token, password: NEW_PASSWORD } });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /expiré/);
  });

  test("refuse un token inconnu ou mal formé", async () => {
    const unknown = await h.request("POST", "/api/auth/reset-password", {
      body: { token: "a".repeat(64), password: NEW_PASSWORD },
    });
    assert.equal(unknown.status, 400);

    const malformed = await h.request("POST", "/api/auth/reset-password", { body: { token: "court", password: NEW_PASSWORD } });
    assert.equal(malformed.status, 400);
    assert.ok(malformed.body.details.some((d) => d.field === "token"));
  });

  test("applique les règles de mot de passe fort", async () => {
    const user = await h.registerUser("faible@nauticash.test");
    await h.request("POST", "/api/auth/forgot-password", { body: { email: user.email } });
    const token = tokenFromLastEmail();

    const res = await h.request("POST", "/api/auth/reset-password", { body: { token, password: "faible" } });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.some((d) => d.field === "password"));

    const stored = await h.db.collection("users").findOne({ email: user.email });
    assert.ok(stored.resetPasswordToken, "le lien reste utilisable après une erreur de saisie");
  });
});
