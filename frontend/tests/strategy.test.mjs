// Tests unitaires de lib/strategy.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STRATEGIES,
  ALLOCATION_BUCKETS,
  STRATEGY_DEFAULTS,
  strategyDefaults,
  allocationTotal,
  isValidAllocation,
  initialStrategy,
  isDefaultForStrategy,
  strategyPatch,
} from '../lib/strategy.js';

test('chaque style propose une allocation de 100 % sur les poches connues et une limite par ligne valide', () => {
  const keys = ALLOCATION_BUCKETS.map((b) => b.key).sort();
  for (const { key } of STRATEGIES) {
    const d = STRATEGY_DEFAULTS[key];
    assert.ok(d, `valeurs proposées pour ${key}`);
    assert.deepEqual(Object.keys(d.allocation).sort(), keys);
    assert.equal(allocationTotal(d.allocation), 100, key);
    assert.ok(d.maxPositionWeight >= 1 && d.maxPositionWeight <= 100);
  }
  // Copie : modifier les valeurs proposées ne change pas la référence
  const copy = strategyDefaults('dividendes');
  copy.allocation.europe = 0;
  assert.equal(STRATEGY_DEFAULTS.dividendes.allocation.europe, 45);
});

test('validation de l’allocation : total de 100 % à 0,5 point près, poches de 0 à 100 %', () => {
  assert.ok(isValidAllocation({ world: 85, emerging: 15 }));
  assert.ok(isValidAllocation({ world: '60', europe: '39.6' }), 'total 99,6 accepté');
  assert.ok(isValidAllocation({ world: 100, europe: '' }), 'poche vide = 0');
  assert.ok(!isValidAllocation({ world: 60 }));
  assert.ok(!isValidAllocation({ world: 110, europe: -10 }));
  assert.ok(!isValidAllocation({ world: 'tout' }));
  assert.ok(!isValidAllocation(null));
  assert.equal(allocationTotal({ europe: 33.33, northAmerica: 33.33, asiaPacific: 33.34 }), 100);
});

test('formulaire initial : profil vide → style équilibré proposé ; profil enregistré → ses valeurs', () => {
  const empty = initialStrategy({});
  assert.equal(empty.strategy, 'equilibree');
  assert.equal(empty.saved, false);
  assert.deepEqual(empty.allocation, STRATEGY_DEFAULTS.equilibree.allocation);
  assert.ok(isDefaultForStrategy(empty));

  const onlyStyle = initialStrategy({ strategy: 'passive' });
  assert.equal(onlyStyle.allocation.world, 85, 'valeurs proposées du style enregistré');
  assert.equal(onlyStyle.maxPositionWeight, 90);
  assert.equal(onlyStyle.saved, true);

  const custom = initialStrategy({ strategy: 'dividendes', targetAllocation: { europe: 60, northAmerica: 40 }, maxPositionWeight: 5 });
  assert.equal(custom.allocation.europe, 60);
  assert.equal(custom.allocation.crypto, 0);
  assert.equal(custom.maxPositionWeight, 5);
  assert.ok(!isDefaultForStrategy(custom));
});

test('champs à enregistrer : seulement ce qui change, null si le formulaire est invalide', () => {
  const form = { strategy: 'croissance', ...strategyDefaults('croissance') };
  // Rien d'enregistré : tout est envoyé
  const first = strategyPatch({}, form);
  assert.deepEqual(Object.keys(first).sort(), ['maxPositionWeight', 'strategy', 'targetAllocation']);
  assert.equal(first.targetAllocation.northAmerica, 55);

  const saved = { strategy: 'croissance', targetAllocation: first.targetAllocation, maxPositionWeight: 10 };
  assert.deepEqual(strategyPatch(saved, form), {});
  assert.deepEqual(strategyPatch(saved, { ...form, maxPositionWeight: '12' }), { maxPositionWeight: 12 });

  const moved = { ...form, allocation: { ...form.allocation, europe: 25, crypto: 0 } };
  assert.deepEqual(Object.keys(strategyPatch(saved, moved)), ['targetAllocation']);

  assert.equal(strategyPatch(saved, { ...form, allocation: { ...form.allocation, europe: 50 } }), null, 'total ≠ 100 %');
  assert.equal(strategyPatch(saved, { ...form, maxPositionWeight: 0 }), null);
  assert.equal(strategyPatch(saved, { ...form, strategy: 'autre' }), null);
});
