// Tests : formules gratuite / VIP (socle sans paiement)
const { test, describe, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");

before(h.start);
after(h.stop);
beforeEach(h.resetState);
afterEach(() => {
  delete process.env.VIP_ENFORCED;
});

const profile = (token) => h.request("GET", "/api/user/profile", { token });
const patchProfile = (token, body) => h.request("PATCH", "/api/user/profile", { token, body });
const setPlan = (admin, email, plan) => h.request("POST", "/api/admin/users/plan", { token: admin.token, body: { email, plan } });

describe("Formule du compte", () => {
  test("gratuite par défaut ; verrouillage inactif : tout reste accessible", async () => {
    const { token } = await h.registerUser();
    const res = await profile(token);
    assert.equal(res.body.plan, "free");
    assert.equal(res.body.vipEnforced, false);
    assert.deepEqual(res.body.access, { objectifs: true, strategie: true });
    assert.equal((await patchProfile(token, { strategy: "dividendes", expectedReturn: 6 })).status, 200);
  });

  test("verrouillage actif : compte gratuit sans accès, champs VIP refusés, champs gratuits acceptés", async () => {
    process.env.VIP_ENFORCED = "true";
    const { token } = await h.registerUser();
    const res = await profile(token);
    assert.equal(res.body.vipEnforced, true);
    assert.deepEqual(res.body.access, { objectifs: false, strategie: false });

    const refused = await patchProfile(token, { strategy: "dividendes" });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.code, "VIP_REQUIRED");
    assert.equal((await patchProfile(token, { expectedReturn: 6 })).status, 403);
    // L'objectif de patrimoine, les dépenses et les préférences d'affichage restent gratuits
    assert.equal((await patchProfile(token, { goalAmount: 100000, monthlyExpenses: 2000, discreetMode: true })).status, 200);
    assert.equal((await profile(token)).body.profile.strategy, null);
  });

  test("un compte VIP a accès ; l'admin règle la formule ; un simple utilisateur ne le peut pas", async () => {
    process.env.VIP_ENFORCED = "true";
    const user = await h.registerUser();
    const admin = await h.registerUser("admin@nauticash.test");

    assert.equal((await setPlan(user, user.email, "vip")).status, 403);
    assert.equal((await setPlan(admin, user.email, "vip")).status, 200);
    const res = await profile(user.token);
    assert.equal(res.body.plan, "vip");
    assert.deepEqual(res.body.access, { objectifs: true, strategie: true });
    assert.equal((await patchProfile(user.token, { strategy: "croissance", expectedReturn: 7 })).status, 200);

    assert.equal((await setPlan(admin, user.email, "free")).status, 200);
    assert.equal((await patchProfile(user.token, { strategy: "dividendes" })).status, 403);
  });

  test("l'admin garde l'accès ; formule ou compte invalides refusés ; la formule ne passe pas par le profil", async () => {
    process.env.VIP_ENFORCED = "true";
    const admin = await h.registerUser("admin@nauticash.test");
    assert.deepEqual((await profile(admin.token)).body.access, { objectifs: true, strategie: true });
    assert.equal((await setPlan(admin, admin.email, "gold")).status, 400);
    assert.equal((await setPlan(admin, "inconnu@nauticash.test", "vip")).status, 404);

    const user = await h.registerUser();
    assert.equal((await patchProfile(user.token, { plan: "vip" })).status, 400); // champ inconnu : pas d'auto-promotion
    assert.equal((await profile(user.token)).body.plan, "free");
  });
});
