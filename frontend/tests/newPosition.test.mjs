// Tests unitaires de lib/newPosition.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, readNewPosition } from '../lib/newPosition.js';

test('parseAmount : virgule décimale, espaces de milliers, champ vide = 0', () => {
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('1 234,56'), 1234.56);
  assert.equal(parseAmount('1 000'), 1000);
  assert.equal(parseAmount('0.25'), 0.25);
  assert.equal(parseAmount(''), 0);
  assert.equal(parseAmount('  '), 0);
  assert.equal(parseAmount(undefined), 0);
});

test('parseAmount : texte, négatif, double séparateur ou montant démesuré → NaN', () => {
  for (const bad of ['abc', '-3', '1,2,3', '.', '1e5', '2000000000000']) {
    assert.ok(Number.isNaN(parseAmount(bad)), bad);
  }
});

test('readNewPosition : corps prêt pour le POST, enveloppe facultative', () => {
  assert.deepEqual(readNewPosition({ quantity: '10', pru: '152,30', account: 'pea' }), {
    ok: true,
    body: { quantity: 10, pru: 152.3, account: 'PEA' },
  });
  assert.deepEqual(readNewPosition({ quantity: '', pru: '', account: '' }), {
    ok: true,
    body: { quantity: 0, pru: 0, account: null },
  });
});

test('readNewPosition : une erreur par champ invalide', () => {
  const r = readNewPosition({ quantity: '-1', pru: 'x', account: 'LIVRET' });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['account', 'pru', 'quantity']);
});
