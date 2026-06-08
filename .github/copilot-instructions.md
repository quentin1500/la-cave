# Instructions globales — La Cave

## Contexte du projet

Application web de gestion de cave à vins personnelle.
- **Frontend** : Vanilla JavaScript (ES6+), HTML5, CSS3 — aucun framework, aucun bundler
- **Hébergement** : GitHub Pages
- **Données** : Google Sheets via Apps Script
- **Enrichissement** : OpenFoodFacts API

## Règle fondamentale : respecter les ADRs

Avant toute décision technique (architecture, lib, pattern), consulter les ADRs dans `docs/adr/`.  
Si une décision contredit un ADR existant, signaler le conflit et proposer une mise à jour de l'ADR avant d'implémenter.

## Principes de développement

1. **Pas de dépendances externes** — pas de npm, pas de CDN pour des frameworks JS
2. **Interface en français** — tous les textes utilisateur, labels, messages d'erreur
3. **Sécurité XSS** — toujours utiliser `escapeHtml()` avant d'insérer du contenu dynamique dans le DOM
4. **Accessibilité** — attributs `aria-*`, navigation clavier, contraste suffisant
5. **Responsive first** — mobile compatible, grille CSS fluide
6. **Pas de over-engineering** — ne pas créer d'abstractions pour des opérations ponctuelles

## Conventions de code

- `'use strict'` en tête de chaque fichier JS
- Variables : `const` par défaut, `let` si mutation nécessaire, jamais `var`
- Fonctions privées suffixées `_` dans les modules (ex: `fetchData_()`)
- Commentaires en français pour les blocs métier, anglais acceptable pour les utilitaires
- Gestion d'erreur explicite avec messages utilisateur compréhensibles

## Structure des fichiers

```
public/js/
  config.js           → CONFIG, SAMPLE_BOTTLES, TYPE_LABELS, TYPE_COLORS
  auth.js             → Auth (hashPassword, verifyPassword, login, logout)
  sheets-api.js       → SheetsAPI (getAllBottles, addBottle, updateBottle, deleteBottle)
  openfoodfacts-api.js → OpenFoodFacts (getByBarcode, search, mapToBottle)
  public.js           → PublicApp (init, closeModal) — module IIFE
  admin.js            → AdminApp (init, showForm, hideForm, ...) — module IIFE
```

## Modèle de données bouteille

Voir `docs/adr/006-modele-donnees-bouteille.md` pour le modèle complet.  
Champs clés : `id, type, producteur, cuvee, millesime, appellation, region, pays, cepages, volume, degre_alcool, code_barres, photo_url, rang, colonne, date_achat, prix_achat, valeur_estimee, notes_personnelles`
