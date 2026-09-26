// backend/middleware/rateLimit.js
// Limiteur de requêtes en mémoire (sans dépendance), par adresse IP.
// Suffisant pour une seule instance du serveur ; au-delà, passer sur Redis.

module.exports = function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // ip -> [timestamps]

  // Nettoyage périodique pour ne pas garder les vieilles IP en mémoire
  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of hits) {
      const recent = times.filter((t) => now - t < windowMs);
      recent.length ? hits.set(ip, recent) : hits.delete(ip);
    }
  }, windowMs);
  cleaner.unref();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ message: message || "Trop de tentatives. Réessayez plus tard." });
    }

    recent.push(now);
    hits.set(ip, recent);
    next();
  };
};
