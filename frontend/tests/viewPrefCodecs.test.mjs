// Tests de lib/viewPrefCodecs.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_PREF_CODECS as C, sameValue, isCustomized } from '../lib/viewPrefCodecs.js';

test('tri des dividendes : un tri actif est enregistré, l’ordre par défaut efface la préférence', () => {
  const c = C.dividendSort;
  assert.deepEqual(c.serialize({ key: 'yieldPercent', dir: 'asc' }), { key: 'yieldPercent', dir: 'asc' });
  assert.equal(c.serialize({ key: null, dir: null }), null);
  assert.equal(c.serialize({ key: 'yieldPercent', dir: null }), null);
  assert.deepEqual(c.deserialize({ key: 'totalAnnual', dir: 'desc' }), { key: 'totalAnnual', dir: 'desc' });
  assert.deepEqual(c.deserialize(undefined), { key: null, dir: null });
  assert.deepEqual(c.deserialize('n’importe quoi'), { key: null, dir: null });
});

test('tri du portefeuille : « none » n’est jamais enregistré', () => {
  const c = C.portfolioSort;
  assert.equal(c.serialize({ key: 'total', dir: 'none' }), null);
  assert.deepEqual(c.serialize({ key: 'total', dir: 'desc' }), { key: 'total', dir: 'desc' });
  assert.deepEqual(c.deserialize(null), { key: null, dir: 'none' });
  assert.deepEqual(c.deserialize({ key: 'pru', dir: 'asc' }), { key: 'pru', dir: 'asc' });
});

test('enveloppe filtrée : « all » efface la préférence', () => {
  const c = C.portfolioAccount;
  assert.equal(c.serialize('all'), null);
  assert.equal(c.serialize('PEA'), 'PEA');
  assert.equal(c.deserialize(undefined), 'all');
  assert.equal(c.deserialize('CTO'), 'CTO');
  assert.equal(c.deserialize(42), 'all');
});

test('années du graphique : triées, sans doublon, 6 au plus ; aucune année = préférence effacée', () => {
  const c = C.historyYears;
  assert.deepEqual(c.serialize([2025, 2026, 2025]), [2026, 2025]);
  assert.equal(c.serialize([]), null);
  assert.equal(c.serialize(null), null);
  assert.equal(c.serialize([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]).length, 6);
  assert.equal(c.deserialize(undefined), null);
  assert.deepEqual(c.deserialize([2026]), [2026]);
});

test('aller-retour : ce qui est enregistré se relit à l’identique', () => {
  for (const [codec, state] of [
    [C.dividendSort, { key: 'yieldOnCost', dir: 'desc' }],
    [C.portfolioSort, { key: 'performance', dir: 'asc' }],
    [C.portfolioAccount, 'PEA'],
    [C.historyYears, [2026, 2025]],
  ]) {
    assert.deepEqual(codec.deserialize(codec.serialize(state)), state, codec.name);
  }
});

test('l’état par défaut ne compte pas comme personnalisé (bouton « Réinitialiser » masqué)', () => {
  for (const codec of Object.values(C)) assert.equal(isCustomized(codec, codec.defaultValue), false, codec.name);
  assert.equal(isCustomized(C.dividendSort, { key: 'totalAnnual', dir: 'asc' }), true);
  assert.equal(isCustomized(C.portfolioAccount, 'PEA'), true);
});

test('sameValue : comparaison structurelle, null et undefined équivalents', () => {
  assert.equal(sameValue({ a: 1 }, { a: 1 }), true);
  assert.equal(sameValue([2026], [2025]), false);
  assert.equal(sameValue(undefined, null), true);
});
