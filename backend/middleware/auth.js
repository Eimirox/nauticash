const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Accès refusé. Token manquant ou format invalide." });
    }

    const token = authHeader.split(" ")[1]; // 🔥 Extraction du token après "Bearer"

    // ✅ Vérification du token JWT
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: "Token invalide ou expiré." });
      }

      req.user = decoded; // Ajoute les infos de l'utilisateur à `req.user`
      next(); // Passe à la suite
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur lors de l'authentification." });
  }
};
