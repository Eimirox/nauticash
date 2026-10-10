// Tests unitaires de lib/dividendSort.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDividendSort, sortDividendRows, ariaSortFor } from '../lib/dividendSort.js';

const rows = [
  { ticker: 'A', totalAnnual: 100, totalAnnualBase: 100, yieldPercent: 2, yieldOnCost: 3 },
  { ticker: 'B', totalAnnual: 300, totalAnnualBase: 270, yieldPercent: 5, yieldOnCost: null },
  { ticker: 'C', totalAnnual: 50, totalAnnualBase: 50, yieldPercent: 1, yieldOnCost: 8 },
];
const tickers = (list) => list.map((r) => r.ticker).join('');

test('cycle du clic : décroissant, croissant, puis ordre par défaut ; autre colonne → décroissant', () => {
  let s = nextDividendSort(null, 'yieldPercent');
  assert.deepEqual(s, { key: 'yieldPercent', dir: 'desc' });
  s = nextDividendSort(s, 'yieldPercent');
  assert.deepEqual(s, { key: 'yieldPercent', dir: 'asc' });
  assert.deepEqual(nextDividendSort(s, 'yieldPercent'), { key: null, dir: null });
  assert.deepEqual(nextDividendSort(s, 'totalAnnual'), { key: 'totalAnnual', dir: 'desc' });
});

test('tri du total annuel sur la valeur convertie dans la devise de référence', () => {
  assert.equal(tickers(sortDividendRows(rows, { key: 'totalAnnual', dir: 'desc' })), 'BAC');
  assert.equal(tickers(sortDividendRows(rows, { key: 'totalAnnual', dir: 'asc' })), 'CAB');
  // 300 USD mais seulement 90 € de base : passe derrière A
  const fx = [{ ticker: 'X', totalAnnual: 300, totalAnnualBase: 90 }, { ticker: 'Y', totalAnnual: 100, totalAnnualBase: 100 }];
  assert.equal(tickers(sortDividendRows(fx, { key: 'totalAnnual', dir: 'desc' })), 'YX');
});

test('tri du rendement, croissant et décroissant', () => {
  assert.equal(tickers(sortDividendRows(rows, { key: 'yieldPercent', dir: 'desc' })), 'BAC');
  assert.equal(tickers(sortDividendRows(rows, { key: 'yieldPercent', dir: 'asc' })), 'CAB');
});

test('« Sur PRU » absent toujours en fin de liste, quel que soit le sens', () => {
  assert.equal(tickers(sortDividendRows(rows, { key: 'yieldOnCost', dir: 'desc' })), 'CAB');
  assert.equal(tickers(sortDividendRows(rows, { key: 'yieldOnCost', dir: 'asc' })), 'ACB');
});

test('sans tri actif : ordre reçu conservé, tableau d’origine jamais modifié', () => {
  const before = tickers(rows);
  assert.equal(tickers(sortDividendRows(rows, { key: null, dir: null })), before);
  sortDividendRows(rows, { key: 'yieldPercent', dir: 'asc' });
  assert.equal(tickers(rows), before);
  assert.deepEqual(sortDividendRows(undefined, null), []);
});

test('aria-sort reflète la colonne et le sens actifs', () => {
  assert.equal(ariaSortFor({ key: 'yieldPercent', dir: 'asc' }, 'yieldPercent'), 'ascending');
  assert.equal(ariaSortFor({ key: 'yieldPercent', dir: 'desc' }, 'yieldPercent'), 'descending');
  assert.equal(ariaSortFor({ key: 'yieldPercent', dir: 'desc' }, 'totalAnnual'), 'none');
  assert.equal(ariaSortFor(null, 'totalAnnual'), 'none');
});
