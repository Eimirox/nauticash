// backend/services/backup.js
// Sauvegarde chiffrée : sérialisation (EJSON, conserve ObjectId et dates), compression gzip
// puis chiffrement AES-256-GCM avec une clé dérivée d'une phrase secrète (scrypt).
// Format du fichier : "NCB1" | sel (16) | iv (12) | tag (16) | données chiffrées.

const crypto = require("crypto");
const zlib = require("zlib");

const MAGIC = Buffer.from("NCB1");
const MIN_KEY_LENGTH = 16;

// Collections précieuses ; les caches (prix, indices, recherche) se reconstruisent seuls.
const COLLECTIONS = ["users", "history", "history_daily", "transactions"];

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, 32);
}

function assertKey(passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < MIN_KEY_LENGTH) {
    throw new Error(`BACKUP_KEY manquante ou trop courte (${MIN_KEY_LENGTH} caractères minimum).`);
  }
}

/** { collection: [docs] } (documents EJSON déjà sérialisés) -> Buffer chiffré */
function encrypt(payload, passphrase) {
  assertKey(passphrase);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(zlib.gzipSync(Buffer.from(JSON.stringify(payload)))), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

/** Buffer chiffré -> { collection: [docs] } ; échoue si la clé est fausse ou le fichier altéré */
function decrypt(file, passphrase) {
  assertKey(passphrase);
  if (file.length < 48 || !file.subarray(0, 4).equals(MAGIC)) throw new Error("Fichier de sauvegarde invalide.");
  const salt = file.subarray(4, 20);
  const iv = file.subarray(20, 32);
  const tag = file.subarray(32, 48);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    const gz = Buffer.concat([decipher.update(file.subarray(48)), decipher.final()]);
    return JSON.parse(zlib.gunzipSync(gz).toString("utf8"));
  } catch {
    throw new Error("Déchiffrement impossible : mauvaise clé ou fichier altéré.");
  }
}

const fileName = (date = new Date()) => `nauticash-${date.toISOString().slice(0, 10)}.ncbak`;

module.exports = { COLLECTIONS, MIN_KEY_LENGTH, encrypt, decrypt, fileName };
