// backend/services/profile.js
// Préférences personnelles de l'utilisateur (page « Mon profil »).
// Stockées dans users.profile ; les valeurs absentes prennent les valeurs par défaut.

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];
const AVATAR_COLORS = ["emerald", "blue", "teal", "indigo", "amber", "rose", "slate"];
const THEMES = ["system", "light", "dark"];
const HOME_PAGES = ["/tableau-de-bord", "/portfolio", "/analyses/performance", "/analyses/dividendes", "/analyses/repartition"];
// Anciennes adresses (avant la navigation par onglets) : acceptées et converties
const LEGACY_HOME_PAGES = Object.freeze({
  "/analytics": "/tableau-de-bord",
  "/analytics/performance": "/analyses/performance",
  "/analytics/dividendes": "/analyses/dividendes",
  "/analytics/geographie": "/analyses/repartition",
});
const homePage = (v) => oneOf(HOME_PAGES)(Object.hasOwn(LEGACY_HOME_PAGES, v) ? LEGACY_HOME_PAGES[v] : v);
const HORIZONS = ["court", "moyen", "long"]; // < 3 ans, 3 à 8 ans, > 8 ans
const RISK_PROFILES = ["prudent", "equilibre", "dynamique", "offensif"];

const DEFAULT_PROFILE = Object.freeze({
  displayName: "",
  avatarColor: "emerald",
  baseCurrency: "EUR",
  theme: "system",
  discreetMode: false,
  homePage: "/portfolio",
  goalAmount: null,
  goalDate: null,
  horizon: null,
  riskProfile: null,
  monthlyExpenses: null,
  // Page Objectifs : rente de dividendes visée et hypothèses de projection (null = valeur proposée par la page)
  incomeGoalMonthly: null, // rente de dividendes visée, en devise de référence par mois
  monthlySavings: null, // épargne investie chaque mois
  expectedReturn: null, // rendement annuel espéré, en % (6 = 6 %/an)
  dividendYield: null, // rendement du dividende visé à l'arrivée, en %
  inflationRate: null, // inflation annuelle supposée, en %
});

const MAX_AMOUNT = 1e12;
const oneOf = (list) => (v) => (list.includes(v) ? [true, v] : [false]);
const nullable = (check) => (v) => (v === null || v === "" ? [true, null] : check(v));
const amount = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n < MAX_AMOUNT ? [true, Math.round(n * 100) / 100] : [false];
};
// Pourcentage borné (6 = 6 %), arrondi à 2 décimales ; accepte « 6,5 »
const percent = (min, max) => (v) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max ? [true, Math.round(n * 100) / 100] : [false];
};
const isoDate = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return [false];
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? [false] : [true, v];
};

// Règle de validation par champ : renvoie [ok, valeurNormalisée]
const RULES = {
  displayName: (v) => {
    if (typeof v !== "string") return [false];
    const s = v.trim().replace(/\s+/g, " ");
    return s.length <= 40 && !/[<>]/.test(s) ? [true, s] : [false];
  },
  avatarColor: oneOf(AVATAR_COLORS),
  baseCurrency: (v) => oneOf(CURRENCIES)(typeof v === "string" ? v.toUpperCase() : v),
  theme: oneOf(THEMES),
  discreetMode: (v) => (typeof v === "boolean" ? [true, v] : [false]),
  homePage,
  goalAmount: nullable(amount),
  goalDate: nullable(isoDate),
  horizon: nullable(oneOf(HORIZONS)),
  riskProfile: nullable(oneOf(RISK_PROFILES)),
  monthlyExpenses: nullable(amount),
  incomeGoalMonthly: nullable(amount),
  monthlySavings: nullable(amount),
  expectedReturn: nullable(percent(-10, 20)),
  dividendYield: nullable(percent(0.1, 15)),
  inflationRate: nullable(percent(0, 15)),
};

const MESSAGES = {
  displayName: "Le prénom ou pseudo doit faire 40 caractères au maximum.",
  avatarColor: "Couleur d'avatar inconnue.",
  baseCurrency: `Devise de référence : ${CURRENCIES.join(", ")}.`,
  theme: "Thème : système, clair ou sombre.",
  discreetMode: "Mode discret : vrai ou faux.",
  homePage: "Page d'accueil inconnue.",
  goalAmount: "Objectif de patrimoine invalide.",
  goalDate: "Échéance invalide (format AAAA-MM-JJ).",
  horizon: "Horizon : court, moyen ou long.",
  riskProfile: "Profil de risque : prudent, équilibré, dynamique ou offensif.",
  monthlyExpenses: "Dépenses mensuelles invalides.",
  incomeGoalMonthly: "Rente mensuelle visée invalide.",
  monthlySavings: "Épargne mensuelle invalide.",
  expectedReturn: "Rendement espéré : entre −10 et 20 % par an.",
  dividendYield: "Rendement du dividende : entre 0,1 et 15 %.",
  inflationRate: "Inflation : entre 0 et 15 % par an.",
};

/** Valide une mise à jour partielle. Renvoie { value } ou { errors }. */
function validateProfilePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return { errors: [{ field: null, msg: "Données de profil invalides." }] };
  }
  const value = {};
  const errors = [];
  for (const [key, raw] of Object.entries(patch)) {
    const rule = RULES[key];
    if (!rule) {
      errors.push({ field: key, msg: `Champ inconnu : ${key}.` });
      continue;
    }
    const [ok, normalized] = rule(raw);
    if (ok) value[key] = normalized;
    else errors.push({ field: key, msg: MESSAGES[key] });
  }
  if (!Object.keys(patch).length) errors.push({ field: null, msg: "Rien à mettre à jour." });
  return errors.length ? { errors } : { value };
}

/** Profil complet (valeurs par défaut + valeurs enregistrées connues). */
function readProfile(user) {
  const stored = (user && user.profile) || {};
  const out = { ...DEFAULT_PROFILE };
  for (const key of Object.keys(DEFAULT_PROFILE)) {
    if (stored[key] !== undefined) out[key] = stored[key];
  }
  if (Object.hasOwn(LEGACY_HOME_PAGES, out.homePage)) out.homePage = LEGACY_HOME_PAGES[out.homePage];
  return out;
}

module.exports = {
  DEFAULT_PROFILE,
  CURRENCIES,
  AVATAR_COLORS,
  THEMES,
  HOME_PAGES,
  LEGACY_HOME_PAGES,
  HORIZONS,
  RISK_PROFILES,
  validateProfilePatch,
  readProfile,
};
