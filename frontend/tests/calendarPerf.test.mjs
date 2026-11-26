// Tests de lib/calendarPerf.js (node:test) : `cd frontend && npm test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarPerformance, monthNumber } from '../lib/calendarPerf.js';

const close = (a, b) => Math.abs(a - b) < 1e-6;

test('mois : noms anglais, numéros, valeurs illisibles', () => {
  assert.equal(monthNumber('June'), 6);
  assert.equal(monthNumber('6'), 6);
  assert.equal(monthNumber(12), 12);
  assert.equal(monthNumber('Juin'), null);
  assert.equal(monthNumber(13), null);
});

// Suivi quotidien avec indice : apport de 1 000 € le 5 nov., aucun gain ce jour-là
const daily = [
  { date: '2026-10-30', value: 1000, perf: 100, dayGain: 0 },
  { date: '2026-10-31', value: 1010, perf: 101, dayGain: 10 },
  { date: '2026-11-04', value: 1020, perf: 102, dayGain: 10 },
  { date: '2026-11-05', value: 2020, perf: 102, dayGain: 0 }, // apport
  { date: '2026-11-25', value: 2060, perf: 104.0396, dayGain: 40 },
];

test('mois hors apports : % sur l\'indice, gain = somme des gains, apports isolés', () => {
  const { monthly } = calendarPerformance(daily, []);
  assert.equal(monthly.length, 1);
  const nov = monthly[0];
  assert.equal(nov.key, '2026-11');
  assert.equal(nov.approx, false);
  assert.ok(close(nov.pct, (104.0396 / 101 - 1) * 100)); // ≈ +3 %, pas +104 %
  assert.equal(nov.amount, 50);
  assert.equal(nov.flows, 1000);
  assert.equal(nov.startValue, 1010);
  assert.equal(nov.endValue, 2060);
});

test('total : démarre au premier jour suivi', () => {
  const { total } = calendarPerformance(daily, []);
  assert.equal(total.from, '2026-10-30');
  assert.ok(close(total.pct, 4.0396));
  assert.equal(total.amount, 60);
  assert.equal(total.flows, 1000);
});

test('ancien relevé mensuel avant le quotidien : approx, apports inconnus, mois manquant signalé', () => {
  const history = [
    { year: 2026, month: 'July', value: 800 },
    { year: 2026, month: 'September', value: 900 }, // août absent
    { year: 2026, month: 'October', value: 999 }, // ignoré : le quotidien couvre octobre
  ];
  const { monthly, total } = calendarPerformance(daily, history);
  assert.deepEqual(monthly.map((m) => m.key), ['2026-09', '2026-10', '2026-11']);
  const sep = monthly[0];
  assert.equal(sep.partial, true);
  assert.equal(sep.gapMonths, 2);
  assert.equal(sep.approx, true);
  assert.equal(sep.flows, null);
  assert.equal(sep.amount, 100);
  const oct = monthly[1];
  assert.equal(oct.approx, true); // départ = relevé mensuel
  assert.equal(oct.startValue, 900);
  assert.equal(monthly[2].approx, false);
  assert.equal(total.approx, true);
  assert.equal(total.startValue, 800);
});

test('années : partielle sans décembre précédent, complète sinon', () => {
  const history = [
    { year: 2024, month: 'December', value: 500 },
    { year: 2025, month: 'June', value: 600 },
    { year: 2025, month: 'December', value: 700 },
    { year: 2026, month: 'March', value: 750 },
  ];
  const { yearly } = calendarPerformance(daily, history);
  assert.deepEqual(yearly.map((y) => y.year), [2025, 2026]); // 2024 : un seul relevé, rien avant
  assert.equal(yearly[0].partial, false);
  assert.equal(yearly[0].startValue, 500);
  assert.equal(yearly[0].endValue, 700);
  assert.ok(close(yearly[0].pct, 40));
  assert.equal(yearly[1].startValue, 700);
  assert.equal(yearly[1].endValue, 2060);
  assert.equal(yearly[1].monthsCount, 3);

  const first = calendarPerformance([], [{ year: 2026, month: 'March', value: 100 }, { year: 2026, month: 'May', value: 110 }]);
  assert.equal(first.yearly[0].partial, true);
  assert.equal(first.yearly[0].startValue, 100);
});

test('valeur de départ à 0 : pas de division par zéro', () => {
  const { monthly } = calendarPerformance([], [
    { year: 2026, month: 'January', value: 0 },
    { year: 2026, month: 'February', value: 500 },
  ]);
  assert.equal(monthly[0].pct, null);
  assert.equal(monthly[0].amount, 500);
});

test('historiques vides', () => {
  assert.deepEqual(calendarPerformance([], []), { monthly: [], yearly: [], total: null });
  assert.deepEqual(calendarPerformance(null, null), { monthly: [], yearly: [], total: null });
});
