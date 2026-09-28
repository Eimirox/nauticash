// backend/routes/market.js
// Données de marché partagées : indices de référence (voir services/benchmarks.js)

const express = require("express");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");
const benchmarks = require("../services/benchmarks");
const priceService = require("../services/priceService");
const rateLimit = require("../middleware/rateLimit");
const { searchLocal } = require("../services/popularTickers");

const SEARCH_TTL = 7 * 24 * 60 * 60 * 1000;
const searchCache = () => mongoose.connection.collection("symbol_search");
const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: "Trop de recherches, patientez une minute." });

const router = express.Router();

// GET /api/market/benchmarks → indices disponibles
router.get("/benchmarks", auth, (req, res) => {
  res.json(benchmarks.list());
});

// GET /api/market/benchmarks/:key → historique quotidien (≈ 400 jours)
router.get("/benchmarks/:key", auth, async (req, res) => {
  try {
    const data = await benchmarks.getBenchmark(String(req.params.key).toUpperCase());
    if (!data) return res.status(404).json({ error: "Indice inconnu." });
    res.set("Cache-Control", "private, max-age=3600");
    res.json(data);
  } catch (err) {
    console.error("❌ Error GET /market/benchmarks:", err.message);
    res.status(503).json({ error: "Données de l'indice momentanément indisponibles." });
  }
});

// GET /api/market/search?q=google → suggestions de tickers pour l'aide à la saisie
// Liste locale (instantanée) + recherche Yahoo Finance mise en cache 7 jours par requête.
router.get("/search", auth, searchLimiter, async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 40);
  if (!q) return res.json({ results: [] });

  const local = searchLocal(q, 8);
  const key = q.toLowerCase();
  let remote = [];
  let source = "local";

  try {
    const cached = await searchCache().findOne({ query: key });
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < SEARCH_TTL) {
      remote = cached.results || [];
      source = "cache";
    } else if (priceService.providers.yahoo) {
      remote = await priceService.providers.yahoo.search(q, 10);
      await searchCache().updateOne({ query: key }, { $set: { query: key, results: remote, updatedAt: new Date() } }, { upsert: true });
      source = "yahoo";
    }
  } catch (err) {
    console.error("❌ Recherche de tickers :", err.message);
  }

  // Fusion sans doublon : correspondance exacte d'abord, puis suggestions locales, puis en ligne
  const seen = new Set();
  const merged = [];
  const upper = q.toUpperCase();
  const all = [...local, ...remote];
  all.sort((a, b) => (b.symbol === upper) - (a.symbol === upper));
  for (const r of all) {
    if (!r?.symbol || seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    // Compléter une entrée locale avec le secteur trouvé en ligne
    const online = remote.find((x) => x.symbol === r.symbol);
    merged.push({ ...r, sector: r.sector || online?.sector || null });
    if (merged.length >= 10) break;
  }

  res.json({ results: merged, source });
});

module.exports = router;
