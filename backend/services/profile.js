// backend/services/profile.js
// Préférences personnelles de l'utilisateur (page « Mon profil »).
// Stockées dans users.profile ; les valeurs absentes prennent les valeurs par défaut.

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];
const AVATAR_COLORS = ["emerald", "blue", "teal", "indigo", "amber", "rose", "slate"];
const THEMES = ["system", "light", "dark"];
const HOME_PAGES = ["/portfolio", "/analytics", "/analytics/performance", "/analytics/dividendes", "/analytics/geographie"];
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
});

const MAX_AMOUNT = 1e12;
const oneOf = (list) => (v) => (list.includes(v) ? [true, v] : [false]);
const nullable = (check) => (v) => (v === null || v === "" ? [true, null] : check(v));
const amount = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n < MAX_AMOUNT ? [true, Math.round(n * 100) / 100] : [false];
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
  homePage: oneOf(HOME_PAGES),
  goalAmount: nullable(amount),
  goalDate: nullable(isoDate),
  horizon: nullable(oneOf(HORIZONS)),
  riskProfile: nullable(oneOf(RISK_PROFILES)),
  monthlyExpenses: nullable(amount),
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
  return out;
}

module.exports = {
  DEFAULT_PROFILE,
  CURRENCIES,
  AVATAR_COLORS,
  THEMES,
  HOME_PAGES,
  HORIZONS,
  RISK_PROFILES,
  validateProfilePatch,
  readProfile,
};
