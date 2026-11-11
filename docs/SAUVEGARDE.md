# Sauvegarde de la base de données

Le cluster MongoDB Atlas gratuit (M0) n'a **pas de sauvegarde automatique**. Une tâche GitHub Actions exporte chaque semaine
les données précieuses (`users`, `history`, `history_daily`, `transactions`) dans un fichier **chiffré** (`.ncbak`).
Les caches (prix, indices, recherche) ne sont pas sauvegardés : ils se reconstruisent seuls.

## Mise en place (une seule fois)

1. Atlas > *Network Access* : autoriser les adresses de GitHub (en pratique `0.0.0.0/0`, comme pour Railway).
2. GitHub > dépôt > *Settings* > *Secrets and variables* > *Actions* > *New repository secret* :
   - `MONGO_URI` : la même valeur que sur Railway ;
   - `BACKUP_KEY` : une phrase secrète d'au moins 16 caractères. **Conserve-la ailleurs** (gestionnaire de mots de passe) : sans elle, les sauvegardes sont illisibles.
3. Onglet *Actions* > *Sauvegarde base de données* > *Run workflow* pour un premier essai.

## Où sont les fichiers

Onglet *Actions* > l'exécution > section *Artifacts* > `sauvegarde-nauticash` (conservé 90 jours).
Le dépôt étant public, **ces fichiers sont téléchargeables par tout compte GitHub** : seul le chiffrement protège les données.
Télécharge de temps en temps un fichier et garde-le sur ton ordinateur ou un disque externe.

## Lancer à la main

```
cd backend
MONGO_URI="..." BACKUP_KEY="phrase secrète" node scripts/backup.js
```

## Vérifier / restaurer

```
BACKUP_KEY="phrase secrète" node scripts/decryptBackup.js nauticash-2026-11-15.ncbak sortie.json
```

Le JSON contient les données en clair (format EJSON) : à supprimer après usage. Pour restaurer, demander de l'aide :
on réinjecte les collections avec `EJSON.deserialize`, jamais en écrasant la base à l'aveugle.
