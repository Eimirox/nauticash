// backend/services/plans.js
// Formules d'abonnement : « free » (gratuite) et « vip ». Socle sans paiement : la formule est un champ du compte
// (`plan`) que l'administrateur change à la main (POST /api/admin/users/plan).
//
// VIP_ENFORCED=true active le verrouillage. Tant qu'il n'est pas activé, tout le monde garde l'accès :
// on peut donc déployer le socle sans rien changer pour les utilisateurs actuels.
// Les administrateurs (ADMIN_EMAILS) ont toujours accès.

const PLANS = ["free", "vip"];

// Écrans réservés au VIP (quand le verrouillage est actif)
const VIP_FEATURES = ["objectifs", "strategie"];

// Champs du profil propres aux pages Objectifs (rente, projection) et Stratégie : leur enregistrement est refusé sans accès.
// L'objectif de patrimoine simple, la date, l'horizon, le profil de risque et les dépenses mensuelles restent gratuits
// (ils alimentent le Tableau de bord et le fonds de précaution).
const VIP_PROFILE_FIELDS = [
  "incomeGoalMonthly",
  "monthlySavings",
  "expectedReturn",
  "dividendYield",
  "inflationRate",
  "strategy",
  "targetAllocation",
  "maxPositionWeight",
];

const isEnforced = () => process.env.VIP_ENFORCED === "true";

const isAdminEmail = (email) =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(String(email || "").toLowerCase());

/** Formule enregistrée du compte (« free » par défaut) */
const planOf = (user) => (PLANS.includes(user?.plan) ? user.plan : "free");

/** Accès à un écran : toujours vrai si le verrouillage est inactif, pour un admin ou un compte VIP */
function hasAccess(user, feature) {
  if (!isEnforced() || !VIP_FEATURES.includes(feature)) return true;
  return planOf(user) === "vip" || isAdminEmail(user?.email);
}

/** { plan, vipEnforced, access: { objectifs, strategie } } pour la réponse GET /api/user/profile */
function describe(user) {
  return {
    plan: planOf(user),
    vipEnforced: isEnforced(),
    access: Object.fromEntries(VIP_FEATURES.map((f) => [f, hasAccess(user, f)])),
  };
}

/** Champs VIP présents dans un patch de profil */
const vipFieldsIn = (patch) => VIP_PROFILE_FIELDS.filter((k) => patch && Object.hasOwn(patch, k));

module.exports = { PLANS, VIP_FEATURES, VIP_PROFILE_FIELDS, isEnforced, isAdminEmail, planOf, hasAccess, describe, vipFieldsIn };
