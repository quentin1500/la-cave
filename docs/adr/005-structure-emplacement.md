# ADR-005 : Structure de l'emplacement d'une bouteille

## Statut
Accepté

## Contexte

Une bouteille dans une cave physique occupe un emplacement précis. L'application doit permettre de retrouver facilement une bouteille (« rang 3, colonne 4 »).

Plusieurs niveaux de granularité sont possibles, du plus simple au plus complexe.

## Décision

**Emplacement défini par deux champs numériques indépendants : `rang` et `colonne`.**

### Structure

| Champ | Type | Description |
|---|---|---|
| `rang` | entier ≥ 1 | Numéro de rang (horizontal, de haut en bas) |
| `colonne` | entier ≥ 1 | Numéro de colonne (vertical, de gauche à droite) |

### Affichage

- Interface publique : « Rang 3, Colonne 4 »
- Admin (formulaire) : deux champs numériques séparés

### Règles

- Les deux champs sont optionnels (une bouteille sans emplacement défini est valide)
- Il n'y a pas de contrainte d'unicité de l'emplacement en base (plusieurs bouteilles peuvent partager un emplacement dans un casier multi-places)
- La quantité (`quantite`) représente le nombre d'exemplaires à cet emplacement

## Conséquences

**Positif :**
- Simple à saisir et à comprendre
- Pas de configuration de la structure de cave requise
- Extensible : on peut afficher un plan visuel en Lot 2 à partir de ces coordonnées

**Négatif :**
- Pas de plan de cave interactif (reporté au Lot 2)
- Pas de gestion de cave avec plusieurs sections/armoires (cas d'usage non exprimé à ce stade)

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Texte libre (ex: « Casier A, rang 3 ») | Non structuré, difficile à filtrer/trier |
| Section + casier + rang + colonne (4 niveaux) | Trop complexe pour le besoin initial |
| Plan de cave cliquable (zones SVG) | Excellent en Lot 2, mais over-engineering pour le Lot 1 |

## Évolution prévue (Lot 2)

Introduction possible d'un champ `section` ou `armoire` si l'utilisateur possède plusieurs zones de stockage distinctes. Nécessitera un ADR de mise à jour.
