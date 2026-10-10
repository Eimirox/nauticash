// Tests : contrôle de cohérence des cours (lib pure services/priceConsistency.js)
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const c = require("../services/priceConsistency");

// Vendredi 9 octobre 2026, 18 h UTC
const NOW = new Date("2026-10-09T18:00:00Z");
const fresh = { close: 100, marketTime: "2026-10-09T15:30:00Z", lastUpdate: "2026-10-09T17:00:00Z" };

describe("businessDaysBetween", () => {
  test("ne compte pas le week-end", () => {
    assert.equal(c.businessDaysBetween(new Date("2026-10-09T10:00:00Z"), new Date("2026-10-12T10:00:00Z")), 1);
  });
  test("même jour : 0", () => {
    assert.equal(c.businessDaysBetween(new Date("2026-10-09T01:00:00Z"), NOW), 0);
  });
});

describe("deviationPercent", () => {
  test("écart relatif au cours de référence, arrondi à 0,01", () => {
    assert.equal(c.deviationPercent(105, 100), 5);
    assert.equal(c.deviationPercent(98.7, 100), 1.3);
  });
  test("null si un des cours manque ou vaut 0", () => {
    assert.equal(c.deviationPercent(100, null), null);
    assert.equal(c.deviationPercent(0, 100), null);
  });
});

describe("checkPrice", () => {
  test("cours récent et cohérent : ok", () => {
    const r = c.checkPrice(fresh, { referencePrice: 101, referenceSource: "yahoo", now: NOW });
    assert.equal(r.status, "ok");
    assert.equal(r.deviation, 0.99);
    assert.equal(r.referenceSource, "yahoo");
  });

  test("écart supérieur au seuil : ecart, avec le fournisseur dans le message", () => {
    const r = c.checkPrice(fresh, { referencePrice: 90, referenceSource: "yahoo", now: NOW });
    assert.equal(r.status, "ecart");
    assert.equal(r.deviation, 11.11);
    assert.match(r.message, /11,11 % avec yahoo/);
  });

  test("seuil personnalisable, écart égal au seuil toléré", () => {
    assert.equal(c.checkPrice(fresh, { referencePrice: 102, threshold: 1, now: NOW }).status, "ecart");
    assert.equal(c.checkPrice({ ...fresh, close: 105 }, { referencePrice: 100, now: NOW }).status, "ok");
  });

  test("aucune fiche ou cours nul : echec", () => {
    assert.equal(c.checkPrice(null, { now: NOW }).status, "echec");
    assert.equal(c.checkPrice({ close: 0 }, { now: NOW }).status, "echec");
  });

  test("erreur plus récente que la dernière actualisation : echec avec son message", () => {
    const r = c.checkPrice(
      { ...fresh, lastError: { message: "All providers failed", at: "2026-10-09T17:30:00Z" } },
      { referencePrice: 100, now: NOW }
    );
    assert.equal(r.status, "echec");
    assert.equal(r.message, "All providers failed");
  });

  test("erreur plus ancienne que la dernière actualisation : ignorée", () => {
    const r = c.checkPrice(
      { ...fresh, lastError: { message: "ancienne", at: "2026-10-08T17:30:00Z" } },
      { referencePrice: 100, now: NOW }
    );
    assert.equal(r.status, "ok");
  });

  test("cours sans date de cotation : non_date (cas NVDA, GTT.PA constaté)", () => {
    const r = c.checkPrice({ close: 100, lastUpdate: "2026-10-09T17:00:00Z" }, { referencePrice: 100, now: NOW });
    assert.equal(r.status, "non_date");
  });

  test("cours de plus de 3 jours ouvrés : ancien", () => {
    const r = c.checkPrice({ ...fresh, marketTime: "2026-10-02T15:30:00Z" }, { referencePrice: 100, now: NOW });
    assert.equal(r.status, "ancien");
    assert.match(r.message, /5 jours ouvrés/);
  });

  test("3 jours ouvrés exactement : toléré", () => {
    const r = c.checkPrice({ ...fresh, marketTime: "2026-10-06T15:30:00Z" }, { referencePrice: 100, now: NOW });
    assert.equal(r.status, "ok");
  });

  test("second fournisseur sans réponse : non_verifie", () => {
    const r = c.checkPrice(fresh, { referencePrice: null, referenceSource: "yahoo", now: NOW });
    assert.equal(r.status, "non_verifie");
    assert.equal(r.referenceSource, null);
  });
});

describe("summarize / formatLog", () => {
  const results = [
    { ticker: "AAPL", ...c.checkPrice(fresh, { referencePrice: 100, now: NOW }) },
    { ticker: "MC.PA", ...c.checkPrice(fresh, { referencePrice: 93, now: NOW }) },
    { ticker: "TTE.PA", ...c.checkPrice(fresh, { referencePrice: 80, now: NOW }) },
    { ticker: "NVDA", ...c.checkPrice({ close: 100 }, { referencePrice: 100, now: NOW }) },
    { ticker: "XYZ", ...c.checkPrice(null, { now: NOW }) },
    { ticker: "KO", ...c.checkPrice(fresh, { now: NOW }) },
  ];
  const s = c.summarize(results, { checkedAt: NOW });

  test("compteurs par statut", () => {
    assert.equal(s.total, 6);
    assert.deepEqual(s.counts, { echec: 1, non_date: 1, ecart: 2, ancien: 0, non_verifie: 1, ok: 1 });
  });

  test("titres à surveiller : plus graves d'abord, puis écart décroissant ; ok et non vérifiés exclus", () => {
    assert.deepEqual(s.issues.map((r) => r.ticker), ["XYZ", "NVDA", "TTE.PA", "MC.PA"]);
  });

  test("journal : une ligne d'en-tête et une ligne par titre à surveiller", () => {
    const lines = c.formatLog(s).split("\n");
    assert.equal(lines.length, 5);
    assert.match(lines[0], /6 titres, 1 OK, 4 à surveiller/);
    assert.match(lines[3], /TTE\.PA \[ecart\]/);
  });
});
