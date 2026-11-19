// Tests de lib/benchmark.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareToBenchmark, sliceDaily, gapPoints } from '../lib/benchmark.js';

const daily = [
  { date: '2025-12-31', value: 100 },
  { date: '2026-01-15', value: 110 },
  { date: '2026-08-20', value: 120 },
  { date: '2026-09-10', value: 130 },
  { date: '2026-10-09', value: 140 },
];

test('périodes : 1 mois, cette année, tout', () => {
  assert.deepEqual(sliceDaily(daily, '1m').map((p) => p.date), ['2026-09-10', '2026-10-09']);
  assert.equal(sliceDaily(daily, 'ytd').length, 4); // sans le 31/12/2025
  assert.equal(sliceDaily(daily, 'all').length, 5);
  assert.equal(sliceDaily(daily, 'inconnue').length, 5);
  assert.deepEqual(sliceDaily([], '1m'), []);
});

test('écart en points entre portefeuille et indice', () => {
  const idx = [{ date: '2026-09-10', close: 100 }, { date: '2026-10-09', close: 105 }];
  const cmp = compareToBenchmark(sliceDaily(daily, '1m'), idx);
  assert.ok(Math.abs(cmp.portfolioPct - (140 / 130 - 1) * 100) < 0.01);
  assert.ok(Math.abs(gapPoints(cmp) - (cmp.portfolioPct - 5)) < 1e-9);
  assert.equal(gapPoints(null), null);
});

import { estimatePastDividends } from '../lib/benchmark.js';

test('versements estimés : dates reculées depuis le dernier détachement, selon la fréquence', () => {
  const pos = [{ totalAnnualBase: 120, frequency: 4, lastExDate: '2026-09-15T12:00:00.000Z' }];
  const pays = estimatePastDividends(pos, '2026-01-01', '2026-10-31');
  assert.deepEqual(pays.map((p) => p.date), ['2026-03-15', '2026-06-15', '2026-09-15']);
  assert.ok(pays.every((p) => p.amount === 30));
  assert.deepEqual(estimatePastDividends([{ totalAnnualBase: null, frequency: 4, lastExDate: '2026-09-15' }], '2026-01-01', '2026-12-31'), []);
  assert.deepEqual(estimatePastDividends([{ totalAnnualBase: 10, frequency: 1, lastExDate: null }], '2026-01-01', '2026-12-31'), []);
});

test('courbe dividendes réinvestis : au-dessus du portefeuille après un versement, indice inchangé', () => {
  const d = [
    { date: '2026-09-01', value: 1000 },
    { date: '2026-09-10', value: 1000 },
    { date: '2026-09-20', value: 1000 },
  ];
  const idx = [{ date: '2026-09-01', close: 100 }, { date: '2026-09-20', close: 100 }];
  const base = compareToBenchmark(d, idx);
  const withDiv = compareToBenchmark(d, idx, [{ date: '2026-09-15', amount: 50 }]);
  assert.deepEqual(withDiv.series.map((p) => p.index), base.series.map((p) => p.index));
  assert.equal(withDiv.series[1].withDividends, 100); // avant le versement
  assert.equal(withDiv.series[2].withDividends, 105); // +50 € sur 1 000 €
  assert.equal(withDiv.dividendsPct, 5);
  assert.equal(base.dividendsPct, undefined);
  // versement hors période : pas de courbe
  const none = compareToBenchmark(d, idx, [{ date: '2025-01-01', amount: 50 }]);
  assert.equal(none.dividendsPct, undefined);
  assert.equal(none.series[0].withDividends, undefined);
});
