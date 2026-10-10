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
// Page Stratégie : style d'investissement et poches de l'allocation cible (zones + or / matières premières, crypto)
const STRATEGIES = ["dividendes", "croissance", "passive", "equilibree"];
const ALLOCATION_KEYS = ["europe", "northAmerica", "asiaPacific", "emerging", "world", "commodities", "crypto"];

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
  // Page Stratégie (null = valeurs proposées par la page selon la stratégie)
  strategy: null, // dividendes | croissance | passive | equilibree
  targetAllocation: null, // { europe: 40, northAmerica: 30, … } en %, total = 100
  maxPositionWeight: null, // poids maximal d'une ligne, en % du portefeuille
  // Affichage mémorisé par écran (tris, filtres, années comparées) : { clé: valeur }, voir VIEW_PREFS_RULES
  viewPrefs: {},
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

// Allocation cible : poches connues, pourcentages de 0 à 100, total de 100 % (à 0,5 point près).
// Les poches absentes valent 0 ; la valeur enregistrée contient toujours toutes les poches.
const allocation = (v) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [false];
  const out = Object.fromEntries(ALLOCATION_KEYS.map((k) => [k, 0]));
  const pct = percent(0, 100);
  for (const [key, raw] of Object.entries(v)) {
    if (!ALLOCATION_KEYS.includes(key)) return [false];
    const [ok, n] = raw === "" || raw === null ? [true, 0] : pct(raw);
    if (!ok) return [false];
    out[key] = n;
  }
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  return Math.abs(total - 100) <= 0.5 ? [true, out] : [false];
};

// Affichage mémorisé par écran (viewPrefs) : liste blanche de clés, chacune avec sa propre validation.
// Une valeur null efface la préférence (retour à l'affichage par défaut de l'écran).
const DIVIDEND_SORT_KEYS = ["totalAnnual", "yieldPercent", "yieldOnCost"];
const sortDir = (allowed) => (v) => (allowed.includes(v) ? [true, v] : [false]);
const VIEW_PREFS_RULES = {
  // Écran Dividendes : colonne triée et sens
  dividendSort: (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return [false];
    if (Object.keys(v).some((k) => k !== "key" && k !== "dir")) return [false];
    return DIVIDEND_SORT_KEYS.includes(v.key) && ["asc", "desc"].includes(v.dir) ? [true, { key: v.key, dir: v.dir }] : [false];
  },
  // Écran Portefeuille : colonne triée (clé courte lettres seulement) et sens
  portfolioSort: (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return [false];
    if (Object.keys(v).some((k) => k !== "key" && k !== "dir")) return [false];
    const okKey = typeof v.key === "string" && /^[A-Za-z]{2,24}$/.test(v.key);
    return okKey && sortDir(["asc", "desc"])(v.dir)[0] ? [true, { key: v.key, dir: v.dir }] : [false];
  },
  // Écran Portefeuille : enveloppe filtrée (« all » ou nom d'enveloppe)
  portfolioAccount: (v) => (typeof v === "string" && v.trim().length >= 1 && v.length <= 40 && !/[<>]/.test(v) ? [true, v.trim()] : [false]),
  // Tableau de bord : années comparées dans le graphique d'évolution (de 1 à 6, triées de la plus récente)
  historyYears: (v) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > 6) return [false];
    if (!v.every((y) => Number.isInteger(y) && y >= 2000 && y <= 2100)) return [false];
    return [true, [...new Set(v)].sort((a, b) => b - a)];
  },
};
const VIEW_PREFS_KEYS = Object.keys(VIEW_PREFS_RULES);
const VIEW_PREFS_MESSAGES = {
  dividendSort: "Tri des dividendes invalide.",
  portfolioSort: "Tri du portefeuille invalide.",
  portfolioAccount: "Enveloppe invalide.",
  historyYears: "Années du graphique invalides (de 1 à 6 années entre 2000 et 2100).",
};

// Mise à jour partielle : { dividendSort: {...}, historyYears: null } ; renvoie [ok, valeurNormalisée]
// (null conservé tel quel : il efface la préférence)
const viewPrefsPatch = (v) => {
  if (!v || typeof v !== "object" || Array.isArray(v) || !Object.keys(v).length) return [false];
  const out = {};
  for (const [key, raw] of Object.entries(v)) {
    if (!Object.hasOwn(VIEW_PREFS_RULES, key)) return [false];
    if (raw === null) {
      out[key] = null;
      continue;
    }
    const [ok, normalized] = VIEW_PREFS_RULES[key](raw);
    if (!ok) return [false];
    out[key] = normalized;
  }
  return [true, out];
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
  strategy: nullable(oneOf(STRATEGIES)),
  targetAllocation: nullable(allocation),
  maxPositionWeight: nullable(percent(1, 100)),
  viewPrefs: viewPrefsPatch,
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
  strategy: "Stratégie : dividendes, croissance, indicielle passive ou équilibrée.",
  targetAllocation: "Allocation cible : poches connues, de 0 à 100 % chacune, pour un total de 100 %.",
  maxPositionWeight: "Poids maximal d'une ligne : entre 1 et 100 %.",
  viewPrefs: "Préférences d'affichage invalides (clés autorisées : " + VIEW_PREFS_KEYS.join(", ") + ").",
};

// Message précis pour une préférence d'affichage refusée (clé inconnue ou valeur invalide)
function viewPrefsMessage(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return MESSAGES.viewPrefs;
  for (const [key, v] of Object.entries(raw)) {
    if (!Object.hasOwn(VIEW_PREFS_RULES, key)) return `Préférence d'affichage inconnue : ${key}.`;
    if (v !== null && !VIEW_PREFS_RULES[key](v)[0]) return VIEW_PREFS_MESSAGES[key];
  }
  return MESSAGES.viewPrefs;
}

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
    else errors.push({ field: key, msg: key === "viewPrefs" ? viewPrefsMessage(raw) : MESSAGES[key] });
  }
  if (!Object.keys(patch).length) errors.push({ field: null, msg: "Rien à mettre à jour." });
  return errors.length ? { errors } : { value };
}

/** Préférences d'affichage enregistrées : seules les clés connues et valides sont renvoyées. */
function readViewPrefs(stored) {
  const out = {};
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return out;
  for (const key of VIEW_PREFS_KEYS) {
    if (stored[key] === undefined || stored[key] === null) continue;
    const [ok, value] = VIEW_PREFS_RULES[key](stored[key]);
    if (ok) out[key] = value;
  }
  return out;
}

/**
 * Opérations MongoDB d'une mise à jour validée : champs du profil en `profile.<champ>`,
 * préférences d'affichage fusionnées clé par clé (`profile.viewPrefs.<clé>`) ; null efface la clé.
 */
function profileUpdateOps(value) {
  const $set = {};
  const $unset = {};
  for (const [key, v] of Object.entries(value)) {
    if (key === "viewPrefs") {
      for (const [prefKey, prefValue] of Object.entries(v)) {
        if (prefValue === null) $unset[`profile.viewPrefs.${prefKey}`] = "";
        else $set[`profile.viewPrefs.${prefKey}`] = prefValue;
      }
    } else {
      $set[`profile.${key}`] = v;
    }
  }
  const ops = {};
  if (Object.keys($set).length) ops.$set = $set;
  if (Object.keys($unset).length) ops.$unset = $unset;
  return ops;
}

/** Profil complet (valeurs par défaut + valeurs enregistrées connues). */
function readProfile(user) {
  const stored = (user && user.profile) || {};
  const out = { ...DEFAULT_PROFILE };
  for (const key of Object.keys(DEFAULT_PROFILE)) {
    if (stored[key] !== undefined) out[key] = stored[key];
  }
  if (Object.hasOwn(LEGACY_HOME_PAGES, out.homePage)) out.homePage = LEGACY_HOME_PAGES[out.homePage];
  out.viewPrefs = readViewPrefs(stored.viewPrefs);
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
  STRATEGIES,
  ALLOCATION_KEYS,
  VIEW_PREFS_KEYS,
  validateProfilePatch,
  readProfile,
  profileUpdateOps,
};
