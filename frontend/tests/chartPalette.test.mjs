// Tests de lib/chartPalette.js et des jetons --chart-* de globals.css (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHART_SLOTS, TYPE_SLOT, typeColor, assignColors, sectorColors, currencyColors, countryColors,
  canonicalSector, mergeSectorRows, DEBT_COLOR,
} from '../lib/chartPalette.js';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

// Lit les jetons "--nom: r g b;" d'un bloc (:root principal des tokens ou .dark)
function tokens(blockStart) {
  const start = css.indexOf(blockStart);
  const end = css.indexOf('}', start);
  const out = {};
  for (const m of css.slice(start, end).matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+);/g)) out[m[1]] = [+m[2], +m[3], +m[4]];
  return out;
}
const light = tokens('--bg: 247 248 246') && tokens(':root {\n  --bg:');
const dark = tokens('.dark {');

const lum = ([r, g, b]) => {
  const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

for (const [mode, t] of [['clair', light], ['sombre', dark]]) {
  test(`palette ${mode} : ${CHART_SLOTS.length} jetons, chacun à 3:1 minimum contre la carte`, () => {
    for (let i = 1; i <= CHART_SLOTS.length; i++) {
      const c = t[`chart-${i}`];
      assert.ok(c, `--chart-${i} manquant (${mode})`);
      const ratio = contrast(c, t.surface);
      assert.ok(ratio >= 3, `--chart-${i} (${CHART_SLOTS[i - 1]}) ${mode} : contraste ${ratio.toFixed(2)} < 3`);
    }
  });

  test(`palette ${mode} : deux couleurs ne se ressemblent jamais trop`, () => {
    for (let i = 1; i <= CHART_SLOTS.length; i++) {
      for (let j = i + 1; j <= CHART_SLOTS.length; j++) {
        const d = dist(t[`chart-${i}`], t[`chart-${j}`]);
        assert.ok(d >= 55, `--chart-${i} (${CHART_SLOTS[i - 1]}) et --chart-${j} (${CHART_SLOTS[j - 1]}) trop proches en ${mode} (${d.toFixed(0)})`);
      }
    }
  });
}

test('chaque type d’actif a sa couleur, et deux types n’en partagent jamais une', () => {
  const colors = Object.keys(TYPE_SLOT).map(typeColor);
  assert.equal(new Set(colors).size, colors.length);
  assert.equal(typeColor('Type inconnu'), typeColor('Autres'));
  assert.equal(typeColor('Dette'), DEBT_COLOR);
});

test('la couleur d’un type est identique d’un appel à l’autre (cohérence entre écrans)', () => {
  assert.equal(typeColor('Actions'), typeColor('Actions'));
  assert.equal(typeColor('ETF et fonds'), 'rgb(var(--chart-2))');
});

test('assignColors : aucun doublon, même au-delà de la palette', () => {
  const labels = Array.from({ length: 30 }, (_, i) => `Ligne ${i}`);
  const res = assignColors(labels);
  assert.equal(new Set(Object.values(res)).size, labels.length);
});

test('assignColors : « Autres » et « Non renseigné » restent neutres, sans collision', () => {
  const res = assignColors(['A', 'Autres', 'B', 'Non renseigné']);
  assert.equal(res.Autres, 'rgb(var(--chart-11))');
  assert.equal(new Set(Object.values(res)).size, 4);
  assert.notEqual(res.A, res.Autres);
});

test('couleur imposée déjà prise : le second libellé reçoit une autre couleur', () => {
  const res = assignColors(['X', 'Y'], { fixed: { X: 'blue', Y: 'blue' } });
  assert.notEqual(res.X, res.Y);
});

test('secteurs : variantes fusionnées, couleurs stables et distinctes', () => {
  assert.equal(canonicalSector('Financials'), 'Financial Services');
  assert.equal(canonicalSector('Information Technology'), 'Technology');
  const rows = mergeSectorRows([['Financials', 10], ['Financial Services', 5], ['Technology', 20], ['Information Technology', 1]]);
  assert.deepEqual(Object.fromEntries(rows), { 'Financial Services': 15, Technology: 21 });
  const colors = sectorColors(rows.map(([s]) => s));
  assert.notEqual(colors.Technology, colors['Financial Services']);
  assert.equal(sectorColors(['Technology']).Technology, colors.Technology);
});

test('secteurs : « Dette » prend le rouge de perte, sans doublon avec les autres parts', () => {
  const colors = sectorColors(['Technology', 'Healthcare', 'Dette', 'Cash']);
  assert.equal(colors.Dette, DEBT_COLOR);
  assert.equal(new Set(Object.values(colors)).size, 4);
});

test('devises et pays : fixes connus, aucun doublon', () => {
  const cur = currencyColors(['USD', 'EUR', 'GBP', 'JPY', 'SEK', 'NOK']);
  assert.equal(new Set(Object.values(cur)).size, 6);
  assert.equal(currencyColors(['EUR']).EUR, cur.EUR);
  const ctry = countryColors(['États-Unis', 'France', 'Crypto', 'Autres', 'Japon']);
  assert.equal(new Set(Object.values(ctry)).size, 5);
  assert.equal(ctry.Crypto, typeColor('Crypto'));
});
