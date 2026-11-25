import { test } from "node:test";
import assert from "node:assert/strict";
import { periodPerformance, performanceSeries } from "../lib/periodPerf.js";
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

test("avec indice : l'ancien historique est raccordé à l'indice (jour de raccord = rendement nul)", () => {
  const pts = [
    { date: "2026-10-01", value: 1000 }, // ancien historique, sans indice
    { date: "2026-11-01", value: 1100 }, // +10 % sur l'ancien historique
    { date: "2026-11-20", value: 5000, perf: 100, dayGain: 0 }, // gros apport le jour du raccord : ignoré
    { date: "2026-11-22", value: 5250, perf: 105, dayGain: 250 },
  ];
  const { indexed, series } = performanceSeries(pts);
  assert.equal(indexed, true);
  assert.equal(series.length, 4);
  assert.equal(series[1].idx, 100, "le dernier point de l'ancien historique se raccorde à 100");
  assert.equal(Math.round(series[0].idx * 100) / 100, 90.91);
  const res = periodPerformance(pts);
  assert.equal(find(res, "1y").approx, true, "une période qui remonte dans l'ancien historique reste approximative");
  assert.equal(find(res, "1d").approx, false);
  // 1 an : +10 % (ancien) puis +5 % (indice) = +15,5 % ; le jour du gros apport ne compte pas
  assert.equal(Math.round(find(res, "1y").pct * 10) / 10, 15.5);
});

test("avec indice : la courbe garde tout l'historique (pas seulement les jours avec indice)", () => {
  const daily = [
    { date: "2026-10-01", value: 1000 },
    { date: "2026-10-02", value: 1010 },
    { date: "2026-10-03", value: 1020 },
    { date: "2026-10-04", value: 1030, perf: 100, dayGain: 0 },
    { date: "2026-10-05", value: 1060, perf: 103, dayGain: 30 },
  ];
  const index = daily.map((p, i) => ({ date: p.date, close: 100 + i }));
  const out = compareToBenchmark(daily, index);
  assert.equal(out.series.length, 5);
  assert.equal(out.from, "2026-10-01");
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
