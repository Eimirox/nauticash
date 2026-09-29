// backend/services/accountExport.js
// Export des données du compte (droit à la portabilité, RGPD art. 20).
// Rassemble tout ce qui est rattaché à l'utilisateur, sans les secrets
// (mot de passe hashé, jeton de réinitialisation) ni les données de marché partagées.

const mongoose = require("mongoose");
const { readProfile } = require("./profile");

const col = (name) => mongoose.connection.collection(name);

const iso = (d) => (d ? new Date(d).toISOString() : null);

function readCash(user) {
  if (user.cash && typeof user.cash.amount === "number") {
    return { amount: user.cash.amount, currency: user.cash.currency || "EUR" };
  }
  return { amount: user.cashAmount ?? 0, currency: user.cashCurrency ?? "EUR" };
}

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Données complètes du compte, ou null si l'utilisateur n'existe pas */
async function buildExport(userId) {
  const _id = new mongoose.Types.ObjectId(userId);
  const user = await col("users").findOne({ _id });
  if (!user) return null;

  const id = String(_id);
  const [monthly, daily, transactions] = await Promise.all([
    col("history").find({ userId: id }).toArray(),
    col("history_daily").find({ userId: id }).toArray(),
    col("transactions").find({ userId: _id }).toArray(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: "nauticash-export/1",
    account: {
      email: user.email,
      createdAt: iso(user.createdAt),
      updatedAt: iso(user.updatedAt),
      profile: readProfile(user),
    },
    portfolio: (user.portfolio || []).map((p) => ({
      ticker: p.ticker,
      quantity: p.quantity ?? 0,
      pru: p.pru ?? 0,
      account: p.account || null,
      fees: p.fees ?? null,
    })),
    cash: readCash(user),
    history: {
      monthly: monthly
        .map(({ year, month, value, auto }) => ({ year, month, value, auto: Boolean(auto) }))
        .sort((a, b) => a.year - b.year),
      daily: daily
        .map(({ date, value, invested, cash, currency }) => ({
          date,
          value,
          invested: invested ?? null,
          cash: cash ?? null,
          currency: currency || "EUR",
        }))
        .sort(byDate),
    },
    transactions: transactions.map(({ action, ticker, timestamp }) => ({ action, ticker, timestamp: iso(timestamp) })),
  };
}

// --- CSV (séparateur « ; » et virgule décimale : s'ouvre directement dans Excel en français) ---

function cell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : "";
  const s = String(v);
  // Neutralise les formules (injection CSV) et échappe les guillemets
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(header, rows) {
  const lines = [header, ...rows].map((r) => r.map(cell).join(";"));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

const CSV_DATASETS = {
  positions: (data) =>
    toCsv(
      ["ticker", "quantite", "pru", "enveloppe", "frais_annuels_pct", "devise"],
      [
        ...data.portfolio.map((p) => [p.ticker, p.quantity, p.pru, p.account, p.fees, null]),
        // Ligne de liquidités : le montant est dans « quantite », sa devise dans « devise »
        ["CASH", data.cash.amount, null, null, null, data.cash.currency],
      ]
    ),
  history: (data) =>
    toCsv(
      ["date", "valeur", "investi", "cash", "devise"],
      data.history.daily.map((d) => [d.date, d.value, d.invested, d.cash, d.currency])
    ),
};

module.exports = { buildExport, CSV_DATASETS, toCsv };
