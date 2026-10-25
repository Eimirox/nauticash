// Tests unitaires de lib/tickerDetail.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionWeight, priceSummary } from '../lib/tickerDetail.js';

const rates = { USD: 2 }; // 1 € = 2 $ (pour des calculs simples)
const toBase = (amount, cur) => ((cur || 'EUR') === 'EUR' ? amount : rates[cur] ? amount / rates[cur] : null);

test('positionWeight : poids converti dans la devise de référence', () => {
  const stocks = [
    { ticker: 'AI.PA', close: 100, quantity: 3, currency: 'EUR' }, // 300 €
    { ticker: 'AAPL', close: 200, quantity: 2, currency: 'USD' }, // 400 $ = 200 €
  ];
  assert.equal(positionWeight(stocks, 'AI.PA', toBase), 60);
  assert.equal(positionWeight(stocks, 'aapl', toBase), 40);
});

test('positionWeight : une ligne non convertible (taux absents), ligne absente ou total nul → null', () => {
  const stocks = [
    { ticker: 'A', close: 10, quantity: 10, currency: 'EUR' },
    { ticker: 'B', close: 10, quantity: 10, currency: 'XXX' },
  ];
  assert.equal(positionWeight(stocks, 'A', toBase), null);
  assert.equal(positionWeight(stocks, 'B', toBase), null);
  assert.equal(positionWeight(stocks.slice(0, 1), 'A', toBase), 100);
  assert.equal(positionWeight(stocks.slice(0, 1), 'Z', toBase), null);
  assert.equal(positionWeight([{ ticker: 'A', close: 0, quantity: 5, currency: 'EUR' }], 'A', toBase), null);
  assert.equal(positionWeight(null, 'A', toBase), null);
});

test('priceSummary : variation, plus bas et plus haut sur la période, points triés', () => {
  const s = priceSummary([
    { date: '2026-03-01', close: 120 },
    { date: '2025-10-10', close: 100 },
    { date: '2026-01-15', close: 80 },
    { date: '2026-10-09', close: 110 },
  ]);
  assert.equal(s.first, 100);
  assert.equal(s.last, 110);
  assert.ok(Math.abs(s.changePct - 10) < 1e-9);
  assert.deepEqual(s.min, { date: '2026-01-15', close: 80 });
  assert.deepEqual(s.max, { date: '2026-03-01', close: 120 });
  assert.equal(s.from, '2025-10-10');
  assert.equal(s.to, '2026-10-09');
  assert.deepEqual(s.series.map((p) => p.date), ['2025-10-10', '2026-01-15', '2026-03-01', '2026-10-09']);
});

test('priceSummary : cours invalides ignorés, moins de 2 points → null', () => {
  assert.equal(priceSummary([]), null);
  assert.equal(priceSummary(null), null);
  assert.equal(priceSummary([{ date: '2026-01-01', close: 10 }, { date: '2026-01-02', close: null }]), null);
  const s = priceSummary([
    { date: '2026-01-01', close: 10 },
    { date: '2026-01-02', close: 0 },
    { date: '2026-01-03', close: 'abc' },
    { date: '2026-01-04', close: '12' },
  ]);
  assert.equal(s.series.length, 2);
  assert.equal(s.last, 12);
});

import { purchaseMarker, priceDomain } from '../lib/tickerDetail.js';

test('repère d’achat : première séance à partir de la date, ou hors courbe', () => {
  const s = [{ date: '2026-03-02', close: 10 }, { date: '2026-03-05', close: 12 }, { date: '2026-03-06', close: 11 }];
  assert.deepEqual(purchaseMarker(s, '2026-03-04'), { date: '2026-03-05', close: 12 });
  assert.deepEqual(purchaseMarker(s, '2026-03-02'), { date: '2026-03-02', close: 10 });
  assert.deepEqual(purchaseMarker(s, '2025-01-01'), { before: true });
  assert.equal(purchaseMarker(s, '2026-04-01'), null);
  assert.equal(purchaseMarker(s, null), null);
  assert.equal(purchaseMarker([], '2026-03-04'), null);
});

test('axe du cours : inclut toujours le PRU', () => {
  const s = [{ date: 'a', close: 100 }, { date: 'b', close: 120 }];
  const [lo, hi] = priceDomain(s, 60);
  assert.ok(lo < 60 && hi > 120);
  const [lo2, hi2] = priceDomain(s, 0);
  assert.ok(lo2 < 100 && hi2 > 120 && lo2 > 80);
  assert.deepEqual(priceDomain([], 0), ['auto', 'auto']);
});
