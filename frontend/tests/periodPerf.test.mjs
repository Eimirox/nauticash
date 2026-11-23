import { test } from "node:test";
import assert from "node:assert/strict";
import { periodPerformance } from "../lib/periodPerf.js";
import { compareToBenchmark } from "../lib/benchmark.js";

const find = (res, key) => res.find((r) => r.key === key);

test("sans indice (anciennes photos) : repli sur la valeur totale, signalé approx", () => {
  const res = periodPerformance([
    { date: "2026-11-15", value: 1000 },
    { date: "2026-11-22", value: 1100 },
  ]);
  const w = find(res, "7d");
  assert.equal(w.approx, true);
  assert.equal(Math.round(w.pct), 10);
});

test("avec indice : un apport massif ne change pas la performance", () => {
  const pts = [
    { date: "2026-11-15", value: 1000, perf: 100, dayGain: 0 },
    // valeur ×5 par un apport, mais cours inchangés : l'indice reste à 100
    { date: "2026-11-16", value: 5000, perf: 100, dayGain: 0 },
    { date: "2026-11-22", value: 5500, perf: 110, dayGain: 500 },
  ];
  const w = find(periodPerformance(pts), "7d");
  assert.equal(w.approx, false);
  assert.equal(Math.round(w.pct * 100) / 100, 10);
  assert.equal(w.amount, 500);
});

test("avec indice : seules les photos munies d'un indice servent de référence", () => {
  const pts = [
    { date: "2026-10-01", value: 9999 }, // ancienne photo, ignorée
    { date: "2026-11-20", value: 2000, perf: 100, dayGain: 0 },
    { date: "2026-11-22", value: 2200, perf: 105, dayGain: 100 },
  ];
  const res = periodPerformance(pts);
  assert.equal(find(res, "1m").approx, false);
  assert.equal(Math.round(find(res, "1m").pct * 100) / 100, 5);
});

test("comparaison à un indice : la courbe du portefeuille suit l'indice hors apports", () => {
  const daily = [
    { date: "2026-11-15", value: 1000, perf: 100 },
    { date: "2026-11-16", value: 5000, perf: 100 }, // apport
    { date: "2026-11-17", value: 5500, perf: 110 },
  ];
  const index = [
    { date: "2026-11-15", close: 50 },
    { date: "2026-11-16", close: 50 },
    { date: "2026-11-17", close: 51 },
  ];
  const out = compareToBenchmark(daily, index);
  assert.equal(out.series[1].portfolio, 100);
  assert.equal(out.series[2].portfolio, 110);
});
