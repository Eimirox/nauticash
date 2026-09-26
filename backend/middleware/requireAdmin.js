// backend/middleware/requireAdmin.js
// À utiliser après le middleware auth. Les admins sont listés dans la variable
// d'environnement ADMIN_EMAILS (séparés par des virgules).

module.exports = (req, res, next) => {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const email = (req.user?.email || "").toLowerCase();

  if (!email || !admins.includes(email)) {
    return res.status(403).json({ message: "Accès réservé à l'administrateur." });
  }
  next();
};
