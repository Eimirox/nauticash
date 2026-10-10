// frontend/lib/chartPalette.js
// Palette centralisée des graphiques (camemberts de la Répartition et du Tableau de bord).
// Les couleurs vivent dans app/globals.css (--chart-1 à --chart-11, une version claire et une sombre,
// toutes à 3:1 minimum contre la carte, voir docs/DESIGN.md) ; ce fichier ne manipule que des références.
//
// Règles :
//  - un type d'actif a TOUJOURS la même couleur, sur tous les écrans ;
//  - dans un même graphique, deux parts n'ont jamais la même couleur ;
//  - au-delà des 11 couleurs de la palette, des teintes sont générées (jamais de répétition).

// Ordre des emplacements : teintes bien espacées, les plus distinctes en premier.
export const CHART_SLOTS = [
  "blue", // 1
  "emerald", // 2
  "amber", // 3
  "violet", // 4
  "cyan", // 5
  "rose", // 6
  "lime", // 7
  "orange", // 8
  "indigo", // 9
  "fuchsia", // 10
  "slate", // 11 (neutre : « Autres », « Non renseigné »)
];

const slotRef = (index) => `rgb(var(--chart-${index + 1}))`;
const slotIndex = (name) => CHART_SLOTS.indexOf(name);

/** Couleur d'un emplacement de la palette (référence CSS qui suit le mode clair / sombre) */
export function slotColor(name) {
  return slotRef(slotIndex(name));
}

// Types d'actif : couleur fixe par type (cohérente sur tous les écrans)
export const TYPE_SLOT = {
  Actions: "blue",
  "ETF et fonds": "emerald",
  Crypto: "amber",
  Obligations: "violet",
  Cash: "cyan",
  Autres: "slate",
};
// Dette (cash négatif) : seule catégorie qui prend le rouge de perte
export const DEBT_COLOR = "rgb(var(--loss))";

/** Couleur d'un type d'actif (libellés de lib/wealth.js : Actions, ETF et fonds, Crypto, Cash, Autres) */
export function typeColor(label) {
  if (label === "Dette") return DEBT_COLOR;
  return slotColor(TYPE_SLOT[label] || TYPE_SLOT.Autres);
}

// Devises courantes : couleur fixe, les autres sont attribuées sans doublon
export const CURRENCY_SLOT = { EUR: "blue", USD: "emerald", GBP: "amber", CHF: "rose", JPY: "violet", CAD: "cyan" };

// Secteurs : un secteur connu garde son emplacement ; les variantes de nom sont fusionnées
const SECTOR_ALIASES = {
  "Information Technology": "Technology",
  Financial: "Financial Services",
  Financials: "Financial Services",
  "Health Care": "Healthcare",
  "Consumer Discretionary": "Consumer Cyclical",
  "Consumer Staples": "Consumer Defensive",
  Industrial: "Industrials",
  Materials: "Basic Materials",
  "Oil & Gas": "Energy",
  Cryptocurrency: "Crypto",
  Other: "Non renseigné",
  Unknown: "Non renseigné",
};
export const SECTOR_SLOT = {
  Technology: "blue",
  "Financial Services": "indigo",
  Healthcare: "emerald",
  "Consumer Cyclical": "orange",
  "Consumer Defensive": "lime",
  Energy: "amber",
  Industrials: "slate",
  "Basic Materials": "fuchsia",
  Utilities: "cyan",
  "Real Estate": "rose",
  "Communication Services": "violet",
};

/** Nom canonique d'un secteur (« Financials » et « Financial Services » deviennent une seule part) */
export function canonicalSector(label) {
  return SECTOR_ALIASES[label] || label;
}

/**
 * Fusionne les lignes [label, value] dont le nom canonique est identique (somme des montants).
 * Évite deux parts quasi identiques (et de même couleur) dans un camembert de secteurs.
 */
export function mergeSectorRows(rows) {
  const acc = new Map();
  for (const [label, value] of rows) {
    const key = canonicalSector(label);
    acc.set(key, (acc.get(key) || 0) + Number(value || 0));
  }
  return [...acc.entries()];
}

// Couleurs générées au-delà de la palette : teintes réparties par angle d'or, claires/foncées alternées
// pour rester lisibles ; la même référence CSS suit le thème grâce à --chart-extra-l.
function generatedColor(n) {
  const hue = Math.round((n * 137.508 + 20) % 360);
  const sat = 62 + (n % 2) * 8;
  return `hsl(${hue} ${sat}% var(--chart-extra-l, 45%))`;
}

/**
 * Attribue une couleur à chaque libellé, sans doublon dans le jeu.
 * @param {string[]} labels libellés du graphique, dans l'ordre d'affichage
 * @param {{ fixed?: Record<string,string>, neutral?: string[] }} options
 *   fixed : libellé → nom d'emplacement imposé (type, devise, secteur connu)
 *   neutral : libellés forcés sur le gris neutre (« Autres », « Non renseigné »)
 *   explicit : libellé → couleur CSS imposée (ex. « Dette » en rouge de perte)
 * @returns {Record<string,string>} libellé → couleur CSS
 */
export function assignColors(labels, { fixed = {}, neutral = ["Autres", "Non renseigné"], explicit = {} } = {}) {
  const result = {};
  const used = new Set();

  // 1) neutres puis couleurs imposées (si l'emplacement est déjà pris, le libellé passera en 3)
  const pending = [];
  for (const label of labels) {
    if (result[label]) continue;
    if (explicit[label]) {
      result[label] = explicit[label];
      continue;
    }
    const slot = neutral.includes(label) ? "slate" : fixed[label];
    if (slot && !used.has(slot)) {
      result[label] = slotColor(slot);
      used.add(slot);
    } else {
      pending.push(label);
    }
  }

  // 2) emplacements libres dans l'ordre de la palette (slate réservé aux neutres)
  const free = CHART_SLOTS.filter((s) => s !== "slate" && !used.has(s));
  let extra = 0;
  for (const label of pending) {
    if (result[label]) continue;
    result[label] = free.length ? slotColor(free.shift()) : generatedColor(extra++);
  }
  return result;
}

/** Couleurs d'un graphique de secteurs, devises ou pays : { libellé: couleur } sans doublon */
export const sectorColors = (labels) =>
  assignColors(labels.map(canonicalSector), { fixed: SECTOR_SLOT, explicit: { Dette: DEBT_COLOR } });
export const currencyColors = (labels) => assignColors(labels, { fixed: CURRENCY_SLOT });
export const countryColors = (labels) => assignColors(labels, { fixed: { Crypto: TYPE_SLOT.Crypto } });
