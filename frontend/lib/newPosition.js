// Fenêtre « Ajouter une position » (lib pure, testée dans tests/newPosition.test.mjs) :
// lecture des champs quantité, PRU et enveloppe avant l'envoi au POST /api/user/portfolio.

// Enveloppes acceptées par le backend (ACCOUNTS dans backend/routes/user.js)
export const POSITION_ACCOUNTS = ["PEA", "CTO", "AV", "PER", "CRYPTO"];

const MAX_AMOUNT = 1e12;

/**
 * Lit un montant saisi en français (« 12,5 », « 1 234,56 »).
 * Champ vide → 0 (à compléter plus tard) ; texte invalide ou négatif → NaN.
 */
export function parseAmount(raw) {
  if (raw === undefined || raw === null) return 0;
  const text = String(raw).replace(/[\s  ]/g, "").replace(",", ".");
  if (text === "") return 0;
  if (!/^\d*\.?\d*$/.test(text) || text === ".") return NaN;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n < MAX_AMOUNT ? n : NaN;
}

/**
 * Valide le formulaire { quantity, pru, account } (valeurs saisies, en texte).
 * → { ok: true, body } prêt pour le POST, ou { ok: false, errors: { champ: message } }.
 */
export function readNewPosition(form = {}) {
  const errors = {};
  const quantity = parseAmount(form.quantity);
  const pru = parseAmount(form.pru);
  if (Number.isNaN(quantity)) errors.quantity = "Quantité invalide : nombre positif attendu (ex. 10 ou 0,5).";
  if (Number.isNaN(pru)) errors.pru = "PRU invalide : nombre positif attendu (ex. 152,30).";
  const account = form.account ? String(form.account).toUpperCase() : null;
  if (account && !POSITION_ACCOUNTS.includes(account)) errors.account = "Enveloppe inconnue.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, body: { quantity, pru, account } };
}
