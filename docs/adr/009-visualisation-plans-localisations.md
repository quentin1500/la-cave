# ADR-009 : Visualisation des plans de localisations (page publique)

## Statut
Accepté

## Contexte

L'application dispose d'une gestion multi-localisation (ADR-007) avec des plans visuels (layouts) stockés en Google Sheets. Actuellement, les plans sont visibles uniquement dans l'interface d'administration lors de l'édition.

Les utilisateurs souhaitent pouvoir consulter visuellement où se trouvent leurs bouteilles dans la cave depuis la page **publique**, sans authentification.

## Décision

### Pop-up publique dans `index.html`

La visualisation des localisations est intégrée dans la page publique existante, sous forme d'une pop-up dédiée ouverte depuis le header après le chargement initial des données.

#### Flux de données

1. **Initialisation** (`index.html` via `public.js`)
   - Charge les bouteilles, localisations et tous les layouts via API publique
   - Conserve ces données uniquement dans la mémoire JavaScript de la page

2. **Navigation** 
   - Lien "Voir les localisations" dans le header de `index.html`
   - Ouvre une pop-up `Localisations`

3. **Pop-up localisations** (dans `public.js`)
   - Filtre les localisations qui ont un layout défini
   - Affiche une liste de localisations dans un panneau lateral ou horizontal selon la largeur de l'ecran
   - Affiche un seul plan a la fois pour privilegier la lisibilite
   - Chaque slot affiche une **vignette bouteille** : couleur (par type), libellé court, note (★★★)
   - Clic sur une bouteille → modal détail identique à `index.html`

#### Rendu des bouteilles dans les slots

- **Couleur** : `--c-type-<type>` (rouge → #8B1A2A, blanc → #B89020, etc.)
- **Libellé** : format court `"Producteur Cuvée"` (truncaté si trop long)
- **Note** : affichée sous le libellé (1-3 étoiles : ★☆☆, ★★☆, ★★★)
- **Interaction** : survol = surbrillance, clic = ouverture du modal

#### Gestion des cas limites

| Cas | Comportement |
|---|---|
| Localisation sans layout | Ignorée dans la liste |
| Bouteille sans `slot_id` dans la localisation | Non affichée sur le plan |
| Bouteille archivée | Exclue de l'affichage |
| Mode offline | Utilisation du snapshot déjà chargé en mémoire tant que la page reste ouverte |

### Partage du modal de détail

Le modal existant dans `index.html` est réutilisé (mêmes styles, même logique d'affichage).

## Conséquences

**Positif :**
- Consultation publique complète du plan de cave sans authentification
- Cohérent avec ADR-008 : données en mémoire volatile de la page, sans stockage navigateur additionnel
- Réutilisation du modal de détail existant
- UX plus lisible : une seule localisation visible a la fois dans une pop-up dimensionnee pour l'ecran
- Pas de complexité côté backend : consultation en lecture seule

**Négatif :**
- La vue localisations n'est pas isolée sur une URL dédiée
- La consultation demande une interaction supplementaire (ouverture de la pop-up)
- Le mode hors réseau ne survit pas à un rechargement de page, conformément à ADR-008

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Intégrer le plan uniquement dans le modal de chaque bouteille | Contexte limité, moins pédagogique qu'une pop-up dédiée |
| Affichage iframe du plan Google Sheet | Non standard, complexe à configurer, offline impossible |
| Page dédiée + cache navigateur (`sessionStorage`, `localStorage`, IndexedDB) | Plus fragile et moins cohérent avec ADR-008 pour ce besoin |
| Plan éditable sur page publique | Risque de sécurité (même en lecture seule, augmente la surface d'attaque) |
