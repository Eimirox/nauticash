# Direction artistique Nauticash

Référence pour toutes les évolutions visuelles du site. En cas de doute, ce fichier fait foi.

## Intention

Nauticash aide à **tenir le cap de son patrimoine boursier** : voir en un coup d'œil où l'on en est, d'où vient la performance et ce que rapportent les dividendes.
L'univers est celui de la **navigation** (cap, boussole, cartes marines, profondeurs) traité de façon **sobre et premium** : pas de clipart marin, pas d'ancre ni de vagues illustrées. Les chiffres sont les héros de l'interface.

Concept de produit proche d'un agrégateur de patrimoine, **identité strictement propre** : aucune reprise de nom, de texte, de mise en page ou de visuel d'un autre service.

## Palette

Les couleurs sont exposées en variables CSS (`app/globals.css`) puis mappées dans Tailwind (`tailwind.config.mjs`). Ne jamais écrire une couleur en dur dans un composant quand un jeton existe.

| Jeton | Rôle | Clair | Sombre |
|---|---|---|---|
| `--bg` | Fond de page | `#F7F8F6` (blanc cassé « écume ») | `#0B1B2B` (bleu « abysse ») |
| `--surface` | Cartes, panneaux | `#FFFFFF` | `#11263A` |
| `--surface-2` | Survol, zones secondaires | `#EEF2F1` | `#16304A` |
| `--border` | Bordures, séparateurs | `#DDE3E1` | `#1F3B57` |
| `--text` | Texte principal | `#0B1B2B` | `#E8EEF2` |
| `--text-muted` | Texte secondaire | `#51606E` | `#9FB0BF` |
| `--accent` | « Lagon » : action principale, liens, focus | emerald-600 `#059669` | emerald-400 `#34D399` |
| `--accent-2` | Bleu secondaire : graphiques, informations | blue-600 `#2563EB` | blue-400 `#60A5FA` |
| `--gain` | Variation positive | `#15803D` | `#4ADE80` |
| `--loss` | Variation négative | `#B91C1C` | `#F87171` |
| `--warn` | Alerte douce (quota, données anciennes) | `#B45309` | `#FBBF24` |

Règles :
- Les couleurs gain/perte ne sont **jamais le seul indicateur** : toujours un signe (+ / −) ou une flèche ▲▼.
- Le dégradé emerald → blue existant est réservé au logo et au bouton principal, un seul par écran.
- Graphiques : séries dans l'ordre accent, accent-2, puis teintes intermédiaires (teal, cyan, indigo, slate). Éviter le rouge/vert pour des catégories.

## Typographie

- Police : Geist (déjà chargée) ; Geist Mono pour les tickers.
- **Chiffres tabulaires** partout où des montants s'alignent : classe `tabular-nums`.
- Hiérarchie des montants : valeur du patrimoine `text-4xl sm:text-5xl font-semibold` ; KPI `text-2xl font-semibold` ; tableau `text-sm`.
- Formats : `Intl.NumberFormat("fr-FR")` ; devise après le montant (« 12 345,67 € ») ; pourcentages avec signe (« +3,2 % »).

## Signature visuelle

1. **Lignes de niveau (bathymétrie)** : motif SVG très discret (opacité 4 à 6 %) en fond de l'en-tête et des pages vides. Jamais derrière un tableau de chiffres.
2. **La boussole du logo** : réutilisée comme indicateur de chargement (rotation lente) et dans les états vides.
3. **Le cap** : la variation du jour est présentée comme un cap (flèche orientée), à côté de la valeur totale.

## Composants

Composants de base dans `frontend/app/components/ui/` : `Card`, `Button`, `Stat`, `Badge`, `Modal`, `Toast`.

- **Card** : `rounded-2xl`, bordure `--border`, fond `--surface`, ombre légère, padding `p-5 sm:p-6`.
- **Button** : variantes `primary` (dégradé ou accent), `secondary` (surface + bordure), `ghost`, `danger`. Hauteur min. 40 px (44 px sur mobile).
- **Stat** : libellé en petites capitales `text-xs uppercase tracking-wide text-muted`, valeur en grand, variation en dessous.
- **Badge** : type d'actif (Action, ETF, Crypto) avec couleurs douces et texte lisible.
- **Modal** : confirmation d'action destructive ; focus piégé, fermeture par Échap.
- **Toast** : succès / erreur / info, en bas à droite (bas centré sur mobile), disparition après 4 s, lu par les lecteurs d'écran (`role="status"`).

## Mouvement

framer-motion est disponible. Animations **sobres** : apparition en fondu + 8 px de translation, 150 à 250 ms. Aucune animation sur les chiffres qui changent en continu. Respecter `prefers-reduced-motion`.

## Mise en page

- **Mobile d'abord** : tout écran doit fonctionner à 360 px sans défilement horizontal de la page.
- Largeur max. du contenu `max-w-7xl`, marges `px-4 sm:px-6 lg:px-8`.
- Beaucoup d'espace : `gap-4` à `gap-6` entre cartes.
- Mode clair et mode sombre : suivre la préférence du système, avec un bouton pour forcer l'un ou l'autre (mémorisé localement).

## Accessibilité (niveau AA)

- Contraste texte ≥ 4,5:1 (≥ 3:1 pour les grands textes et les éléments d'interface).
- Focus toujours visible : anneau `ring-2` couleur `--accent`, décalé de 2 px.
- Boutons icônes avec `aria-label` ; champs avec `<label>` associé.
- Textes en français, `lang="fr"`.
