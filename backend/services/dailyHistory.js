// backend/services/dailyHistory.js
// Historique automatique : valeur du portefeuille de chaque utilisateur enregistrée
// une fois par jour (collection « history_daily »), en euros au taux BCE du jour,
// à partir des cours en cache (aucun appel aux API de cotation).
// Le relevé mensuel (collection « history ») est aussi tenu à jour, sauf si
// l'utilisateur y a saisi une valeur à la main pour ce mois (auto: false).

const mongoose = require("mongoose");
const fx = require("./fx");
const priceStore = require("./priceStore");

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const daily = () => mongoose.connection.collection("history_daily");
const monthly = () => mongoose.connection.collection("history");
const users = () => mongoose.connection.collection("users");

const round2 = (n) => Math.round(n * 100) / 100;

/** « 2026-09-28 » (jour UTC) */
function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Valeur en euros d'un utilisateur : positions (cours en cache × quantité) + cash.
 * `missing` compte les positions sans cours ou dans une devise sans taux (ignorées).
 */
function valueUser(user, pricesBySymbol, rates) {
  let invested = 0;
  let missing = 0;
  for (const pos of user.portfolio || []) {
    const qty = Number(pos.quantity) || 0;
    if (!qty) continue;
    const price = pricesBySymbol.get(pos.ticker);
    const close = Number(price?.close);
    const eur = close > 0 ? fx.toEUR(close * qty, price.currency || "EUR", rates) : null;
    if (eur === null) {
      missing++;
      continue;
    }
    invested += eur;
  }
  const cashEUR = fx.toEUR(Number(user.cashAmount) || 0, user.cashCurrency || "EUR", rates);
  if (cashEUR === null && user.cashAmount) missing++;
  const cash = cashEUR ?? 0;
  return { value: round2(invested + cash), invested: round2(invested), cash: round2(cash), missing };
}

/**
 * Enregistre la valeur du jour pour tous les utilisateurs ayant des positions ou du cash.
 * Rejouer le même jour remplace la valeur (pas de doublon).
 */
async function snapshotAll({ date = new Date() } = {}) {
  const { rates, stale } = await fx.getRates();
  const all = await users().find({}).toArray();
  const active = all.filter((u) => (u.portfolio || []).length > 0 || Number(u.cashAmount));

  const tickers = [...new Set(active.flatMap((u) => (u.portfolio || []).map((p) => p.ticker)).filter(Boolean))];
  const prices = await priceStore.getCachedMany(tickers);
  const pricesBySymbol = new Map(prices.map((p) => [p.symbol, p]));

  const key = dayKey(date);
  const year = date.getUTCFullYear();
  const month = MONTHS[date.getUTCMonth()];
  let written = 0;

  for (const user of active) {
    const userId = String(user._id);
    const v = valueUser(user, pricesBySymbol, rates);
    await daily().updateOne(
      { userId, date: key },
      { $set: { ...v, currency: "EUR", fxStale: Boolean(stale), updatedAt: new Date() } },
      { upsert: true }
    );

    const existing = await monthly().findOne({ userId, year, month });
    if (!existing || existing.auto === true) {
      await monthly().updateOne({ userId, year, month }, { $set: { value: v.value, auto: true } }, { upsert: true });
    }
    written++;
  }

  return { date: key, users: written };
}

/** Points quotidiens d'un utilisateur, du plus ancien au plus récent */
async function getDaily(userId, { days = 365 } = {}) {
  const since = dayKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const rows = await daily().find({ userId: String(userId), date: { $gte: since } }).toArray();
  return rows
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(({ date, value, invested, cash, missing }) => ({ date, value, invested, cash, missing }));
}

module.exports = { snapshotAll, getDaily, valueUser, dayKey, MONTHS };
