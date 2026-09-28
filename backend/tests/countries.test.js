// Tests : normalisation des pays (vue « Géographie » / carte du monde)
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { resolveCountry } = require("../services/countries");
const h = require("./helpers/setup");

describe("resolveCountry", () => {
  const cases = [
    [{ countryCode: "NL", exchange: "NASDAQ", ticker: "ASML" }, "Pays-Bas", "528", "le siège (profil) prime sur la place de cotation"],
    [{ country: "États-Unis", ticker: "AAPL" }, "États-Unis", "840", "nom français déjà normalisé"],
    [{ country: "NasdaqGS", ticker: "MSFT" }, "États-Unis", "840", "ancienne valeur en base : nom de place"],
    [{ country: "Amsterdam", ticker: "ASML.AS" }, "Pays-Bas", "528", "ancien libellé « Amsterdam »"],
    [{ country: "Unknown", ticker: "SAP.DE" }, "Allemagne", "276", "pays inconnu : déduit du suffixe"],
    [{ country: "Unknown", exchange: "XETRA", ticker: "SAP" }, "Allemagne", "276", "pays inconnu : déduit de la place"],
    [{ country: "USA", ticker: "KO" }, "États-Unis", "840", "nom anglais (Alpha Vantage)"],
    [{ country: "Unknown", ticker: "RMS.PA" }, "France", "250", "suffixe .PA"],
    [{ countryCode: "AU", ticker: "BHP" }, "Australie", "036", "code numérique sur 3 chiffres"],
    [{ ticker: "BTC-USD", type: "Crypto" }, "Crypto", null, "crypto : pas de pays"],
    [{ country: "Unknown", exchange: "Unknown", ticker: "XYZ.QQ" }, "Inconnu", null, "aucune information"],
  ];
  for (const [input, name, numeric, label] of cases) {
    test(label, () => {
      const r = resolveCountry(input);
      assert.equal(r.name, name);
      assert.equal(r.numeric, numeric);
    });
  }
});

describe("GET /api/user/portfolio : pays", () => {
  before(h.start);
  after(h.stop);
  beforeEach(h.resetState);

  test("renvoie le code ISO numérique utilisé par la carte", async () => {
    const { token } = await h.registerUser();
    await h.request("POST", "/api/user/portfolio", { token, body: { ticker: "AAPL" } });
    await h.request("POST", "/api/user/portfolio", { token, body: { ticker: "MC.PA" } });
    const { body } = await h.request("GET", "/api/user/portfolio", { token });
    const byTicker = Object.fromEntries(body.stocks.map((s) => [s.ticker, s]));
    assert.deepEqual(
      [byTicker.AAPL.country, byTicker.AAPL.countryCode, byTicker.AAPL.countryNumeric],
      ["États-Unis", "US", "840"]
    );
    assert.equal(byTicker["MC.PA"].countryNumeric, "250");

    const cached = await h.db.collection("prices").findOne({ symbol: "AAPL" });
    assert.equal(cached.countryCode, "US", "le code pays du profil est enregistré");
  });

  test("corrige à la lecture les anciennes valeurs mal enregistrées", async () => {
    const { token } = await h.registerUser();
    await h.request("POST", "/api/user/portfolio", { token, body: { ticker: "AAPL" } });
    await h.db.collection("prices").updateOne({ symbol: "AAPL" }, { $set: { country: "NasdaqGS", countryCode: null } });
    const { body } = await h.request("GET", "/api/user/portfolio", { token });
    assert.equal(body.stocks[0].country, "États-Unis");
    assert.equal(body.stocks[0].countryNumeric, "840");
  });

  test("récupère une fois le profil des titres enregistrés sans code pays", async () => {
    const { token } = await h.registerUser();
    await h.request("POST", "/api/user/portfolio", { token, body: { ticker: "AAPL" } });
    await h.db.collection("prices").updateOne(
      { symbol: "AAPL" },
      { $set: { countryCode: null, lastUpdate: new Date(Date.now() - 3600e3), fullUpdateAt: new Date(Date.now() - 3600e3) } }
    );
    h.fmp.calls.length = 0;
    await h.request("POST", "/api/user/portfolio/force-refresh", { token });
    assert.ok(h.fmp.calls.some((c) => c.endpoint === "profile"), "profil re-téléchargé");
    const cached = await h.db.collection("prices").findOne({ symbol: "AAPL" });
    assert.equal(cached.countryCode, "US");
  });
});
