// Tests unitaires de lib/strategyReview.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketOf,
  positionYield,
  valuedPositions,
  allocationGaps,
  positionsOverLimit,
  rebalanceAmount,
  contributionPlan,
  styleRules,
  strategyReview,
} from '../lib/strategyReview.js';

const id = (v) => v;
const stock = (ticker, value, extra = {}) => ({ ticker, close: value, quantity: 1, currency: 'EUR', type: 'Stock', ...extra });

test('poche d’une position : zone du backend, secours par pays, crypto, inconnue', () => {
  assert.equal(bucketOf({ zone: 'Europe' }), 'europe');
  assert.equal(bucketOf({ zone: 'Océanie' }), 'asiaPacific');
  assert.equal(bucketOf({ zone: 'Amérique latine' }), 'emerging');
  assert.equal(bucketOf({ zone: 'Monde', type: 'ETF' }), 'world');
  assert.equal(bucketOf({ zone: 'Matières premières' }), 'commodities');
  assert.equal(bucketOf({ countryCode: 'us' }), 'northAmerica');
  assert.equal(bucketOf({ type: 'Crypto', zone: 'Europe' }), 'crypto');
  assert.equal(bucketOf({ country: 'Inconnu' }), null);
});

test('rendement : dividende / cours, sinon dividendYield, sinon 0', () => {
  assert.equal(positionYield({ dividend: 3, close: 100 }), 3);
  assert.equal(positionYield({ dividendYield: 2.5 }), 2.5);
  assert.equal(positionYield({}), 0);
});

test('positions valorisées : conversion et positions sans valeur ou sans taux ignorées', () => {
  const toBase = (v, cur) => (cur === 'USD' ? v * 0.9 : cur === 'XXX' ? null : v);
  const list = valuedPositions(
    [stock('A', 100), stock('B', 100, { currency: 'USD' }), stock('C', 0), stock('D', 50, { currency: 'XXX' })],
    toBase
  );
  assert.deepEqual(
    list.map((p) => [p.ticker, p.value]),
    [
      ['A', 100],
      ['B', 90],
    ]
  );
});

test('écarts par poche : part sur l’investi, cash à part, zone inconnue comptée', () => {
  const positions = valuedPositions(
    [stock('AIR', 6000, { zone: 'Europe' }), stock('AAPL', 3000, { zone: 'Amérique du Nord' }), stock('X', 1000)],
    id
  );
  const g = allocationGaps(positions, { europe: 50, northAmerica: 50 }, 2500);
  assert.equal(g.invested, 10000);
  assert.equal(g.total, 12500);
  assert.equal(g.cashShare, 20);
  assert.equal(g.unclassified, 1000);
  assert.equal(g.unclassifiedShare, 10);
  const eu = g.buckets.find((b) => b.key === 'europe');
  const na = g.buckets.find((b) => b.key === 'northAmerica');
  assert.deepEqual([eu.actual, eu.gapPct, eu.gapValue], [60, 10, 1000]);
  assert.deepEqual([na.actual, na.gapPct, na.gapValue], [30, -20, -2000]);
  assert.equal(g.buckets.length, 7);
  assert.equal(rebalanceAmount(g), 1000);
});

test('lignes au-dessus de la limite, triées, avec le montant en excès', () => {
  const positions = valuedPositions([stock('A', 2000), stock('B', 1500), stock('C', 6500)], id);
  assert.deepEqual(positionsOverLimit(positions, 20), [
    { ticker: 'C', name: 'C', weight: 65, excessValue: 4500 },
  ]);
  assert.equal(positionsOverLimit(positions, 100).length, 0);
  assert.equal(positionsOverLimit([], 10).length, 0);
});

test('versement : comble les poches en manque, au prorata si insuffisant, total = versement', () => {
  const positions = valuedPositions([stock('E', 8000, { zone: 'Europe' }), stock('U', 2000, { zone: 'Amérique du Nord' })], id);
  const g = allocationGaps(positions, { europe: 50, northAmerica: 30, asiaPacific: 20 }, 0);
  // Versement de 1 000 € : nouveau total 11 000 → manques Amérique 1 300, Asie 2 200 → prorata
  const plan = contributionPlan(g, 1000);
  assert.equal(
    plan.reduce((s, r) => s + r.amount, 0),
    1000
  );
  assert.equal(plan[0].key, 'asiaPacific');
  assert.equal(plan.find((r) => r.key === 'europe'), undefined);
  assert.ok(Math.abs(plan.find((r) => r.key === 'northAmerica').amount - 371) <= 1);
  // Portefeuille déjà à la cible : le versement suit l'allocation (nouveau total 10 500 → 80 / 20 %)
  const onTarget = contributionPlan(allocationGaps(positions, { europe: 80, northAmerica: 20 }, 0), 500);
  assert.deepEqual(onTarget, [
    { key: 'europe', label: 'Europe', amount: 400 },
    { key: 'northAmerica', label: 'Amérique du Nord', amount: 100 },
  ]);
  assert.deepEqual(contributionPlan(g, 0), []);
});

test('règles propres aux styles : dividendes, passive, croissance', () => {
  const pos = valuedPositions(
    [
      stock('TTE', 5000, { dividend: 3, close: 5000 / 1, quantity: 1, dividendYield: undefined }),
      stock('ASML', 3000, { dividend: 0 }),
      stock('CW8', 2000, { type: 'ETF', zone: 'Monde' }),
    ],
    id
  );
  const div = styleRules('dividendes', pos, { yieldTarget: 4 });
  assert.deepEqual(
    div.map((r) => r.id),
    ['yield-below-target', 'low-yield-lines']
  );
  assert.deepEqual(div[1].tickers, ['TTE', 'ASML']); // l'ETF n'est pas compté comme action

  const passive = styleRules('passive', pos);
  assert.equal(passive[0].id, 'non-etf-share');
  assert.equal(passive[0].value, 80);
  assert.equal(passive[0].severity, 3);

  const growthPos = valuedPositions([stock('ENGI', 6000, { dividendYield: 7 }), stock('NVDA', 4000)], id);
  assert.equal(styleRules('croissance', growthPos)[0].id, 'high-dividend-share');
  assert.equal(styleRules('equilibree', growthPos).length, 0);
});

test('bilan complet : propositions triées par importance, sans rien d’investi → null', () => {
  assert.equal(strategyReview({ stocks: [] }), null);
  const r = strategyReview({
    profile: { strategy: 'equilibree', targetAllocation: { europe: 50, northAmerica: 50 }, maxPositionWeight: 30, monthlySavings: 500 },
    stocks: [stock('AIR', 8000, { zone: 'Europe', dividendYield: 2 }), stock('MSFT', 2000, { zone: 'Amérique du Nord' })],
    cashInBase: 5000,
  });
  const ids = r.proposals.map((x) => x.id);
  assert.deepEqual(ids, ['lines-over-limit', 'underweight-zones', 'overweight-zones', 'rebalance', 'cash-high']);
  assert.equal(r.rebalance, 3000);
  assert.deepEqual(r.plan, [{ key: 'northAmerica', label: 'Amérique du Nord', amount: 500 }]);
  assert.match(r.proposals[1].detail, /500 € vers Amérique du Nord/);
  for (let i = 1; i < r.proposals.length; i++) assert.ok(r.proposals[i - 1].severity >= r.proposals[i].severity);
  // Aucun libellé ne recommande d'acheter un titre précis
  assert.ok(r.proposals.every((x) => !/achet/i.test(x.title + x.detail)));
});

test('bilan sans stratégie enregistrée : valeurs proposées du style équilibré', () => {
  const r = strategyReview({ stocks: [stock('AIR', 1000, { zone: 'Europe' })] });
  assert.equal(r.strategy, 'equilibree');
  assert.equal(r.maxPositionWeight, 10);
  assert.equal(r.gaps.buckets.find((b) => b.key === 'europe').target, 35);
});
