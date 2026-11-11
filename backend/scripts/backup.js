// backend/scripts/backup.js
// Exporte les données précieuses de la base dans un fichier chiffré (.ncbak).
//
// Usage (depuis le dossier backend) :
//   MONGO_URI=... BACKUP_KEY="phrase secrète longue" node scripts/backup.js [dossier]
// (ou avec ces deux variables dans .env). Le fichier est créé dans ./backups par défaut.
// Déchiffrer : node scripts/decryptBackup.js fichier.ncbak sortie.json

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { EJSON } = mongoose.mongo.BSON;
const backup = require("../services/backup");

(async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI manquant.");
    backup.encrypt({}, process.env.BACKUP_KEY); // vérifie la clé avant de toucher à la base

    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;
    const payload = { createdAt: new Date().toISOString() };
    for (const name of backup.COLLECTIONS) {
      const docs = await db.collection(name).find({}).toArray();
      payload[name] = EJSON.serialize(docs, { relaxed: false });
      console.log(`  ${name} : ${docs.length} document(s)`);
    }
    if (!payload.users.length) throw new Error("Aucun compte trouvé : sauvegarde annulée (mauvaise base ?).");

    const dir = path.resolve(process.argv[2] || "backups");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, backup.fileName());
    fs.writeFileSync(file, backup.encrypt(payload, process.env.BACKUP_KEY));
    console.log(`✅ Sauvegarde chiffrée : ${file} (${fs.statSync(file).size} octets)`);
  } catch (err) {
    console.error("❌ Sauvegarde échouée :", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
