// frontend/lib/strategyReview.js
// Page Stratégie (2/3) : écarts entre le portefeuille réel et la stratégie choisie, et propositions
// d'action chiffrées (fonctions pures, testées dans tests/strategyReview.test.mjs).
//
// Principes :
//   - l'allocation cible porte sur le montant investi (hors cash) ; la part de cash est calculée à part,
//     sur le patrimoine total (investi + cash) ;
//   - les propositions parlent de zones et de lignes déjà détenues, jamais d'un titre précis à acheter
//     (indicateur pédagogique, pas un conseil en investissement).

import { ALLOCATION_BUCKETS, normalizeAllocation, strategyDefaults, isStrategy, DEFAULT_STRATEGY } from './strategy.js';

// Seuils (en points de % ou en %)
export const THRESHOLDS = Object.freeze({
  zoneGap: 5, // écart signalé entre part réelle et cible d'une poche
  rebalance: 10, // part du portefeuille à déplacer au-delà de laquelle un rééquilibrage est proposé
  cashHigh: 20, // part de cash dans le patrimoine jugée élevée
  lowYield: 2, // stratégie dividendes : rendement d'une action jugé faible
  highYield: 4, // stratégie croissance : rendement d'une action jugé élevé
  highYieldShare: 25, // stratégie croissance : part des lignes à fort dividende jugée élevée
  nonEtfShare: 10, // stratégie passive : part hors ETF jugée élevée
  defaultYieldTarget: 3.5, // stratégie dividendes : rendement visé si le profil n'en a pas
});

const round2 = (n) => Math.round(n * 100) / 100;
const pct = (part, total) => (total > 0 ? (part / total) * 100 : 0);
const labelOf = (key) => ALLOCATION_BUCKETS.find((b) => b.key === key)?.label || key;

// Zone renvoyée par le backend (services/zones.js) → poche de l'allocation cible
const BUCKET_OF_ZONE = {
  Europe: 'europe',
  'Amérique du Nord': 'northAmerica',
  Asie: 'asiaPacific',
  Océanie: 'asiaPacific',
  'Amérique latine': 'emerging',
  Afrique: 'emerging',
  Émergents: 'emerging',
  Monde: 'world',
  'Matières premières': 'commodities',
};

// Secours si le backend n'a pas renvoyé la zone (même table que services/zones.js)
const ZONE_OF_COUNTRY = {
  ...Object.fromEntries(
    ['FR', 'DE', 'GB', 'NL', 'BE', 'LU', 'IE', 'CH', 'IT', 'ES', 'PT', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'GR', 'JE', 'CY'].map((c) => [c, 'Europe'])
  ),
  ...Object.fromEntries(['US', 'CA', 'BM', 'KY'].map((c) => [c, 'Amérique du Nord'])),
  ...Object.fromEntries(['MX', 'BR', 'AR', 'UY'].map((c) => [c, 'Amérique latine'])),
  ...Object.fromEntries(['JP', 'CN', 'HK', 'TW', 'KR', 'IN', 'SG', 'IL'].map((c) => [c, 'Asie'])),
  AU: 'Océanie',
  NZ: 'Océanie',
  ZA: 'Afrique',
};

const typeOf = (s) => String(s?.type || '').toUpperCase();
export const isCryptoPosition = (s) => /CRYPTO/.test(typeOf(s));
export const isFundPosition = (s) => ['ETF', 'FUND', 'MUTUALFUND'].includes(typeOf(s));

/** Poche d'une position (clé de ALLOCATION_BUCKETS), ou null si la zone est inconnue */
export function bucketOf(s) {
  if (isCryptoPosition(s)) return 'crypto';
  const zone = s?.zone || ZONE_OF_COUNTRY[String(s?.countryCode || '').toUpperCase()];
  return BUCKET_OF_ZONE[zone] || null;
}

/** Rendement du dividende au cours actuel, en % (0 si inconnu) */
export function positionYield(s) {
  const d = Number(s?.dividend);
  const c = Number(s?.close);
  if (d > 0 && c > 0) return (d / c) * 100;
  const y = Number(s?.dividendYield);
  return Number.isFinite(y) && y > 0 ? y : 0;
}

/**
 * Positions valorisées dans la devise de référence : [{ ticker, name, value, bucket, fund, crypto, yieldPct }]
 * toBase(montant, devise) → montant converti (null si taux inconnu : la position est ignorée).
 */
export function valuedPositions(stocks, toBase) {
  const out = [];
  for (const s of stocks || []) {
    const raw = (Number(s.close) || 0) * (Number(s.quantity) || 0);
    const value = raw > 0 ? toBase(raw, s.currency) : 0;
    if (!(value > 0)) continue;
    out.push({
      ticker: s.ticker,
      name: s.name || s.ticker,
      value,
      bucket: bucketOf(s),
      fund: isFundPosition(s),
      crypto: isCryptoPosition(s),
      yieldPct: positionYield(s),
    });
  }
  return out;
}

/**
 * Écarts par poche : part réelle (sur le montant investi) vs cible.
 * @returns { invested, cash, total, cashShare, unclassified, buckets: [{ key, label, target, actual, value, gapPct, gapValue }] }
 *   gapPct = réel − cible (en points), gapValue = valeur réelle − valeur cible (en €, > 0 si surpondérée)
 */
export function allocationGaps(positions, allocation, cash = 0) {
  const target = normalizeAllocation(allocation);
  const invested = (positions || []).reduce((a, p) => a + p.value, 0);
  const cashValue = Math.max(0, Number(cash) || 0);
  const total = invested + cashValue;
  const byBucket = {};
  let unclassified = 0;
  for (const p of positions || []) {
    if (p.bucket) byBucket[p.bucket] = (byBucket[p.bucket] || 0) + p.value;
    else unclassified += p.value;
  }
  const buckets = ALLOCATION_BUCKETS.map(({ key, label }) => {
    const value = byBucket[key] || 0;
    const actual = pct(value, invested);
    return {
      key,
      label,
      target: target[key],
      actual: round2(actual),
      value: round2(value),
      gapPct: round2(actual - target[key]),
      gapValue: round2(value - (target[key] / 100) * invested),
    };
  });
  return {
    invested: round2(invested),
    cash: round2(cashValue),
    total: round2(total),
    cashShare: round2(pct(cashValue, total)),
    unclassified: round2(unclassified),
    unclassifiedShare: round2(pct(unclassified, invested)),
    buckets,
  };
}

/** Lignes dont le poids (sur le montant investi) dépasse la limite : [{ ticker, name, weight, excessValue }] */
export function positionsOverLimit(positions, maxWeight) {
  const limit = Number(maxWeight);
  const invested = (positions || []).reduce((a, p) => a + p.value, 0);
  if (!(invested > 0) || !(limit > 0) || limit >= 100) return [];
  return positions
    .map((p) => ({ ticker: p.ticker, name: p.name, weight: pct(p.value, invested), value: p.value }))
    .filter((p) => p.weight > limit + 1e-9)
    .sort((a, b) => b.weight - a.weight)
    .map((p) => ({ ticker: p.ticker, name: p.name, weight: round2(p.weight), excessValue: round2(p.value - (limit / 100) * invested) }));
}

/** Montant à déplacer pour revenir exactement à la cible (somme des surpondérations, en €) */
export function rebalanceAmount(gaps) {
  return round2((gaps?.buckets || []).reduce((a, b) => a + Math.max(0, b.gapValue), 0));
}

/**
 * Répartition d'un prochain versement entre les poches sous-pondérées, sans rien vendre :
 * on vise la cible sur le nouveau total ; si le versement ne suffit pas, il est réparti au prorata des manques.
 * @returns [{ key, label, amount }] (montants > 0, arrondis à l'euro, total = versement)
 */
export function contributionPlan(gaps, amount) {
  const a = Number(amount);
  if (!(a > 0) || !gaps) return [];
  const newTotal = gaps.invested + a;
  const needs = gaps.buckets
    .map((b) => ({ key: b.key, label: b.label, need: Math.max(0, (b.target / 100) * newTotal - b.value) }))
    .filter((b) => b.need > 0);
  const totalNeed = needs.reduce((s, b) => s + b.need, 0);
  if (!(totalNeed > 0)) return [];
  const factor = Math.min(1, a / totalNeed);
  // Arrondi à l'euro ; l'écart d'arrondi va à la poche la plus en manque
  const rows = needs.map((b) => ({ key: b.key, label: b.label, amount: Math.round(b.need * factor) })).sort((x, y) => y.amount - x.amount);
  const planned = Math.round(Math.min(a, totalNeed));
  const diff = planned - rows.reduce((s, r) => s + r.amount, 0);
  if (rows.length) rows[0].amount += diff;
  return rows.filter((r) => r.amount > 0);
}

const money = (n) => `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} €`;
const fmtPct = (n) => `${round2(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const plural = (n, one, many) => (n > 1 ? many : one);

/** Règles propres au style : [{ id, severity, title, detail, tickers? }] */
export function styleRules(strategy, positions, { yieldTarget } = {}) {
  const out = [];
  const list = positions || [];
  const invested = list.reduce((a, p) => a + p.value, 0);
  if (!(invested > 0)) return out;

  if (strategy === 'dividendes') {
    const target = Number(yieldTarget) > 0 ? Number(yieldTarget) : THRESHOLDS.defaultYieldTarget;
    const avg = list.reduce((a, p) => a + p.value * p.yieldPct, 0) / invested;
    if (avg < target - 0.25) {
      out.push({
        id: 'yield-below-target',
        severity: 2,
        title: 'Rendement moyen sous votre objectif',
        detail: `Rendement moyen du portefeuille : ${fmtPct(avg)}, pour un objectif de ${fmtPct(target)}.`,
        value: round2(avg),
      });
    }
    const low = list.filter((p) => !p.fund && !p.crypto && p.yieldPct < THRESHOLDS.lowYield).sort((a, b) => b.value - a.value);
    if (low.length) {
      const share = pct(
        low.reduce((a, p) => a + p.value, 0),
        invested
      );
      out.push({
        id: 'low-yield-lines',
        severity: share >= 20 ? 2 : 1,
        title: `${low.length} ${plural(low.length, 'action à rendement faible', 'actions à rendement faible')}`,
        detail: `${fmtPct(share)} du portefeuille rapporte moins de ${THRESHOLDS.lowYield} % de dividende par an : cohérent avec votre stratégie ?`,
        tickers: low.map((p) => p.ticker),
      });
    }
  }

  if (strategy === 'passive') {
    const nonEtf = list.filter((p) => !p.fund);
    const share = pct(
      nonEtf.reduce((a, p) => a + p.value, 0),
      invested
    );
    if (share > THRESHOLDS.nonEtfShare) {
      out.push({
        id: 'non-etf-share',
        severity: share >= 25 ? 3 : 2,
        title: 'Part hors ETF élevée pour une gestion passive',
        detail: `${fmtPct(share)} du portefeuille est en titres vifs ou crypto-actifs (repère : ${THRESHOLDS.nonEtfShare} % au plus).`,
        tickers: nonEtf.sort((a, b) => b.value - a.value).map((p) => p.ticker),
        value: round2(share),
      });
    }
  }

  if (strategy === 'croissance') {
    const high = list.filter((p) => !p.fund && p.yieldPct >= THRESHOLDS.highYield);
    const share = pct(
      high.reduce((a, p) => a + p.value, 0),
      invested
    );
    if (share > THRESHOLDS.highYieldShare) {
      out.push({
        id: 'high-dividend-share',
        severity: 2,
        title: 'Beaucoup de lignes à fort dividende',
        detail: `${fmtPct(share)} du portefeuille est en actions qui distribuent ${THRESHOLDS.highYield} % ou plus : une stratégie de croissance privilégie plutôt le réinvestissement des bénéfices.`,
        tickers: high.sort((a, b) => b.value - a.value).map((p) => p.ticker),
        value: round2(share),
      });
    }
  }

  return out;
}

/**
 * Bilan complet de la stratégie : écarts et propositions triées par importance (severity 3 → 1).
 * - profile : strategy, targetAllocation, maxPositionWeight, monthlySavings, dividendYield
 * - stocks : positions de /api/user/portfolio ; cashInBase : cash dans la devise de référence
 * - toBase(montant, devise) : conversion dans la devise de référence
 * @returns { strategy, gaps, overLimit, rebalance, plan, contribution, proposals } ou null si rien d'investi
 */
export function strategyReview({ profile = {}, stocks = [], cashInBase = 0, toBase = (v) => v } = {}) {
  const p = profile || {};
  const strategy = isStrategy(p.strategy) ? p.strategy : DEFAULT_STRATEGY;
  const d = strategyDefaults(strategy);
  const allocation = p.targetAllocation && typeof p.targetAllocation === 'object' ? p.targetAllocation : d.allocation;
  const maxWeight = Number(p.maxPositionWeight) > 0 ? Number(p.maxPositionWeight) : d.maxPositionWeight;

  const positions = valuedPositions(stocks, toBase);
  if (!positions.length) return null;
  const gaps = allocationGaps(positions, allocation, cashInBase);
  const overLimit = positionsOverLimit(positions, maxWeight);
  const rebalance = rebalanceAmount(gaps);
  const contribution = Number(p.monthlySavings) > 0 ? Number(p.monthlySavings) : 0;
  const plan = contributionPlan(gaps, contribution);

  const proposals = [];
  const under = gaps.buckets.filter((b) => b.gapPct <= -THRESHOLDS.zoneGap).sort((a, b) => a.gapPct - b.gapPct);
  const over = gaps.buckets.filter((b) => b.gapPct >= THRESHOLDS.zoneGap).sort((a, b) => b.gapPct - a.gapPct);

  if (under.length) {
    const worst = Math.min(...under.map((b) => b.gapPct));
    const planText = plan.length
      ? ` Prochain versement de ${money(contribution)} : ${plan.map((r) => `${money(r.amount)} vers ${r.label}`).join(', ')}.`
      : '';
    proposals.push({
      id: 'underweight-zones',
      severity: worst <= -15 ? 3 : 2,
      title: `Orienter vos prochains versements vers ${under.map((b) => b.label).join(', ')}`,
      detail: `${under.map((b) => `${b.label} : ${fmtPct(b.actual)} pour ${fmtPct(b.target)} visés (${money(-b.gapValue)} de moins)`).join(' ; ')}.${planText}`,
      buckets: under.map((b) => b.key),
      amount: round2(under.reduce((a, b) => a - b.gapValue, 0)),
    });
  }
  if (over.length) {
    proposals.push({
      id: 'overweight-zones',
      severity: Math.max(...over.map((b) => b.gapPct)) >= 15 ? 2 : 1,
      title: `${plural(over.length, 'Poche surpondérée', 'Poches surpondérées')} : ${over.map((b) => b.label).join(', ')}`,
      detail: `${over.map((b) => `${b.label} : ${fmtPct(b.actual)} pour ${fmtPct(b.target)} visés (${money(b.gapValue)} de plus)`).join(' ; ')}. Éviter d'y renforcer tant que l'écart persiste.`,
      buckets: over.map((b) => b.key),
      amount: round2(over.reduce((a, b) => a + b.gapValue, 0)),
    });
  }
  if (overLimit.length) {
    proposals.push({
      id: 'lines-over-limit',
      severity: overLimit[0].weight >= maxWeight * 1.5 ? 3 : 2,
      title: `${overLimit.length} ${plural(overLimit.length, 'ligne dépasse', 'lignes dépassent')} votre limite de ${fmtPct(maxWeight)}`,
      detail: overLimit.map((l) => `${l.ticker} : ${fmtPct(l.weight)} (${money(l.excessValue)} au-dessus)`).join(' ; ') + '.',
      tickers: overLimit.map((l) => l.ticker),
      amount: round2(overLimit.reduce((a, l) => a + l.excessValue, 0)),
    });
  }
  if (gaps.invested > 0 && pct(rebalance, gaps.invested) >= THRESHOLDS.rebalance) {
    proposals.push({
      id: 'rebalance',
      severity: 2,
      title: `Rééquilibrage : ${money(rebalance)} à déplacer`,
      detail: `Pour revenir exactement à votre allocation cible, il faudrait déplacer ${fmtPct(pct(rebalance, gaps.invested))} du portefeuille. Les versements seuls peuvent suffire sur quelques mois, sans vendre.`,
      amount: rebalance,
    });
  }
  if (gaps.unclassifiedShare >= THRESHOLDS.zoneGap) {
    proposals.push({
      id: 'unclassified',
      severity: 1,
      title: 'Zone inconnue pour une partie du portefeuille',
      detail: `${fmtPct(gaps.unclassifiedShare)} du portefeuille n'a pas de zone reconnue : les écarts ci-dessus sont approximatifs.`,
      amount: gaps.unclassified,
    });
  }
  if (gaps.cashShare >= THRESHOLDS.cashHigh) {
    proposals.push({
      id: 'cash-high',
      severity: 1,
      title: `Part de cash élevée (${fmtPct(gaps.cashShare)})`,
      detail: `${money(gaps.cash)} en liquidités. Au-delà de votre fonds de précaution, ce montant peut servir à renforcer les poches sous-pondérées.`,
      amount: gaps.cash,
    });
  }
  proposals.push(...styleRules(strategy, positions, { yieldTarget: p.dividendYield }));

  // Tri : importance décroissante, puis montant décroissant
  proposals.sort((a, b) => b.severity - a.severity || (Number(b.amount) || 0) - (Number(a.amount) || 0));
  return { strategy, maxPositionWeight: maxWeight, gaps, overLimit, rebalance, contribution, plan, proposals };
}

// Niveaux d'importance des propositions (Stratégie 3/3) : libellé et ton du badge (docs/DESIGN.md)
export const SEVERITY_LEVELS = Object.freeze({
  3: { label: 'Prioritaire', tone: 'loss' },
  2: { label: 'À surveiller', tone: 'warn' },
  1: { label: 'Pour info', tone: 'neutral' },
});

/** Libellé et ton d'un niveau d'importance (1 par défaut) */
export function severityLevel(severity) {
  return SEVERITY_LEVELS[Math.min(3, Math.max(1, Math.round(Number(severity) || 1)))];
}

/**
 * Résumé pour le Tableau de bord : les `max` premières propositions (déjà triées) et le décompte par niveau.
 * @returns { total, counts: { 3, 2, 1 }, top: [{ id, severity, title }] }
 */
export function proposalsBrief(review, max = 3) {
  const list = review?.proposals || [];
  const counts = { 3: 0, 2: 0, 1: 0 };
  for (const p of list) counts[Math.min(3, Math.max(1, Math.round(Number(p.severity) || 1)))] += 1;
  return {
    total: list.length,
    counts,
    top: list.slice(0, Math.max(0, max)).map(({ id, severity, title }) => ({ id, severity, title })),
  };
}

/** Échelle commune des jauges cible vs réel : maximum arrondi à 10 au-dessus (au moins 50 %) */
export function gaugeScale(buckets) {
  const m = Math.max(0, ...(buckets || []).flatMap((b) => [Number(b.target) || 0, Number(b.actual) || 0]));
  return Math.min(100, Math.max(50, Math.ceil(m / 10) * 10));
}
