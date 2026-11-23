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
  const holdings = []; // lignes valorisées : { t: ticker, q: quantité, p: cours unitaire en euros }
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
    holdings.push({ t: pos.ticker, q: qty, p: Math.round((eur / qty) * 1e6) / 1e6 });
  }
  const cashEUR = fx.toEUR(Number(user.cashAmount) || 0, user.cashCurrency || "EUR", rates);
  if (cashEUR === null && user.cashAmount) missing++;
  const cash = cashEUR ?? 0;
  return { value: round2(invested + cash), invested: round2(invested), cash: round2(cash), missing, holdings };
}

/**
 * Performance « pondérée dans le temps », indépendante des apports, retraits et changements de lignes :
 * le rendement d'une journée est calculé sur les lignes détenues la VEILLE (quantité de la veille ×
 * variation de cours en euros), jamais sur la variation de la valeur totale.
 * Le cash ne rapporte rien ici ; les dividendes ne sont pas comptés (performance des cours).
 * Renvoie { perf, dayGain } : perf = indice base 100 au premier jour suivi, dayGain = gain du jour en euros.
 * Sans veille exploitable (premier jour, ou ligne d'avant l'introduction de ce suivi), l'indice repart à 100.
 */
function nextPerf(prev, holdings) {
  if (!prev || !Array.isArray(prev.holdings) || !Number.isFinite(prev.perf) || !(prev.perf > 0)) {
    return { perf: 100, dayGain: 0 };
  }
  const now = new Map((holdings || []).map((h) => [h.t, h.p]));
  let dayGain = 0;
  for (const h of prev.holdings) {
    const p = now.get(h.t);
    if (p > 0 && h.p > 0 && h.q > 0) dayGain += h.q * (p - h.p);
  }
  const base = Number(prev.value);
  const perf = base > 0 ? prev.perf * (1 + dayGain / base) : prev.perf;
  return { perf: Math.round(perf * 1e4) / 1e4, dayGain: round2(dayGain) };
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
    // Dernière photo antérieure à ce jour (rejouer le même jour ne décale pas la référence)
    const before = await daily().find({ userId, date: { $lt: key } }).toArray();
    const prev = before.reduce((m, r) => (!m || r.date > m.date ? r : m), null);
    const { perf, dayGain } = nextPerf(prev, v.holdings);
    await daily().updateOne(
      { userId, date: key },
      { $set: { ...v, perf, dayGain, currency: "EUR", fxStale: Boolean(stale), updatedAt: new Date() } },
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
    .map(({ date, value, invested, cash, missing, perf, dayGain }) => {
      const point = { date, value, invested, cash, missing };
      // perf / dayGain : absents des photos d'avant l'introduction de la performance hors apports
      if (Number.isFinite(perf)) point.perf = perf;
      if (Number.isFinite(dayGain)) point.dayGain = dayGain;
      return point;
    });
}

module.exports = { snapshotAll, getDaily, valueUser, nextPerf, dayKey, MONTHS };
