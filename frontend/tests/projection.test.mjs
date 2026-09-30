// Tests unitaires de lib/projection.js (node:test, sans dépendance) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthlyRate,
  futureValue,
  monthsToReach,
  monthlyContributionNeeded,
  monthsUntil,
  dateAfterMonths,
  capitalForIncome,
  incomeFromCapital,
  toTodayEuros,
  realRate,
  projectionSeries,
} from '../lib/projection.js';

const close = (actual, expected, tol = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≠ ${expected} (±${tol})`);

// Taux annuel dont l'équivalent mensuel vaut exactement 0,5 %
const R_HALF_PCT = Math.pow(1.005, 12) - 1;

test('monthlyRate : 12 mois composés redonnent le taux annuel', () => {
  close(monthlyRate(R_HALF_PCT), 0.005, 1e-12);
  close(Math.pow(1 + monthlyRate(0.06), 12) - 1, 0.06, 1e-12);
  assert.equal(monthlyRate(0), 0);
});

test('futureValue : capital seul, 10 000 € à 6 % pendant 10 ans', () => {
  close(futureValue({ initial: 10000, annualRate: 0.06, months: 120 }), 10000 * 1.06 ** 10); // 17 908,48
});

test('futureValue : versements seuls, 100 €/mois à 0,5 %/mois pendant 12 mois (fin de mois)', () => {
  close(futureValue({ monthly: 100, annualRate: R_HALF_PCT, months: 12 }), 1233.56);
});

test('futureValue : rendement nul = simple somme', () => {
  assert.equal(futureValue({ initial: 1000, monthly: 100, annualRate: 0, months: 12 }), 2200);
  assert.equal(futureValue({ initial: 1000, monthly: 100, months: 0 }), 1000);
});

test('monthsToReach : doublement en 10 ans pile (pas 121 mois par erreur d\'arrondi)', () => {
  const rate = Math.pow(2, 1 / 10) - 1;
  assert.equal(monthsToReach({ initial: 10000, annualRate: rate, target: 20000 }), 120);
});

test('monthsToReach : cohérent avec futureValue (avec versements)', () => {
  const args = { initial: 25000, monthly: 500, annualRate: 0.06 };
  const n = monthsToReach({ ...args, target: 1_000_000 });
  assert.ok(n > 0);
  assert.ok(futureValue({ ...args, months: n }) >= 1_000_000);
  assert.ok(futureValue({ ...args, months: n - 1 }) < 1_000_000);
});

test('monthsToReach : rendement nul, déjà atteint, hors d\'atteinte', () => {
  assert.equal(monthsToReach({ initial: 1000, monthly: 100, annualRate: 0, target: 2200 }), 12);
  assert.equal(monthsToReach({ initial: 5000, target: 4000 }), 0);
  assert.equal(monthsToReach({ initial: 0, monthly: 0, annualRate: 0.05, target: 1000 }), null);
  assert.equal(monthsToReach({ initial: 1000, monthly: 0, annualRate: 0, target: 2000 }), null);
  assert.equal(monthsToReach({ initial: 1000, monthly: 0, annualRate: -0.02, target: 2000 }), null);
  assert.equal(monthsToReach({ initial: 1000, target: 0 }), null);
  // au-delà de 100 ans → null
  assert.equal(monthsToReach({ initial: 0, monthly: 1, annualRate: 0, target: 1_000_000 }), null);
});

test('monthsToReach : rendement négatif compensé par les versements', () => {
  const args = { initial: 0, monthly: 1000, annualRate: -0.02 };
  const n = monthsToReach({ ...args, target: 10000 });
  assert.ok(n > 10 && n < 12);
  assert.ok(futureValue({ ...args, months: n }) >= 10000);
});

test('monthlyContributionNeeded : inverse de futureValue', () => {
  close(monthlyContributionNeeded({ target: 1233.56, annualRate: R_HALF_PCT, months: 12 }), 100);
  const perMonth = monthlyContributionNeeded({ initial: 20000, target: 500000, annualRate: 0.06, months: 240 });
  close(futureValue({ initial: 20000, monthly: perMonth, annualRate: 0.06, months: 240 }), 500000);
});

test('monthlyContributionNeeded : rendement nul, déjà couvert, durée invalide', () => {
  assert.equal(monthlyContributionNeeded({ initial: 1000, target: 2200, months: 12 }), 100);
  assert.equal(monthlyContributionNeeded({ initial: 10000, target: 15000, annualRate: 0.06, months: 120 }), 0);
  assert.equal(monthlyContributionNeeded({ target: 1000, months: 0 }), null);
  assert.equal(monthlyContributionNeeded({ target: 1000, months: -3 }), null);
});

test('monthsUntil / dateAfterMonths', () => {
  const now = new Date(2026, 8, 30); // 30/09/2026
  assert.equal(monthsUntil('2036-09-30', now), 120);
  assert.equal(monthsUntil('2027-03-15', now), 5);
  assert.equal(monthsUntil('pas une date', now), null);
  assert.deepEqual(dateAfterMonths(120, now), { year: 2036, month: 9 });
  assert.deepEqual(dateAfterMonths(4, now), { year: 2027, month: 1 });
  assert.equal(dateAfterMonths(null, now), null);
});

test('capitalForIncome : rente annuelle / rendement', () => {
  assert.equal(capitalForIncome({ annualIncome: 24000, yieldRate: 0.04 }), 600000);
  // 2 000 €/mois à 3 % → 800 000 €
  close(capitalForIncome({ monthlyIncome: 2000, yieldRate: 0.03 }), 800000, 1e-6);
  assert.equal(capitalForIncome({ annualIncome: 24000, yieldRate: 0 }), null);
  assert.equal(capitalForIncome({ yieldRate: 0.04 }), null);
  close(incomeFromCapital(600000, 0.04), 24000, 1e-6);
  assert.equal(incomeFromCapital(600000, 0), 0);
});

test('inflation : euros d\'aujourd\'hui et rendement réel', () => {
  close(toTodayEuros(1_000_000, 0.02, 120), 1_000_000 / 1.02 ** 10); // 820 348,30
  assert.equal(toTodayEuros(1000, 0, 120), 1000);
  assert.equal(toTodayEuros(1000, 0.02, 0), 1000);
  close(realRate(0.06, 0.02), 0.0392157, 1e-6);
  // projeter au taux réel = projeter au taux nominal puis déflater (capital seul)
  close(
    futureValue({ initial: 10000, annualRate: realRate(0.06, 0.02), months: 120 }),
    toTodayEuros(futureValue({ initial: 10000, annualRate: 0.06, months: 120 }), 0.02, 120),
  );
});

test('projectionSeries : un point par an, départ = capital initial', () => {
  const s = projectionSeries({ initial: 1000, monthly: 100, annualRate: 0, years: 3 });
  assert.deepEqual(s, [
    { year: 0, value: 1000 },
    { year: 1, value: 2200 },
    { year: 2, value: 3400 },
    { year: 3, value: 4600 },
  ]);
});
