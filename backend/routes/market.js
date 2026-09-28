// backend/routes/market.js
// Données de marché partagées : indices de référence (voir services/benchmarks.js)

const express = require("express");
const auth = require("../middleware/auth");
const benchmarks = require("../services/benchmarks");

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

module.exports = router;
