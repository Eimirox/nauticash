const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res.status(401).json({ message: "Accès refusé. Aucun token fourni." });
  }

  // ✅ Vérification si le token commence bien par "Bearer "
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Format de token invalide." });
  }

  const token = authHeader.split(" ")[1]; // 🔥 Extraction du token après "Bearer"

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // Ajoute l'utilisateur vérifié à `req`
    next();
  } catch (error) {
    res.status(401).json({ message: "Token invalide." });
  }
};
