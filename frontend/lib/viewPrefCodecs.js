// frontend/lib/viewPrefCodecs.js
// Préférences d'affichage mémorisées dans le compte (profile.viewPrefs, voir backend/services/profile.js).
// Chaque codec fait le pont entre l'état d'un écran et la valeur stockée :
//  - serialize(état) → valeur à enregistrer, ou null pour effacer (retour à l'affichage par défaut) ;
//  - deserialize(valeurEnregistrée) → état de l'écran (jamais d'exception, valeur par défaut sinon).
// Fichier sans dépendance : testé dans tests/viewPrefCodecs.test.mjs.

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export const VIEW_PREF_CODECS = {
  // Écran Dividendes : { key: "totalAnnual" | "yieldPercent" | "yieldOnCost" | null, dir: "asc" | "desc" | null }
  dividendSort: {
    name: "dividendSort",
    defaultValue: { key: null, dir: null },
    serialize: (v) => (isObj(v) && v.key && (v.dir === "asc" || v.dir === "desc") ? { key: v.key, dir: v.dir } : null),
    deserialize: (s) => (isObj(s) && s.key && (s.dir === "asc" || s.dir === "desc") ? { key: s.key, dir: s.dir } : { key: null, dir: null }),
  },
  // Écran Portefeuille : { key: colonne | null, dir: "asc" | "desc" | "none" }
  portfolioSort: {
    name: "portfolioSort",
    defaultValue: { key: null, dir: "none" },
    serialize: (v) => (isObj(v) && v.key && (v.dir === "asc" || v.dir === "desc") ? { key: v.key, dir: v.dir } : null),
    deserialize: (s) => (isObj(s) && s.key && (s.dir === "asc" || s.dir === "desc") ? { key: s.key, dir: s.dir } : { key: null, dir: "none" }),
  },
  // Écran Portefeuille : enveloppe filtrée (« all » = toutes)
  portfolioAccount: {
    name: "portfolioAccount",
    defaultValue: "all",
    serialize: (v) => (typeof v === "string" && v && v !== "all" ? v : null),
    deserialize: (s) => (typeof s === "string" && s ? s : "all"),
  },
  // Tableau de bord : années comparées. État null = pas de choix (les deux années les plus récentes).
  historyYears: {
    name: "historyYears",
    defaultValue: null,
    serialize: (v) => (Array.isArray(v) && v.length ? [...new Set(v)].sort((a, b) => b - a).slice(0, 6) : null),
    deserialize: (s) => (Array.isArray(s) && s.length ? s : null),
  },
};

/** Même valeur ? (comparaison structurelle des petites valeurs JSON) */
export function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** L'état de l'écran diffère-t-il de l'affichage par défaut ? (affiche le bouton « Réinitialiser l'affichage ») */
export function isCustomized(codec, value) {
  return codec.serialize(value) !== null;
}
