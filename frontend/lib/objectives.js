// frontend/lib/objectives.js
// Page Objectifs : hypothèses par défaut et date d'arrivée des objectifs (fonctions pures).
//
// Tous les montants sont exprimés en euros d'aujourd'hui (devise de référence) : la projection
// utilise le rendement réel (rendement espéré corrigé de l'inflation) et suppose une épargne
// mensuelle revalorisée chaque année comme les prix.

import { monthsToReach, dateAfterMonths, capitalForIncome, realRate, futureValue, monthlyContributionNeeded, monthsUntil } from './projection.js';

export const DEFAULT_ASSUMPTIONS = Object.freeze({
  goalAmount: 1000000,
  incomeGoalMonthly: 2000,
  monthlySavings: 300,
  expectedReturn: 6, // %/an
  dividendYield: 3.5, // % (remplacé par le rendement actuel du portefeuille s'il est connu)
  inflationRate: 2, // %/an
});

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
const pick = (v, fallback) => (Number.isFinite(num(v)) ? num(v) : fallback);

/** Rendement du dividende actuel du portefeuille, en % (null si inconnu). */
export function currentYieldPct(annualDividends, invested) {
  const a = Number(annualDividends);
  const v = Number(invested);
  if (!(a > 0) || !(v > 0)) return null;
  return Math.round((a / v) * 10000) / 100;
}

/**
 * Hypothèses de la page : valeurs du profil, sinon valeurs par défaut
 * (rendement du dividende par défaut = rendement actuel du portefeuille, borné à 0,1–15 %).
 */
export function initialAssumptions(profile = {}, { currentYield = null } = {}) {
  const p = profile || {};
  const yieldDefault = currentYield > 0 ? Math.min(15, Math.max(0.1, currentYield)) : DEFAULT_ASSUMPTIONS.dividendYield;
  return {
    goalAmount: pick(p.goalAmount, DEFAULT_ASSUMPTIONS.goalAmount),
    incomeGoalMonthly: pick(p.incomeGoalMonthly, DEFAULT_ASSUMPTIONS.incomeGoalMonthly),
    monthlySavings: pick(p.monthlySavings, DEFAULT_ASSUMPTIONS.monthlySavings),
    expectedReturn: pick(p.expectedReturn, DEFAULT_ASSUMPTIONS.expectedReturn),
    dividendYield: pick(p.dividendYield, yieldDefault),
    inflationRate: pick(p.inflationRate, DEFAULT_ASSUMPTIONS.inflationRate),
  };
}

/** Résultat commun : { months, year, month, reached, unreachable } */
function eta(months, now) {
  if (months === null) return { months: null, year: null, month: null, reached: false, unreachable: true };
  const d = dateAfterMonths(months, now);
  return { months, year: d.year, month: d.month, reached: months === 0, unreachable: false };
}

/**
 * Date d'arrivée de l'objectif de patrimoine.
 * wealthGoalEta({ current: 50000, target: 1e6, monthlySavings: 500, expectedReturn: 6, inflationRate: 2 })
 */
export function wealthGoalEta({ current = 0, target, monthlySavings = 0, expectedReturn = 0, inflationRate = 0, now = new Date() } = {}) {
  if (!(Number(target) > 0)) return null;
  const rate = realRate(Number(expectedReturn) / 100, Number(inflationRate) / 100);
  const months = monthsToReach({ initial: Math.max(0, Number(current) || 0), monthly: Math.max(0, Number(monthlySavings) || 0), annualRate: rate, target: Number(target) });
  return { ...eta(months, now), target: Number(target) };
}

/**
 * Date d'arrivée de l'objectif de rente de dividendes : il faut un capital = rente annuelle / rendement du dividende.
 * Renvoie aussi le capital nécessaire et la rente actuelle.
 */
export function incomeGoalEta({ current = 0, currentAnnualIncome = 0, targetMonthly, dividendYield, monthlySavings = 0, expectedReturn = 0, inflationRate = 0, now = new Date() } = {}) {
  const capital = capitalForIncome({ monthlyIncome: Number(targetMonthly), yieldRate: Number(dividendYield) / 100 });
  if (!(capital > 0)) return null;
  const currentMonthly = Math.max(0, Number(currentAnnualIncome) || 0) / 12;
  // Rente déjà atteinte avec les dividendes actuels : objectif rempli, même si le capital est inférieur.
  if (currentMonthly >= Number(targetMonthly)) {
    return { ...eta(0, now), capitalNeeded: capital, currentMonthly };
  }
  const base = wealthGoalEta({ current, target: capital, monthlySavings, expectedReturn, inflationRate, now });
  return { ...base, capitalNeeded: capital, currentMonthly };
}

/** Texte « vous y êtes dans X ans (en AAAA) ». */
export function etaLabel(r) {
  if (!r) return null;
  if (r.reached) return 'Objectif déjà atteint';
  if (r.unreachable) return 'Hors d’atteinte avec ces hypothèses (plus de 100 ans)';
  const plural = (n) => `${n} an${n > 1 ? 's' : ''}`;
  const years = Math.floor(r.months / 12);
  const rest = r.months % 12;
  let span;
  if (years === 0) span = `${rest} mois`;
  else if (years >= 10) span = plural(Math.round(r.months / 12)); // au-delà de 10 ans, l'année suffit
  else if (rest === 0) span = plural(years);
  else span = `${plural(years)} et ${rest} mois`;
  return `Vous y êtes dans ${span} (en ${r.year})`;
}

/** Changements à enregistrer dans le profil (uniquement les valeurs différentes). */
export function assumptionsPatch(saved = {}, next = {}) {
  const out = {};
  for (const key of Object.keys(DEFAULT_ASSUMPTIONS)) {
    const v = num(next?.[key]);
    if (!Number.isFinite(v)) continue;
    if (Number(saved?.[key]) !== v || saved?.[key] === null || saved?.[key] === undefined) out[key] = v;
  }
  return out;
}

// ─── Courbe de projection (Objectifs 3/3) ───────────────────────────────────

/**
 * Scénarios de rendement autour du rendement espéré choisi (en %/an) :
 * prudent = espéré − 3 (au moins 0), médian = espéré, optimiste = espéré + 2 → 3 / 6 / 8 % par défaut.
 */
export function scenarioRates(expectedReturn = DEFAULT_ASSUMPTIONS.expectedReturn) {
  const r = Number.isFinite(num(expectedReturn)) ? num(expectedReturn) : DEFAULT_ASSUMPTIONS.expectedReturn;
  return [
    { key: 'prudent', label: 'Prudent', rate: Math.max(0, r - 3) },
    { key: 'median', label: 'Médian', rate: r },
    { key: 'optimiste', label: 'Optimiste', rate: r + 2 },
  ];
}

/**
 * Durée affichée par la courbe (en années) : jusqu'à l'arrivée du scénario médian + 3 ans,
 * au moins 10 ans, au plus 50 ans ; 30 ans si l'objectif est hors d'atteinte.
 */
export function chartHorizonYears(medianMonths) {
  if (medianMonths == null || !Number.isFinite(Number(medianMonths))) return 30;
  return Math.min(50, Math.max(10, Math.ceil(Number(medianMonths) / 12) + 3));
}

/**
 * Points annuels des trois scénarios, en euros d'aujourd'hui (rendement réel) :
 * [{ year: 2026, prudent, median, optimiste }, …] (year = année civile, la première est l'année en cours).
 */
export function scenarioSeries({ current = 0, monthlySavings = 0, expectedReturn, inflationRate = 0, years = 30, now = new Date() } = {}) {
  const scenarios = scenarioRates(expectedReturn);
  const initial = Math.max(0, Number(current) || 0);
  const monthly = Math.max(0, Number(monthlySavings) || 0);
  const inf = (Number(inflationRate) || 0) / 100;
  const total = Math.max(1, Math.min(100, Math.round(Number(years) || 0)));
  const startYear = now.getFullYear();
  const points = [];
  for (let y = 0; y <= total; y += 1) {
    const point = { year: startYear + y };
    for (const s of scenarios) {
      point[s.key] = futureValue({ initial, monthly, annualRate: realRate(s.rate / 100, inf), months: y * 12 });
    }
    points.push(point);
  }
  return points;
}

/**
 * Épargne mensuelle nécessaire (euros d'aujourd'hui) pour atteindre `target` fin `targetYear`
 * avec le rendement espéré. Renvoie { months, monthly } ; monthly = 0 si le capital suffit déjà ;
 * null si l'année est passée ou invalide.
 */
export function savingsNeededBy({ current = 0, target, targetYear, expectedReturn = 0, inflationRate = 0, now = new Date() } = {}) {
  const year = Math.round(num(targetYear));
  if (!(Number(target) > 0) || !Number.isFinite(year)) return null;
  const months = monthsUntil(new Date(year, 11, 31, 12), now);
  if (!(months > 0)) return null;
  const rate = realRate(Number(expectedReturn) / 100, Number(inflationRate) / 100);
  const monthly = monthlyContributionNeeded({ initial: Math.max(0, Number(current) || 0), target: Number(target), annualRate: rate, months });
  return monthly == null ? null : { months, monthly };
}

/** Année cible proposée : celle de l'échéance du profil si elle est à venir, sinon dans 15 ans. */
export function defaultTargetYear(goalDate, now = new Date()) {
  const y = goalDate ? Number(String(goalDate).slice(0, 4)) : NaN;
  return Number.isFinite(y) && y > now.getFullYear() ? y : now.getFullYear() + 15;
}
