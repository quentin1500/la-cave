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

### Sélection des emplacements pour un lot

- Un ajout de plusieurs bouteilles exige exactement autant de couples `localisation` / `slot_id` distincts que de bouteilles demandées. Cette règle concerne la sélection du lot, pas l'unicité en base.
- Les sélections sont conservées en mémoire dans le formulaire lors du passage d'une localisation à une autre ; un même `slot_id` dans deux localisations désigne deux emplacements différents.
- Un clic, la touche Entrée ou la barre d'espace permet de sélectionner ou désélectionner un slot. Le nombre de sélections ne peut pas dépasser la quantité demandée.
- Les emplacements sont affectés aux bouteilles dans l'ordre de sélection. Une diminution de quantité conserve les premières sélections ; un retour à une bouteille affiche la localisation de l'emplacement retenu.
- L'ajout unitaire conserve la possibilité de ne pas préciser d'emplacement, conformément aux ADR-005 et ADR-006.

### Indication d'occupation non bloquante

- L'occupation est calculée côté client à partir des bouteilles déjà chargées, par couple `localisation` / `slot_id`. Aucun champ d'occupation, appel API spécifique ou réservation n'est ajouté.
- Seules les bouteilles non archivées sont comptées ; la bouteille en cours d'édition est exclue du calcul pour éviter un conflit avec elle-même.
- Chaque case affiche « Libre » ou « Occupé ». Une bordure distincte signale les cases occupées ; ce statut reste lisible même si la case est sélectionnée.
- Le nombre et le détail des occupants sont disponibles dans l'infobulle et dans le libellé accessible du slot.
- Un avertissement visible et annoncé aux lecteurs d'écran récapitule les emplacements occupés sélectionnés, y compris dans d'autres localisations. Il est actualisé à la désélection et réinitialisé à la fermeture du formulaire.
- Une place occupée reste sélectionnable et l'avertissement ne bloque ni l'ajout unitaire, ni l'ajout en lot, ni la modification. Plusieurs bouteilles peuvent partager un emplacement (ADR-005).
- Cette indication reflète les dernières données chargées, sans garantie contre les modifications concurrentes. Elle ne constitue pas un contrôle d'intégrité côté serveur.

### Suppression d'une localisation

Lors de la suppression d'une localisation :
- Son layout associé est supprimé
- Les bouteilles référençant cette localisation conservent leur `localisation` (référence orpheline) — l'interface affiche « – » pour les bouteilles orphelines

## Conséquences

**Positif :**
- Support multi-espaces de stockage sans restructuration lourde
- Plan visuel éditable par localisation
- Association précise d’une bouteille à un emplacement (slot) du plan
- Affectation individuelle des bouteilles d'un lot et visibilité des occupations, sans changement du stockage ou de l'API
- Champs `localisation` et `slot_id` optionnels : les bouteilles sans localisation restent valides
- Rétrocompatible : `rang` et `colonne` restent supportés
- Rétrocompatible : `rang` et `colonne` restent supportés

**Négatif :**
- Les utilisateurs ayant un layout existant (onglet `Layout`) devront le recréer manuellement
- Suppression d'une localisation laisse des `localisation` orphelins dans Bouteilles (acceptable pour usage personnel)
- Pas de nettoyage automatique des références lors de la suppression d'une localisation
- Une occupation peut devenir obsolète si un autre utilisateur modifie la cave ; les conflits restent autorisés et sont seulement signalés

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Champ texte libre « espace » sur la bouteille | Non structuré, pas de plan associé possible |
| Un onglet Layout_<id> par localisation | Prolifération d'onglets difficile à gérer dans Sheets |
| Suppression en cascade des bouteilles référencées | Trop destructeur pour une opération de réorganisation |
| Bloquer la sélection ou la sauvegarde d'un emplacement occupé | Contraire au besoin d'avertissement non bloquant et au partage possible d'un emplacement |
