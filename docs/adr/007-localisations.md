# ADR-007 : Gestion des localisations de stockage

## Statut
Accepté

## Contexte

Une cave personnelle peut comporter plusieurs espaces de stockage distincts : cave principale, armoire à vins, réfrigérateur à vins, box de garde, etc. Jusqu'à présent, le modèle ne supportait qu'un seul espace implicite (champs `rang` et `colonne`). L'application doit permettre de :

- Définir plusieurs **localisations** nommées (ex: « Cave principale », « Armoire à vins »)
- Associer une bouteille à une localisation
- Disposer d'un **plan de cave visuel** (layout) indépendant par localisation
- Gérer les localisations depuis l'interface d'administration

## Décision

### Entité Localisation

```
Localisation
├─ id                UUID v4 généré côté client à la création
├─ nom               Chaîne libre — nom de l'espace de stockage
├─ description       Texte libre — description optionnelle
├─ date_creation     Chaîne ISO 8601 datetime (auto-générée)
└─ date_modification Chaîne ISO 8601 datetime (auto-mise à jour)
```

### Lien Bouteille → Localisation et Slot

Le modèle bouteille (ADR-006) reçoit deux nouveaux champs **optionnels** :

| Champ | Type | Description |
|---|---|---|
| `localisation` | UUID ou chaîne vide | Référence à une `Localisation` ; vide si non précisée |
| `slot_id` | UUID ou chaîne vide | Référence à un slot du plan de la localisation ; vide si non précisé |

`slot_id` ne peut être renseigné que si `localisation` l’est aussi. C’est le `id` du slot tel que défini dans le JSON du plan stocké dans l’onglet `Layouts`.

Ces deux champs sont positionnés après `colonne` dans les colonnes Google Sheets.

### Stockage Google Sheets

Deux nouveaux onglets sont créés automatiquement par Apps Script :

| Onglet | Structure | Description |
|---|---|---|
| `Localisations` | `id \| nom \| description \| date_creation \| date_modification` | Inventaire des espaces de stockage |
| `Layouts` | `localisation \| layout_json` | Un plan (JSON) par localisation |

L'ancien onglet `Layout` (cellule A1 unique) est **remplacé** par l'onglet `Layouts` multi-lignes.  
Les utilisateurs ayant un onglet `Layout` existant devront recréer leur plan dans une localisation.

### Actions API supplémentaires

| Méthode | Action | Auth requise |
|---|---|---|
| GET | `?action=getLocalisations` | Non |
| GET | `?action=getLayout&localisation_id=<id>` | Non |
| POST | `{ action: 'addLocalisation', data: {...}, apiKey }` | Oui |
| POST | `{ action: 'updateLocalisation', id, data: {...}, apiKey }` | Oui |
| POST | `{ action: 'deleteLocalisation', id, apiKey }` | Oui — supprime aussi le layout associé |
| POST | `{ action: 'saveLayout', localisation_id, data, apiKey }` | Oui |

### Interface d'administration

- Un bouton **« Gérer les localisations »** dans la barre d'outils remplace l'ancien « Éditer le plan de la cave »
- Le modal localisations liste toutes les localisations avec actions : **Plan**, **Modifier**, **Supprimer**
- L'éditeur de plan s'ouvre dans le contexte d'une localisation spécifique
- Le formulaire bouteille expose un **select « Localisation »** (optionnel)
- L'affichage de la colonne « Emplacement » dans le tableau inclut le nom de la localisation si renseigné

### Suppression d'une localisation

Lors de la suppression d'une localisation :
- Son layout associé est supprimé
- Les bouteilles référençant cette localisation conservent leur `localisation` (référence orpheline) — l'interface affiche « – » pour les bouteilles orphelines

## Conséquences

**Positif :**
- Support multi-espaces de stockage sans restructuration lourde
- Plan visuel éditable par localisation
- Association précise d’une bouteille à un emplacement (slot) du plan
- Champs `localisation` et `slot_id` optionnels : les bouteilles sans localisation restent valides
- Rétrocompatible : `rang` et `colonne` restent supportés
- Rétrocompatible : `rang` et `colonne` restent supportés

**Négatif :**
- Les utilisateurs ayant un layout existant (onglet `Layout`) devront le recréer manuellement
- Suppression d'une localisation laisse des `localisation` orphelins dans Bouteilles (acceptable pour usage personnel)
- Pas de nettoyage automatique des références lors de la suppression d'une localisation

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Champ texte libre « espace » sur la bouteille | Non structuré, pas de plan associé possible |
| Un onglet Layout_<id> par localisation | Prolifération d'onglets difficile à gérer dans Sheets |
| Suppression en cascade des bouteilles référencées | Trop destructeur pour une opération de réorganisation |
