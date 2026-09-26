// backend/scripts/resetPassword.js
// Change le mot de passe d'un compte directement en base, sans passer par l'email.
//
// Usage (depuis le dossier backend, avec MONGO_URI dans .env) :
//   node scripts/resetPassword.js email@exemple.com "NouveauMotDePasse123!"

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const [email, password] = process.argv.slice(2);

const RULES = [
  [(p) => p.length >= 10, "10 caractères minimum"],
  [(p) => /[A-Z]/.test(p), "1 majuscule"],
  [(p) => /[a-z]/.test(p), "1 minuscule"],
  [(p) => /[0-9]/.test(p), "1 chiffre"],
  [(p) => /[^A-Za-z0-9]/.test(p), "1 caractère spécial"],
];

(async () => {
  if (!email || !password) {
    console.error('Usage : node scripts/resetPassword.js email@exemple.com "NouveauMotDePasse123!"');
    process.exit(1);
  }

  const missing = RULES.filter(([ok]) => !ok(password)).map(([, label]) => label);
  if (missing.length) {
    console.error(`❌ Mot de passe trop faible. Il manque : ${missing.join(", ")}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.collection("users");

  const hash = await bcrypt.hash(password, 10);
  const result = await users.updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { password: hash, resetPasswordToken: null, resetPasswordExpires: null } }
  );

  if (result.matchedCount === 0) {
    console.error(`❌ Aucun compte trouvé pour ${email}`);
  } else {
    console.log(`✅ Mot de passe mis à jour pour ${email}`);
  }

  await mongoose.disconnect();
  process.exit(result.matchedCount ? 0 : 1);
})().catch((err) => {
  console.error("❌ Erreur :", err.message);
  process.exit(1);
});
