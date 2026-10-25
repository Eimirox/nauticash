# Formule VIP (socle, sans paiement)

Objectif : pouvoir réserver plus tard certains écrans à une formule payante, sans rien changer aujourd'hui pour les utilisateurs.

## Ce qui existe
- Chaque compte a une formule : `free` (par défaut) ou `vip` (champ `plan`, `backend/models/user.js`).
- Écrans concernés : **Objectifs** et **Stratégie**. Sans accès, ils affichent une page « Formule VIP » (`frontend/app/components/VipLockedPage.js`).
- Côté serveur (`backend/services/plans.js`) : les champs propres à ces écrans (rente visée, épargne mensuelle, rendement, dividende visé, inflation, stratégie, allocation cible, poids maximal) sont refusés avec une erreur 403 `VIP_REQUIRED` pour un compte gratuit. L'objectif de patrimoine simple, la date, l'horizon, le profil de risque et les dépenses mensuelles restent gratuits (ils alimentent le Tableau de bord).
- `GET /api/user/profile` renvoie `plan`, `vipEnforced` et `access`.
- La formule ne peut pas être modifiée par l'utilisateur (le profil refuse le champ `plan`).

## Activer le verrouillage
- Variable Railway **`VIP_ENFORCED=true`**. Tant qu'elle n'est pas définie, **tout le monde garde l'accès** à tout.
- Les comptes listés dans `ADMIN_EMAILS` ont toujours accès.

## Passer un compte en VIP (administrateur)
`POST /api/admin/users/plan` avec `{ "email": "client@exemple.fr", "plan": "vip" }` (jeton d'un compte admin). Remettre `free` pour retirer l'accès.

## Pas encore fait (à décider plus tard)
- Paiement et abonnement en ligne (ex. Stripe) : webhook qui passe `plan` à `vip` / `free`.
- Mentions légales, CGV, TVA et facturation avant d'encaisser.
- Écran de présentation des formules et bouton d'abonnement.
- Autres fonctions réservées VIP : ajouter leur nom dans `VIP_FEATURES` et leurs champs dans `VIP_PROFILE_FIELDS`.

## Journal
- 2026-10-25 – Socle VIP créé : champ `plan`, droits côté serveur, route admin, page « Formule VIP », tests (`backend/tests/plans.test.js`).
