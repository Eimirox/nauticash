// Tests de lib/portfolioEvolution.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthNumber, validSnapshots, variation, evolutionRows, lastSnapshot, availableYears, direction, formatVariation,
} from '../lib/portfolioEvolution.js';

// Cas réel : septembre et octobre 2026 renseignés, décembre 2026 créé à 0 €
const history = [
  { year: 2026, month: 'September', value: 55000 },
  { year: 2026, month: 'October', value: 57750 },
  { year: 2026, month: 'December', value: 0 },
  { year: 2025, month: 12, value: 50000 },
];

test('numéro de mois : nombre, texte numérique ou nom anglais', () => {
  assert.equal(monthNumber(4), 4);
  assert.equal(monthNumber('04'), 4);
  assert.equal(monthNumber('April'), 4);
  assert.equal(monthNumber('Avril'), null);
  assert.equal(monthNumber(13), null);
});

test('un relevé à 0 € ou invalide n’existe pas pour le graphique', () => {
  const snaps = validSnapshots([...history, { year: 2026, month: 'June', value: -5 }, { year: 'x', month: 1, value: 10 }, null]);
  assert.equal(snaps.size, 3);
});

test('variation : % et écart ; impossible sans valeur de départ positive', () => {
  assert.deepEqual(variation(100, 110), { pct: 10, delta: 10 });
  assert.equal(variation(0, 110), null);
  assert.equal(variation(null, 110), null);
  assert.equal(variation(200, 150).pct, -25);
});

test('dernier relevé : le dernier mois avec une valeur > 0, pas décembre à 0 €', () => {
  const last = lastSnapshot(history);
  assert.equal(last.year, 2026);
  assert.equal(last.month, 10);
  assert.equal(last.value, 57750);
  assert.ok(Math.abs(last.pct - 5) < 1e-9); // 55 000 → 57 750 = +5 %
  assert.equal(last.delta, 2750);
});

test('dernier relevé : null sans aucun relevé valide ; pas de % sans mois précédent', () => {
  assert.equal(lastSnapshot([]), null);
  assert.equal(lastSnapshot([{ year: 2026, month: 3, value: 0 }]), null);
  const alone = lastSnapshot([{ year: 2026, month: 3, value: 100 }]);
  assert.equal(alone.pct, null);
});

test('12 mois fixes, valeurs par année, mois vides à null', () => {
  const rows = evolutionRows(history, [2026]);
  assert.equal(rows.length, 12);
  assert.equal(rows[8].year2026, 55000); // septembre
  assert.equal(rows[9].year2026, 57750); // octobre
  assert.equal(rows[11].year2026, null); // décembre à 0 € : ni barre ni %
  assert.equal(rows[0].year2026, null);
  assert.equal(rows[11].pct2026, null);
});

test('% vs mois N-1 : calculé seulement si le mois précédent existe', () => {
  const rows = evolutionRows(history, [2026]);
  assert.equal(rows[8].pct2026, null); // septembre : pas d'août
  assert.ok(Math.abs(rows[9].pct2026 - 5) < 1e-9);
  assert.equal(rows[9].delta2026, 2750);
});

test('janvier se compare à décembre de l’année précédente', () => {
  const h = [{ year: 2025, month: 12, value: 1000 }, { year: 2026, month: 1, value: 900 }];
  const rows = evolutionRows(h, [2026, 2025]);
  assert.ok(Math.abs(rows[0].pct2026 + 10) < 1e-9);
  assert.equal(rows[0].delta2026, -100);
  assert.equal(rows[11].year2025, 1000);
  assert.equal(rows[11].pct2025, null);
});

test('années disponibles : uniquement celles qui ont un relevé valide', () => {
  assert.deepEqual(availableYears([...history, { year: 2024, month: 5, value: 0 }]), [2026, 2025]);
});

test('affichage : flèche et signe, jamais la couleur seule', () => {
  assert.equal(direction(5), 'up');
  assert.equal(direction(-2), 'down');
  assert.equal(direction(0.01), 'flat');
  assert.equal(direction(null), 'none');
  assert.equal(formatVariation(5), '▲ +5,0 %');
  assert.equal(formatVariation(-1.46), '▼ −1,5 %');
  assert.equal(formatVariation(0), '= 0,0 %');
  assert.equal(formatVariation(null), '—');
});

import { monthWindow, valueDomain, pctDomain, axisTick } from '../lib/portfolioEvolution.js';

test('fenêtre de mois : du premier au dernier relevé, 6 mois au minimum', () => {
  const rows = evolutionRows(history, [2026]);
  // septembre et octobre seulement → étendu à 6 mois vers le passé (mai à octobre)
  assert.deepEqual(monthWindow(rows, [2026]), { start: 5, end: 10 });
  // début d'année : on ne peut pas reculer, on élargit vers l'avenir
  const jan = evolutionRows([{ year: 2026, month: 1, value: 10 }, { year: 2026, month: 2, value: 11 }], [2026]);
  assert.deepEqual(monthWindow(jan, [2026]), { start: 1, end: 6 });
  const wide = evolutionRows(
    [{ year: 2026, month: 2, value: 10 }, { year: 2026, month: 10, value: 12 }], [2026]);
  assert.deepEqual(monthWindow(wide, [2026]), { start: 2, end: 10 });
  assert.deepEqual(monthWindow(evolutionRows([], [2026]), [2026]), { start: 1, end: 12 });
});

test('fenêtre de mois : plusieurs années, la plus large l’emporte', () => {
  const h = [{ year: 2026, month: 9, value: 10 }, { year: 2025, month: 3, value: 8 }, { year: 2025, month: 11, value: 9 }];
  assert.deepEqual(monthWindow(evolutionRows(h, [2026, 2025]), [2026, 2025]), { start: 3, end: 11 });
});

test('axe vertical : ajusté aux valeurs, marge haute, graduations rondes, jamais négatif', () => {
  const { domain, ticks } = valueDomain([55000, 57320]);
  assert.ok(domain[0] > 0 && domain[0] < 55000, `bas ${domain[0]}`);
  assert.ok(domain[1] > 57320, `haut ${domain[1]}`);
  assert.ok(domain[1] - 57320 > (57320 - 55000) * 0.4, 'place pour les étiquettes au-dessus du point');
  assert.equal(ticks[0], domain[0]);
  assert.equal(ticks.at(-1), domain[1]);
  const step = ticks[1] - ticks[0];
  assert.ok(ticks.every((t, i) => i === 0 || Math.abs(t - ticks[i - 1] - step) < 1e-6), 'pas régulier');
  assert.ok(valueDomain([100]).domain[0] >= 0);
  assert.deepEqual(valueDomain([]).domain, [0, 1]);
});

test('axe des variations : symétrique autour de 0, au moins ±1 %', () => {
  const rows = evolutionRows(history, [2026]);
  assert.deepEqual(pctDomain(rows, [2026]), [-8, 8]); // +5 % × 1,5 arrondi au-dessus
  assert.deepEqual(pctDomain(evolutionRows([], [2026]), [2026]), [-1, 1]);
});

test('graduations : k et M avec décimale utile, sans arrondir à tort', () => {
  assert.equal(axisTick(57500), '57,5 k');
  assert.equal(axisTick(60000), '60 k');
  assert.equal(axisTick(1200000), '1,2 M');
  assert.equal(axisTick(500), '500');
});

import { labelMode } from '../lib/portfolioEvolution.js';

test('étiquettes : version courte sans flèche, taille selon la place par mois', () => {
  assert.equal(formatVariation(3.34, { short: true }), '+3,3 %');
  assert.equal(formatVariation(-1.46, { short: true }), '−1,5 %');
  assert.equal(formatVariation(null, { short: true }), '—');
  assert.equal(labelMode(120), 'full');
  assert.equal(labelMode(50), 'short');
  assert.equal(labelMode(30), 'none');
});
