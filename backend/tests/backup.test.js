// Tests : sauvegarde chiffrée (aller-retour, mauvaise clé, fichier altéré)
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const backup = require("../services/backup");

const KEY = "une-phrase-secrete-assez-longue";
const data = { users: [{ email: "a@b.fr", portfolio: [{ ticker: "AAPL", quantity: 3 }] }], history: [] };

describe("Sauvegarde chiffrée", () => {
  test("aller-retour : on retrouve les données, et le fichier ne contient rien en clair", () => {
    const file = backup.encrypt(data, KEY);
    assert.deepEqual(backup.decrypt(file, KEY), data);
    assert.ok(!file.toString("latin1").includes("a@b.fr"));
  });

  test("mauvaise clé ou fichier altéré : refusé", () => {
    const file = backup.encrypt(data, KEY);
    assert.throws(() => backup.decrypt(file, "une-autre-phrase-tres-longue"), /Déchiffrement impossible/);
    const broken = Buffer.from(file);
    broken[broken.length - 1] ^= 1;
    assert.throws(() => backup.decrypt(broken, KEY), /Déchiffrement impossible/);
    assert.throws(() => backup.decrypt(Buffer.from("n'importe quoi"), KEY), /invalide/);
  });

  test("clé trop courte refusée ; nom de fichier daté", () => {
    assert.throws(() => backup.encrypt(data, "court"), /BACKUP_KEY/);
    assert.throws(() => backup.encrypt(data, undefined), /BACKUP_KEY/);
    assert.equal(backup.fileName(new Date("2026-11-15T10:00:00Z")), "nauticash-2026-11-15.ncbak");
  });
});
