// frontend/lib/strategy.js
// Page Stratégie : styles d'investissement, allocation cible proposée par style et limite de poids
// par ligne (fonctions pures, testées dans tests/strategy.test.mjs).
//
// Les poches de l'allocation reprennent les clés validées par le backend (services/profile.js,
// ALLOCATION_KEYS) ; le total d'une allocation valide vaut 100 % (à 0,5 point près).

export const STRATEGIES = Object.freeze([
  {
    key: 'dividendes',
    label: 'Dividendes',
    description: 'Des entreprises solides qui versent un revenu régulier, plutôt européennes et nord-américaines.',
  },
  {
    key: 'croissance',
    label: 'Croissance',
    description: 'Des entreprises qui réinvestissent leurs bénéfices, plus exposées aux États-Unis et à la tech.',
  },
  {
    key: 'passive',
    label: 'Indicielle passive',
    description: 'Quelques ETF larges (Monde, émergents) conservés dans la durée, sans choisir de titres.',
  },
  {
    key: 'equilibree',
    label: 'Équilibrée',
    description: 'Un mélange de revenus et de croissance, réparti entre les grandes zones, avec une poche d’or.',
  },
]);

export const ALLOCATION_BUCKETS = Object.freeze([
  { key: 'europe', label: 'Europe' },
  { key: 'northAmerica', label: 'Amérique du Nord' },
  { key: 'asiaPacific', label: 'Asie-Pacifique' },
  { key: 'emerging', label: 'Pays émergents', hint: 'Amérique latine et Afrique comprises' },
  { key: 'world', label: 'ETF Monde', hint: 'MSCI World, ACWI, All-World' },
  { key: 'commodities', label: 'Or et matières premières' },
  { key: 'crypto', label: 'Crypto-actifs' },
]);

const alloc = (v) => Object.freeze({ europe: 0, northAmerica: 0, asiaPacific: 0, emerging: 0, world: 0, commodities: 0, crypto: 0, ...v });

/** Valeurs proposées par style (modifiables par l'utilisateur) */
export const STRATEGY_DEFAULTS = Object.freeze({
  dividendes: { allocation: alloc({ europe: 45, northAmerica: 35, asiaPacific: 10, emerging: 5, commodities: 5 }), maxPositionWeight: 8 },
  croissance: { allocation: alloc({ europe: 20, northAmerica: 55, asiaPacific: 10, emerging: 10, crypto: 5 }), maxPositionWeight: 10 },
  passive: { allocation: alloc({ world: 85, emerging: 15 }), maxPositionWeight: 90 },
  equilibree: { allocation: alloc({ europe: 35, northAmerica: 35, asiaPacific: 10, emerging: 10, commodities: 10 }), maxPositionWeight: 10 },
});

export const DEFAULT_STRATEGY = 'equilibree';

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
const round2 = (n) => Math.round(n * 100) / 100;

export const isStrategy = (key) => STRATEGIES.some((s) => s.key === key);
export const strategyLabel = (key) => STRATEGIES.find((s) => s.key === key)?.label || '';

/** Valeurs proposées pour un style (copie modifiable) */
export function strategyDefaults(key) {
  const d = STRATEGY_DEFAULTS[isStrategy(key) ? key : DEFAULT_STRATEGY];
  return { allocation: { ...d.allocation }, maxPositionWeight: d.maxPositionWeight };
}

/** Allocation complète (toutes les poches, nombres finis ≥ 0) */
export function normalizeAllocation(a) {
  const out = {};
  for (const { key } of ALLOCATION_BUCKETS) {
    const v = num(a?.[key]);
    out[key] = Number.isFinite(v) && v > 0 ? round2(v) : 0;
  }
  return out;
}

/** Total d'une allocation, en % */
export function allocationTotal(a) {
  return round2(Object.values(normalizeAllocation(a)).reduce((s, v) => s + v, 0));
}

/** Allocation acceptée par le backend : chaque poche de 0 à 100 %, total de 100 % à 0,5 point près */
export function isValidAllocation(a) {
  if (!a || typeof a !== 'object') return false;
  for (const { key } of ALLOCATION_BUCKETS) {
    const raw = a[key];
    if (raw === '' || raw === null || raw === undefined) continue;
    const v = num(raw);
    if (!Number.isFinite(v) || v < 0 || v > 100) return false;
  }
  return Math.abs(allocationTotal(a) - 100) <= 0.5;
}

export const isValidMaxWeight = (v) => Number.isFinite(num(v)) && num(v) >= 1 && num(v) <= 100;

/**
 * Formulaire initial : valeurs enregistrées dans le profil, sinon valeurs proposées pour le style
 * choisi (ou le style équilibré si aucun n'est enregistré). `saved` indique si un style est enregistré.
 */
export function initialStrategy(profile = {}) {
  const p = profile || {};
  const strategy = isStrategy(p.strategy) ? p.strategy : DEFAULT_STRATEGY;
  const d = strategyDefaults(strategy);
  return {
    strategy,
    allocation: p.targetAllocation && typeof p.targetAllocation === 'object' ? normalizeAllocation(p.targetAllocation) : d.allocation,
    maxPositionWeight: isValidMaxWeight(p.maxPositionWeight) ? num(p.maxPositionWeight) : d.maxPositionWeight,
    saved: isStrategy(p.strategy),
  };
}

/** Les valeurs du formulaire sont-elles exactement celles proposées pour le style ? */
export function isDefaultForStrategy(form) {
  const d = strategyDefaults(form?.strategy);
  const a = normalizeAllocation(form?.allocation);
  return num(form?.maxPositionWeight) === d.maxPositionWeight && ALLOCATION_BUCKETS.every(({ key }) => a[key] === d.allocation[key]);
}

/**
 * Champs à envoyer au PATCH /api/user/profile : ceux qui diffèrent du profil enregistré
 * (ou jamais enregistrés). Renvoie null si le formulaire n'est pas valide.
 */
export function strategyPatch(saved = {}, form = {}) {
  if (!isStrategy(form.strategy) || !isValidAllocation(form.allocation) || !isValidMaxWeight(form.maxPositionWeight)) return null;
  const s = saved || {};
  const out = {};
  if (s.strategy !== form.strategy) out.strategy = form.strategy;
  const next = normalizeAllocation(form.allocation);
  const prev = s.targetAllocation && typeof s.targetAllocation === 'object' ? normalizeAllocation(s.targetAllocation) : null;
  if (!prev || ALLOCATION_BUCKETS.some(({ key }) => prev[key] !== next[key])) out.targetAllocation = next;
  const w = round2(num(form.maxPositionWeight));
  if (num(s.maxPositionWeight) !== w) out.maxPositionWeight = w;
  return out;
}
