# Tester l'API Nauticash avec Postman

## Installation (5 minutes)

1. Postman → **Import** → glisser les 3 fichiers de ce dossier :
   `Nauticash.postman_collection.json`, `Nauticash-production.postman_environment.json`, `Nauticash-local.postman_environment.json`.
2. En haut à droite, choisir l'environnement **Nauticash – Production**.
3. Ouvrir l'environnement (icône œil → Edit) et renseigner :
   - `email` / `password` : votre compte Nauticash (ou un compte de test) ;
   - `ticker` : le titre à contrôler (NVDA par défaut) ;
   - `fmpApiKey` / `finnhubApiKey` : facultatif, seulement pour le dossier « Fournisseurs ». Ces variables sont de type *secret* et restent sur votre poste : ne les partagez pas.
4. Lancer **1 · Auth → Connexion** : le token est enregistré automatiquement, toutes les autres requêtes l'utilisent.

## Vérifier la cohérence des cours

1. **2 · Portefeuille → Portefeuille (contrôle des cours)** : l’onglet **Visualize** de la réponse affiche un tableau (lignes en rouge = problème ; détail aussi dans la Console)
   ticker / prix / veille / variation / date du cours / source / erreur. Les tests échouent si un cours n'est pas daté,
   n'a pas de veille ou si sa dernière actualisation a échoué.
2. Pour un titre suspect, mettre son ticker dans `ticker` puis lancer **5 · Admin → Diagnostic d'un titre** (compte listé dans
   `ADMIN_EMAILS` sur Railway) : comparaison du cours enregistré avec la réponse en direct de FMP, Finnhub et Yahoo
   (onglet Visualize : écart en %, erreur exacte de chaque fournisseur : 402 = hors offre FMP, 429 = trop de requêtes / IP bloquée…).
3. **5 · Admin → Actualiser un titre maintenant** corrige immédiatement un titre (sans les 15 min d'attente).
4. **6 · Fournisseurs → Yahoo – cours** donne la référence « marché » à comparer, sans passer par Nauticash.

Pour tout tester d'un coup : clic droit sur la collection → **Run collection** (décocher les requêtes Ajouter / Supprimer /
Créer un compte si vous ne voulez pas modifier votre portefeuille).

## Environnement local

**Nauticash – Local** pointe sur `http://localhost:5000` (backend lancé avec `npm run dev` dans `backend/`).
