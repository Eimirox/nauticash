// frontend/lib/diversification.js
// Score de diversification simplifié (0 à 100) à partir des positions (hors cash) :
//   - lignes (40 pts)   : nombre « effectif » de lignes (inverse de la somme des poids au carré),
//                         un ETF comptant pour 10 lignes (il contient lui-même de nombreux titres) ;
//   - secteurs (20 pts), pays (20 pts), devises de cotation (20 pts) : même principe
//     (secteurs et pays d'un ETF répartis sur plusieurs valeurs fictives).
// Indicateur pédagogique, pas un conseil en investissement.

const ETF_LINES = 10;
const ETF_SECTORS = 5;
const ETF_COUNTRIES = 4;

const isEtf = (s) => String(s.type || "").toUpperCase() === "ETF";
const isCrypto = (s) => /CRYPTO/i.test(String(s.type || ""));

/** Nombre effectif d'éléments : 1 / Σ poids² (poids normalisés) */
function effectiveCount(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return 0;
  const hhi = weights.reduce((a, w) => a + (w / total) ** 2, 0);
  return hhi > 0 ? 1 / hhi : 0;
}

/** Part (0 → 1) de chaque clé, triée de la plus lourde à la plus légère */
function shares(map) {
  const total = Object.values(map).reduce((a, b) => a + b, 0);
  return Object.entries(map)
    .map(([key, v]) => ({ key, share: total > 0 ? v / total : 0 }))
    .sort((a, b) => b.share - a.share);
}

const scale = (n, full) => Math.max(0, Math.min(1, (n - 1) / (full - 1)));

/**
 * positions : [{ ticker, value, sector, country, currency, type, composition? }] (value dans une même devise)
 * Renvoie null s'il n'y a aucune position valorisée.
 */
export function diversification(positions) {
  const items = (positions || []).filter((p) => Number(p.value) > 0);
  if (!items.length) return null;
  const total = items.reduce((a, p) => a + Number(p.value), 0);

  // Lignes
  const lineWeights = items.flatMap((p) => (isEtf(p) ? Array(ETF_LINES).fill(p.value / ETF_LINES) : [p.value]));
  const nLines = effectiveCount(lineWeights);
  const byLine = items.map((p) => ({ key: p.ticker, share: p.value / total })).sort((a, b) => b.share - a.share);
  const top5 = byLine.slice(0, 5).reduce((a, x) => a + x.share, 0);

  // Secteurs (composition des ETF si connue, sinon répartie sur plusieurs secteurs)
  const sectors = {};
  for (const p of items) {
    if (p.composition && typeof p.composition === "object") {
      for (const [sect, pct] of Object.entries(p.composition)) sectors[sect] = (sectors[sect] || 0) + (p.value * pct) / 100;
    } else if (isEtf(p)) {
      for (let i = 0; i < ETF_SECTORS; i++) sectors[`__etf_${p.ticker}_${i}`] = p.value / ETF_SECTORS;
    } else {
      const key = isCrypto(p) ? "Crypto" : p.sector || "Non renseigné";
      sectors[key] = (sectors[key] || 0) + p.value;
    }
  }
  const nSectors = effectiveCount(Object.values(sectors));
  const sectorShares = shares(sectors).filter((s) => !s.key.startsWith("__etf_"));

  // Pays et devises
  const countries = {};
  const currencies = {};
  for (const p of items) {
    if (isEtf(p)) {
      // Le pays d'un ETF est celui de sa cotation, pas celui des entreprises qu'il contient
      for (let i = 0; i < ETF_COUNTRIES; i++) countries[`__etf_${p.ticker}_${i}`] = p.value / ETF_COUNTRIES;
    } else {
      const c = isCrypto(p) ? "Crypto" : p.country || "Non renseigné";
      countries[c] = (countries[c] || 0) + p.value;
    }
    const cur = p.currency || "EUR";
    currencies[cur] = (currencies[cur] || 0) + p.value;
  }
  const nCountries = effectiveCount(Object.values(countries));
  const nCurrencies = effectiveCount(Object.values(currencies));
  const countryShares = shares(countries).filter((c) => !c.key.startsWith("__etf_"));
  const currencyShares = shares(currencies);

  const parts = [
    { key: "lines", label: "Lignes", points: 40 * scale(nLines, 15), max: 40 },
    { key: "sectors", label: "Secteurs", points: 20 * scale(nSectors, 6), max: 20 },
    { key: "countries", label: "Pays", points: 20 * scale(nCountries, 4), max: 20 },
    { key: "currencies", label: "Devises de cotation", points: 20 * scale(nCurrencies, 3), max: 20 },
  ];
  const score = Math.round(parts.reduce((a, p) => a + p.points, 0));
  const level = score >= 70 ? "Bien diversifié" : score >= 40 ? "Équilibré" : "Concentré";

  // Conseils sobres, du plus important au moins important (3 au maximum)
  const pct = (x) => `${Math.round(x * 100)} %`;
  const tips = [];
  const first = byLine[0];
  if (first && first.share > 0.2 && items.length > 1 && !isEtf(items.find((p) => p.ticker === first.key)))
    tips.push(`${first.key} représente ${pct(first.share)} de vos positions : une forte baisse de ce titre pèserait lourd.`);
  if (items.length === 1 && !isEtf(items[0])) tips.push("Une seule ligne en portefeuille : tout dépend d'un seul titre.");
  if (items.length > 5 && top5 > 0.7) tips.push(`Vos 5 premières lignes pèsent ${pct(top5)} du portefeuille.`);
  if (sectorShares[0] && sectorShares[0].share > 0.4 && sectorShares[0].key !== "Non renseigné")
    tips.push(`Le secteur « ${sectorShares[0].key} » pèse ${pct(sectorShares[0].share)} : pensez à l'équilibre entre secteurs.`);
  if (countryShares[0] && countryShares[0].share > 0.7 && countryShares[0].key !== "Non renseigné")
    tips.push(`${pct(countryShares[0].share)} de vos positions sont exposées à un seul pays (${countryShares[0].key}).`);
  if (currencyShares.length === 1)
    tips.push(`Toutes vos positions sont cotées en ${currencyShares[0].key} : aucun risque de change, mais aucune diversification monétaire non plus.`);
  if (!tips.length) tips.push("Aucun déséquilibre marqué : votre répartition est cohérente.");

  return {
    score,
    level,
    parts,
    stats: { lines: items.length, effectiveLines: nLines, top5, topLine: first },
    tips: tips.slice(0, 3),
  };
}
