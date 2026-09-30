// frontend/lib/projection.js
// Calculs de projection pour la page Objectifs (fonctions pures, sans dépendance).
//
// Conventions :
// - les taux sont des décimaux annuels (0.06 = 6 %/an) ;
// - le taux mensuel est l'équivalent composé du taux annuel : (1 + r)^(1/12) − 1,
//   de sorte que 12 mois à ce taux donnent exactement le rendement annuel affiché ;
// - les versements mensuels sont faits en fin de mois (le premier ne rapporte rien le mois où il est fait) ;
// - les durées sont exprimées en mois.

const MAX_MONTHS = 100 * 12; // au-delà de 100 ans, l'objectif est considéré hors d'atteinte

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Taux mensuel équivalent à un taux annuel composé (0.06 → ≈ 0,4868 %/mois). */
export function monthlyRate(annualRate) {
  const r = num(annualRate);
  if (r <= -1) return -1;
  return Math.pow(1 + r, 1 / 12) - 1;
}

/**
 * Valeur future d'un capital de départ augmenté de versements mensuels.
 * futureValue({ initial: 10000, monthly: 200, annualRate: 0.06, months: 120 })
 */
export function futureValue({ initial = 0, monthly = 0, annualRate = 0, months = 0 } = {}) {
  const p = num(initial);
  const m = num(monthly);
  const n = Math.max(0, num(months));
  const i = monthlyRate(annualRate);
  if (i === 0) return p + m * n;
  const growth = Math.pow(1 + i, n);
  return p * growth + m * ((growth - 1) / i);
}

/**
 * Nombre de mois (entier, arrondi au mois supérieur) pour atteindre `target`.
 * 0 si déjà atteint, null si hors d'atteinte (ou au-delà de `maxMonths`).
 */
export function monthsToReach({ initial = 0, monthly = 0, annualRate = 0, target, maxMonths = MAX_MONTHS } = {}) {
  const goal = num(target, NaN);
  if (!(goal > 0)) return null;
  const p = num(initial);
  const m = num(monthly);
  if (p >= goal) return 0;
  const i = monthlyRate(annualRate);

  let months = null;
  if (i === 0) {
    if (m > 0) months = (goal - p) / m;
  } else if (i > 0) {
    // (1+i)^n = (goal·i + m) / (p·i + m)
    const denom = p * i + m;
    if (denom > 0) months = Math.log((goal * i + m) / denom) / Math.log(1 + i);
  } else {
    // Rendement négatif : simulation mois par mois (le capital peut ne jamais atteindre l'objectif).
    let value = p;
    for (let k = 1; k <= maxMonths; k += 1) {
      value = value * (1 + i) + m;
      if (value >= goal) { months = k; break; }
    }
  }
  if (months == null || !Number.isFinite(months)) return null;
  // Tolérance d'arrondi flottant : 119,9999999 mois = 120 mois, pas 121.
  const whole = Math.max(0, Math.ceil(months - 1e-9));
  return whole > maxMonths ? null : whole;
}

/**
 * Versement mensuel nécessaire pour atteindre `target` en `months` mois.
 * 0 si le capital de départ suffit déjà ; null si la durée est nulle ou négative.
 */
export function monthlyContributionNeeded({ initial = 0, target, annualRate = 0, months } = {}) {
  const goal = num(target, NaN);
  const n = num(months, NaN);
  if (!(goal > 0) || !(n > 0)) return null;
  const p = num(initial);
  const i = monthlyRate(annualRate);
  let needed;
  if (i === 0) {
    needed = (goal - p) / n;
  } else {
    const growth = Math.pow(1 + i, n);
    needed = ((goal - p * growth) * i) / (growth - 1);
  }
  return Math.max(0, needed);
}

/** Nombre de mois entiers entre maintenant et une date (« AAAA-MM-JJ » ou Date) ; null si invalide. */
export function monthsUntil(date, now = new Date()) {
  const end = date instanceof Date ? date : new Date(`${date}T12:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  return months;
}

/** Date (année, mois 1-12) atteinte après `months` mois : pour afficher « en AAAA ». */
export function dateAfterMonths(months, now = new Date()) {
  if (months == null || months === '') return null;
  const n = num(months, NaN);
  if (!Number.isFinite(n)) return null;
  const d = new Date(now.getFullYear(), now.getMonth() + Math.ceil(n), 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Capital nécessaire pour une rente de dividendes : rente annuelle / rendement du dividende.
 * capitalForIncome({ annualIncome: 24000, yieldRate: 0.04 }) → 600 000
 */
export function capitalForIncome({ annualIncome, monthlyIncome, yieldRate } = {}) {
  const income = annualIncome != null ? num(annualIncome, NaN) : num(monthlyIncome, NaN) * 12;
  const y = num(yieldRate, NaN);
  if (!(income >= 0) || !(y > 0)) return null;
  return income / y;
}

/** Rente annuelle produite par un capital à un rendement donné (inverse de capitalForIncome). */
export function incomeFromCapital(capital, yieldRate) {
  const y = num(yieldRate);
  return y > 0 ? Math.max(0, num(capital)) * y : 0;
}

/** Montant futur converti en euros d'aujourd'hui (pouvoir d'achat), avec une inflation annuelle. */
export function toTodayEuros(amount, inflationRate, months) {
  const inf = num(inflationRate);
  const n = Math.max(0, num(months));
  if (inf <= -1) return num(amount);
  return num(amount) / Math.pow(1 + inf, n / 12);
}

/** Rendement réel (hors inflation) : (1 + nominal) / (1 + inflation) − 1. */
export function realRate(nominalRate, inflationRate) {
  const inf = num(inflationRate);
  if (inf <= -1) return num(nominalRate);
  return (1 + num(nominalRate)) / (1 + inf) - 1;
}

/**
 * Points annuels de projection pour une courbe : [{ year: 0, value }, { year: 1, value }, …].
 */
export function projectionSeries({ initial = 0, monthly = 0, annualRate = 0, years = 30 } = {}) {
  const total = Math.max(0, Math.min(100, Math.round(num(years))));
  const points = [];
  for (let y = 0; y <= total; y += 1) {
    points.push({ year: y, value: futureValue({ initial, monthly, annualRate, months: y * 12 }) });
  }
  return points;
}
