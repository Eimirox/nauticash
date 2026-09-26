# Tests du backend

```bash
cd backend
npm test                 # lance tous les fichiers tests/*.test.js (node:test, Node >= 18)
TEST_VERBOSE=1 npm test  # affiche aussi les logs du serveur
node --test tests/portfolio.test.js   # un seul fichier
```

Aucune base ni clé API réelle n'est nécessaire, et aucune dépendance supplémentaire :

- **MongoDB simulée en mémoire** (`helpers/fakeDb.js`) : branchée sur `mongoose.connection.collection()`
  et sur les méthodes du modèle `User` utilisées par les routes.
- **API externes simulées** (`helpers/setup.js`) : `fetch()` est intercepté ; FMP (quote, profil, dividendes)
  et Resend (emails) répondent avec des données de test. Tout autre appel réseau fait échouer le test.
- **Variables d'environnement de test** fixées avant le chargement de l'app (le `.env` local n'est pas utilisé pour elles).
- Chaque fichier tourne dans son propre processus : quotas et rate limiting repartent de zéro.

| Fichier | Couverture |
| --- | --- |
| `auth.test.js` | inscription, connexion, `/me`, tokens invalides/expirés, anti brute-force, erreurs 404/JSON |
| `passwordReset.test.js` | mot de passe oublié, email envoyé, token hashé, expiration, usage unique, anti-spam |
| `portfolio.test.js` | ajout / lecture / modification / suppression, validation, isolation entre comptes, actualisation, cash |
| `history.test.js` | historique mensuel (upsert, tri chronologique, validation), transactions |
| `admin.test.js` | accès réservé à `ADMIN_EMAILS`, stats, health check, actualisation manuelle |
| `quotas.test.js` | quotas journaliers / par minute des API, comportement des routes quand le quota est atteint |

Si une route utilise une nouvelle opération MongoDB (ex. `deleteOne`, `$inc`), l'ajouter dans `helpers/fakeDb.js`.
