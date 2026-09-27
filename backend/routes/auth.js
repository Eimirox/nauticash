// [ALEX-AUTH-ROUTES-STRONG] routes/auths.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const crypto = require("crypto");
const User = require("../models/user");
const { sendPasswordResetEmail } = require("../services/emailService");
const rateLimit = require("../middleware/rateLimit");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");

const router = express.Router();

// Helpers
const pwValidators = [
  body("password")
    .isLength({ min: 10 }).withMessage("Le mot de passe doit contenir au moins 10 caractères.")
    .matches(/[A-Z]/).withMessage("Le mot de passe doit contenir au moins 1 majuscule.")
    .matches(/[a-z]/).withMessage("Le mot de passe doit contenir au moins 1 minuscule.")
    .matches(/[0-9]/).withMessage("Le mot de passe doit contenir au moins 1 chiffre.")
    .matches(/[^A-Za-z0-9]/).withMessage("Le mot de passe doit contenir au moins 1 caractère spécial."),
];

const emailValidators = [
  body("email")
    .isEmail().withMessage("Email invalide.")
    .normalizeEmail()
    .customSanitizer((v) => (typeof v === "string" ? v.toLowerCase() : v)),
];

// Limites anti-brute-force (par IP)
const MIN = 60 * 1000;
const loginLimiter = rateLimit({ windowMs: 15 * MIN, max: 10, message: "Trop de tentatives de connexion. Réessayez dans 15 minutes." });
const registerLimiter = rateLimit({ windowMs: 60 * MIN, max: 5, message: "Trop de créations de compte. Réessayez plus tard." });
const forgotLimiter = rateLimit({ windowMs: 60 * MIN, max: 5, message: "Trop de demandes. Réessayez dans une heure." });
const resetLimiter = rateLimit({ windowMs: 15 * MIN, max: 10 });
const accountLimiter = rateLimit({ windowMs: 15 * MIN, max: 10, message: "Trop de tentatives. Réessayez dans 15 minutes." });

const formatErrors = (errors) => ({
  message: "Validation error",
  details: errors.array().map(e => ({ field: e.path, msg: e.msg })),
});

// POST /api/auth/register
router.post("/register", registerLimiter, [...emailValidators, ...pwValidators], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(formatErrors(errors));

    const { email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email déjà utilisé." });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hash,
      cashAmount: 0,
      cashCurrency: "EUR",
      portfolio: [],
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({ token });
  } catch (err) {
    console.error("REGISTER error:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /api/auth/login
router.post("/login", loginLimiter, [...emailValidators, body("password").notEmpty().withMessage("Mot de passe requis.")], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(formatErrors(errors));

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Identifiants invalides." });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Identifiants invalides." });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token });
  } catch (err) {
    console.error("LOGIN error:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /api/auth/me (protégé recommandé)
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!token) return res.status(401).json({ message: "Non autorisé." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).lean();
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });

    return res.json({
      email: user.email,
      cashAmount: user.cashAmount ?? 0,
      cashCurrency: user.cashCurrency ?? "EUR",
    });
  } catch {
    return res.status(401).json({ message: "Token invalide." });
  }
});

// =============================================================================
// MOT DE PASSE OUBLIÉ
// =============================================================================

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;   // lien valable 1 heure
const RESET_RESEND_DELAY_MS = 2 * 60 * 1000; // pas plus d'un email toutes les 2 minutes

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// POST /api/auth/forgot-password  { email }
// Répond toujours la même chose pour ne pas révéler si un compte existe.
router.post("/forgot-password", forgotLimiter, emailValidators, async (req, res) => {
  const genericResponse = {
    message: "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.",
  };

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(formatErrors(errors));

    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json(genericResponse);

    // Anti-spam : si un lien a été envoyé il y a moins de 2 minutes, on n'en renvoie pas
    if (
      user.resetPasswordExpires &&
      user.resetPasswordExpires.getTime() - RESET_TOKEN_TTL_MS + RESET_RESEND_DELAY_MS > Date.now()
    ) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = hashToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (mailErr) {
      console.error("FORGOT-PASSWORD mail error:", mailErr);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(502).json({ message: "Impossible d'envoyer l'email pour le moment. Réessayez plus tard." });
    }

    return res.json(genericResponse);
  } catch (err) {
    console.error("FORGOT-PASSWORD error:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /api/auth/reset-password  { token, password }
router.post(
  "/reset-password",
  resetLimiter,
  [body("token").isString().isLength({ min: 64, max: 64 }).withMessage("Lien invalide."), ...pwValidators],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrors(errors));

      const { token, password } = req.body;

      const user = await User.findOne({
        resetPasswordToken: hashToken(token),
        resetPasswordExpires: { $gt: new Date() },
      });
      if (!user) {
        return res.status(400).json({ message: "Lien invalide ou expiré. Refaites une demande de réinitialisation." });
      }

      user.password = await bcrypt.hash(password, 10);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      return res.json({ message: "Mot de passe mis à jour. Vous pouvez vous connecter." });
    } catch (err) {
      console.error("RESET-PASSWORD error:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

// =============================================================================
// MON COMPTE
// =============================================================================

// Vérifie le mot de passe actuel de l'utilisateur connecté
async function checkCurrentPassword(req, res) {
  const user = await User.findById(req.user.userId);
  if (!user) {
    res.status(404).json({ message: "Utilisateur introuvable." });
    return null;
  }
  const ok = await bcrypt.compare(String(req.body.currentPassword || ""), user.password);
  if (!ok) {
    res.status(403).json({ message: "Mot de passe actuel incorrect." });
    return null;
  }
  return user;
}

// POST /api/auth/change-password  { currentPassword, password }
router.post(
  "/change-password",
  accountLimiter,
  auth,
  [body("currentPassword").notEmpty().withMessage("Mot de passe actuel requis."), ...pwValidators],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrors(errors));

      const user = await checkCurrentPassword(req, res);
      if (!user) return;

      if (await bcrypt.compare(req.body.password, user.password)) {
        return res.status(400).json({ message: "Le nouveau mot de passe doit être différent de l'actuel." });
      }

      user.password = await bcrypt.hash(req.body.password, 10);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      return res.json({ message: "Mot de passe modifié." });
    } catch (err) {
      console.error("CHANGE-PASSWORD error:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

// DELETE /api/auth/account  { currentPassword }
// Supprime définitivement le compte et toutes ses données (portefeuille, cash, historique, transactions).
router.delete(
  "/account",
  accountLimiter,
  auth,
  [body("currentPassword").notEmpty().withMessage("Mot de passe requis pour confirmer.")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrors(errors));

      const user = await checkCurrentPassword(req, res);
      if (!user) return;

      const db = mongoose.connection;
      const id = user._id;
      await db.collection("history").deleteMany({ userId: String(id) });
      await db.collection("transactions").deleteMany({ userId: id });
      await db.collection("users").deleteOne({ _id: id });

      return res.json({ message: "Compte supprimé." });
    } catch (err) {
      console.error("DELETE-ACCOUNT error:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

module.exports = router;
