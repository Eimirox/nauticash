// backend/services/usage.js
// Statistiques d'usage internes, sans cookie ni outil tiers : un évènement par écran consulté
// (collection "usage_events"), et la date de dernière visite sur le compte (lastSeenAt).
// Seuls des comptages sont exposés à l'admin (voir GET /api/admin/usage).

const mongoose = require("mongoose");

const events = () => mongoose.connection.collection("usage_events");
const users = () => mongoose.connection.collection("users");

const DAY = 24 * 3600 * 1000;
const RETENTION_DAYS = 120;

// Écrans suivis : tout le reste est ignoré (pas de chemin arbitraire stocké)
const SCREENS = [
  "/tableau-de-bord", "/portfolio", "/analyses", "/objectifs", "/strategie", "/profil",
];

/** "/portfolio/AAPL?x=1" -> "/portfolio/[ticker]" ; "/analyses/dividendes" -> "/analyses/dividendes" ; inconnu -> null */
function normalizeScreen(path) {
  if (typeof path !== "string") return null;
  const clean = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  if (clean.length > 80) return null;
  const parts = clean.split("/").filter(Boolean);
  if (!parts.length) return null;
  const root = `/${parts[0]}`;
  if (!SCREENS.includes(root)) return null;
  if (root === "/portfolio" && parts.length >= 2) return "/portfolio/[ticker]";
  if (root === "/analyses" && parts.length >= 2 && /^[a-z0-9-]{1,30}$/.test(parts[1])) return `/analyses/${parts[1]}`;
  return root;
}

async function record(userId, path, now = new Date()) {
  const screen = normalizeScreen(path);
  if (!screen) return null;
  const id = new mongoose.Types.ObjectId(userId);
  await events().insertOne({ userId: id, screen, at: now });
  await users().updateOne({ _id: id }, { $set: { lastSeenAt: now } });
  return screen;
}

/** Index de purge automatique (appelé au démarrage, sans effet si la base est simulée) */
async function ensureIndexes() {
  const col = events();
  if (typeof col.createIndex !== "function") return;
  await col.createIndex({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * DAY / 1000 });
  await col.createIndex({ userId: 1, at: -1 });
}

const dayKey = (d) => d.toISOString().slice(0, 10);

/** Résumé pour l'admin : actifs sur 1 / 7 / 30 jours, vues par écran, activité par jour. */
async function summary({ days = 7, now = new Date() } = {}) {
  const span = Math.min(Math.max(parseInt(days, 10) || 7, 1), 90);
  const since = new Date(now.getTime() - span * DAY);
  const rows = await events().find({ at: { $gte: since } }).toArray();

  const activeSince = async (n) => {
    const set = new Set(rows.filter((r) => r.at >= new Date(now.getTime() - n * DAY)).map((r) => String(r.userId)));
    return set.size;
  };

  const byScreen = {};
  const byDay = {};
  for (const r of rows) {
    const s = (byScreen[r.screen] ||= { views: 0, users: new Set() });
    s.views += 1;
    s.users.add(String(r.userId));
    const d = (byDay[dayKey(r.at)] ||= { views: 0, users: new Set() });
    d.views += 1;
    d.users.add(String(r.userId));
  }

  const all = await users().find({}).toArray();
  const total = all.length;
  const newSince = all.filter((u) => u.createdAt && u.createdAt >= since).length;

  return {
    days: span,
    totalUsers: total,
    newUsers: newSince,
    active: { day: await activeSince(1), week: await activeSince(7), month: await activeSince(30) },
    screens: Object.entries(byScreen)
      .map(([screen, v]) => ({ screen, views: v.views, users: v.users.size }))
      .sort((a, b) => b.views - a.views),
    daily: Object.entries(byDay)
      .map(([day, v]) => ({ day, views: v.views, users: v.users.size }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

module.exports = { normalizeScreen, record, summary, ensureIndexes, RETENTION_DAYS };
