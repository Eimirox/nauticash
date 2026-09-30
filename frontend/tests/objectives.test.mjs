// Tests unitaires de lib/objectives.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ASSUMPTIONS,
  currentYieldPct,
  initialAssumptions,
  wealthGoalEta,
  incomeGoalEta,
  etaLabel,
  assumptionsPatch,
} from '../lib/objectives.js';

const NOW = new Date(2026, 8, 30); // 30 septembre 2026

test('rendement actuel du portefeuille', () => {
  assert.equal(currentYieldPct(1500, 50000), 3);
  assert.equal(currentYieldPct(0, 50000), null);
  assert.equal(currentYieldPct(100, 0), null);
});

test('hypothèses : profil, sinon défauts (rendement du dividende = rendement actuel)', () => {
  assert.deepEqual(initialAssumptions({}), { ...DEFAULT_ASSUMPTIONS });
  const a = initialAssumptions({ goalAmount: 500000, expectedReturn: 0, dividendYield: null }, { currentYield: 2.4 });
  assert.equal(a.goalAmount, 500000);
  assert.equal(a.expectedReturn, 0, '0 est une valeur choisie, pas une absence');
  assert.equal(a.dividendYield, 2.4);
  assert.equal(initialAssumptions({}, { currentYield: 40 }).dividendYield, 15, 'borné comme le backend');
});

test('patrimoine : 10 000 € doublés en 10 ans à 7,177 % réel sans versement', () => {
  // (1 + r)^10 = 2 ⇔ r ≈ 7,177 % ; inflation 0
  const r = wealthGoalEta({ current: 10000, target: 20000, expectedReturn: 7.1773463, inflationRate: 0, now: NOW });
  assert.equal(r.months, 120);
  assert.equal(r.year, 2036);
  assert.equal(etaLabel(r), 'Vous y êtes dans 10 ans (en 2036)');
});

test('patrimoine : sans rendement ni inflation, simple division', () => {
  const r = wealthGoalEta({ current: 0, target: 12000, monthlySavings: 1000, expectedReturn: 0, inflationRate: 0, now: NOW });
  assert.equal(r.months, 12);
  assert.equal(etaLabel(r), 'Vous y êtes dans 1 an (en 2027)');
  const r2 = wealthGoalEta({ current: 0, target: 18000, monthlySavings: 1000, expectedReturn: 0, inflationRate: 0, now: NOW });
  assert.equal(etaLabel(r2), 'Vous y êtes dans 1 an et 6 mois (en 2028)');
});

test("patrimoine : l'inflation allonge le délai (euros d'aujourd'hui)", () => {
  const base = { current: 50000, target: 1e6, monthlySavings: 500, expectedReturn: 6, now: NOW };
  const sans = wealthGoalEta({ ...base, inflationRate: 0 });
  const avec = wealthGoalEta({ ...base, inflationRate: 2 });
  assert.ok(avec.months > sans.months, `${avec.months} > ${sans.months}`);
});

test('patrimoine : déjà atteint, hors d’atteinte, objectif absent', () => {
  assert.equal(etaLabel(wealthGoalEta({ current: 2e6, target: 1e6, now: NOW })), 'Objectif déjà atteint');
  const never = wealthGoalEta({ current: 0, target: 1e6, monthlySavings: 0, expectedReturn: 6, now: NOW });
  assert.equal(never.unreachable, true);
  assert.match(etaLabel(never), /Hors d’atteinte/);
  assert.equal(wealthGoalEta({ current: 1000, target: null }), null);
});

test('rente : 2 000 €/mois à 4 % → 600 000 € de capital', () => {
  const r = incomeGoalEta({ current: 0, targetMonthly: 2000, dividendYield: 4, monthlySavings: 5000, expectedReturn: 0, inflationRate: 0, now: NOW });
  assert.equal(r.capitalNeeded, 600000);
  assert.equal(r.months, 120);
});

test('rente déjà couverte par les dividendes actuels', () => {
  const r = incomeGoalEta({ current: 100000, currentAnnualIncome: 30000, targetMonthly: 2000, dividendYield: 3, now: NOW });
  assert.equal(r.reached, true);
  assert.equal(r.currentMonthly, 2500);
  assert.equal(incomeGoalEta({ targetMonthly: 2000, dividendYield: 0 }), null, 'rendement nul : pas de calcul');
});

test('enregistrement : seules les hypothèses modifiées sont envoyées', () => {
  const saved = { goalAmount: 1e6, incomeGoalMonthly: null, monthlySavings: 300, expectedReturn: 6, dividendYield: 3.5, inflationRate: 2 };
  const next = { ...saved, incomeGoalMonthly: 2000, monthlySavings: 400 };
  assert.deepEqual(assumptionsPatch(saved, next), { incomeGoalMonthly: 2000, monthlySavings: 400 });
  assert.deepEqual(assumptionsPatch(saved, { ...saved, incomeGoalMonthly: undefined }), {});
});
