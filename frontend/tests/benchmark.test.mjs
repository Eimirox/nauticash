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
