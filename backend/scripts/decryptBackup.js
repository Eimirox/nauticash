// backend/scripts/decryptBackup.js
// Déchiffre une sauvegarde .ncbak en JSON lisible (pour vérifier son contenu ou restaurer).
//
// Usage : BACKUP_KEY="phrase secrète" node scripts/decryptBackup.js fichier.ncbak sortie.json
// Attention : le JSON obtenu contient les données des utilisateurs en clair, à supprimer après usage.

require("dotenv").config();
const fs = require("fs");
const backup = require("../services/backup");

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage : node scripts/decryptBackup.js fichier.ncbak sortie.json");
  process.exit(1);
}
try {
  const data = backup.decrypt(fs.readFileSync(input), process.env.BACKUP_KEY);
  fs.writeFileSync(output, JSON.stringify(data, null, 2));
  const counts = Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k}: ${v.length}`);
  console.log(`✅ ${output} (${counts.join(", ")})`);
} catch (err) {
  console.error("❌", err.message);
  process.exit(1);
}
