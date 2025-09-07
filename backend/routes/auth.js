// [ALEX-AUTH-ROUTES-STRONG] routes/auths.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/user");

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

const formatErrors = (errors) => ({
  message: "Validation error",
  details: errors.array().map(e => ({ field: e.path, msg: e.msg })),
});

// POST /api/auth/register
router.post("/register", [...emailValidators, ...pwValidators], async (req, res) => {
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
router.post("/login", [...emailValidators, body("password").notEmpty().withMessage("Mot de passe requis.")], async (req, res) => {
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

module.exports = router;
