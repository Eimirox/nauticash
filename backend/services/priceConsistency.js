// backend/services/priceConsistency.js
// Contrôle de cohérence des cours (calculs purs, sans base ni appel API).
// Pour chaque titre détenu : cours enregistré comparé au cours d'un second fournisseur,
// et détection des cours non datés, anciens ou en échec. Utilisé par le contrôle
// quotidien lancé après l'actualisation du soir (étape 2/2 : job + /api/admin/stats).

const DAY = 24 * 60 * 60 * 1000;

/** Écart (en %) au-delà duquel le cours enregistré est jugé incohérent */
const DEFAULT_THRESHOLD = 5;
/** Même règle que le badge « cours du JJ/MM » du frontend (lib/quoteTime.js) */
const STALE_BUSINESS_DAYS = 3;

/** Statuts, du plus grave au moins grave (ordre d'affichage) */
const STATUSES = ["echec", "non_date", "ecart", "ancien", "non_verifie", "ok"];

const toDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Jours ouvrés (lundi → vendredi) écoulés entre deux dates, sans compter le jour de départ (UTC) */
function businessDaysBetween(from, to) {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  let count = 0;
  for (let t = start + DAY; t <= end; t += DAY) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

/** Écart relatif en % entre le cours enregistré et le cours de référence, arrondi à 0,01 */
function deviationPercent(stored, reference) {
  const a = Number(stored);
  const b = Number(reference);
  if (!(a > 0) || !(b > 0)) return null;
  return Math.round((Math.abs(a - b) / b) * 10000) / 100;
}

/**
 * Classe un titre.
 * @param {object|null} doc  fiche de la collection « prices » (close, marketTime, lastUpdate, lastError…)
 * @param {object} [opts]
 * @param {number|null} [opts.referencePrice]  cours du second fournisseur (null s'il n'a pas répondu)
 * @param {string|null} [opts.referenceSource] nom du second fournisseur
 * @param {number} [opts.threshold]  seuil d'écart en %
 * @param {Date} [opts.now]
 * @returns {{ status, price, priceTime, referencePrice, referenceSource, deviation, message }}
 */
function checkPrice(doc, { referencePrice = null, referenceSource = null, threshold = DEFAULT_THRESHOLD, now = new Date() } = {}) {
  const price = Number(doc?.close) > 0 ? Number(doc.close) : null;
  const priceTime = toDate(doc?.marketTime);
  const lastUpdate = toDate(doc?.lastUpdate);
  const errorAt = toDate(doc?.lastError?.at);
  const ref = Number(referencePrice) > 0 ? Number(referencePrice) : null;
  const deviation = deviationPercent(price, ref);
  const base = { price, priceTime, referencePrice: ref, referenceSource: ref ? referenceSource || null : null, deviation };

  // Aucun cours exploitable, ou dernière actualisation en échec
  if (!price) return { ...base, status: "echec", message: doc?.lastError?.message || "Aucun cours enregistré" };
  if (errorAt && (!lastUpdate || errorAt > lastUpdate)) {
    return { ...base, status: "echec", message: doc.lastError.message || "Dernière actualisation en échec" };
  }
  if (!priceTime) return { ...base, status: "non_date", message: "Cours sans date de cotation" };
  if (deviation !== null && deviation > threshold) {
    return { ...base, status: "ecart", message: `Écart de ${String(deviation).replace(".", ",")} % avec ${referenceSource || "le second fournisseur"}` };
  }
  const days = businessDaysBetween(priceTime, now);
  if (days > STALE_BUSINESS_DAYS) return { ...base, status: "ancien", message: `Cours vieux de ${days} jours ouvrés` };
  if (ref === null) return { ...base, status: "non_verifie", message: "Second fournisseur indisponible" };
  return { ...base, status: "ok", message: null };
}

/**
 * Résumé du contrôle : compteurs par statut et liste des titres à surveiller
 * (tout sauf « ok » et « non_verifie »), les plus graves d'abord puis par écart décroissant.
 * @param {Array<{ ticker: string } & ReturnType<typeof checkPrice>>} results
 */
function summarize(results, { checkedAt = new Date() } = {}) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  const rank = (s) => STATUSES.indexOf(s);
  const issues = results
    .filter((r) => r.status !== "ok" && r.status !== "non_verifie")
    .sort((a, b) => rank(a.status) - rank(b.status) || (b.deviation ?? -1) - (a.deviation ?? -1) || a.ticker.localeCompare(b.ticker));
  return { checkedAt, total: results.length, counts, issues };
}

/** Une ligne par titre à surveiller, pour le journal serveur */
function formatLog(summary) {
  const head = `🔎 Cohérence des cours : ${summary.total} titres, ${summary.counts.ok} OK, ${summary.issues.length} à surveiller`;
  return [head, ...summary.issues.map((r) => `   - ${r.ticker} [${r.status}] ${r.message}`)].join("\n");
}

module.exports = {
  checkPrice,
  summarize,
  formatLog,
  deviationPercent,
  businessDaysBetween,
  DEFAULT_THRESHOLD,
  STALE_BUSINESS_DAYS,
  STATUSES,
};
