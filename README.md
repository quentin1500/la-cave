# 🍷 La Cave

Gestion personnelle de cave à vins, champagnes et spiritueux.  
Consultez votre collection, gérez les emplacements, suivez vos acquisitions.

---

## Fonctionnalités

| Interface | Description |
|---|---|
| **Publique** (`index.html`) | Consultation de la cave, filtres, fiches détaillées et visualisation des localisations |
| **Admin** (`admin.html`) | Ajout, modification, archivage de bouteilles ; gestion des localisations et de leurs plans |

### Détail des fonctionnalités

**Interface publique** (`index.html`)
- Grille de bouteilles filtrables par type, région, pays, millésime et recherche texte
- Statistiques : nombre de références, types, régions, valeur estimée
- Fiche détaillée au clic : infos complètes, notes personnelles, note en étoiles (1-3 ★), emplacement
- **Note en étoiles** (1 à 3) affichée sur la carte et dans le détail de chaque bouteille
- Bouton **Localisations** dans le header ouvrant une pop-up dédiée
- Pop-up avec sélecteur de localisations et plan focalisé sur une localisation à la fois
- **Plan visuel** : slots positionnés avec les bouteilles affichées par couleur (type : rouge, blanc, etc.)
- **Info bouteille** : libellé court (producteur + cuvée) + note en étoiles (★★★) dans chaque slot
- Clic sur une bouteille → fiche détaillée complète (modal)
- **Accessible en mode offline** tant que la page publique reste ouverte après chargement initial

**Interface admin** (`admin.html`) (authentification par mot de passe)
- CRUD complet : ajout, modification, archivage (avec commentaire), restauration
- **Notation** : attribution d'une note de 1 à 3 étoiles via sélecteur interactif dans le formulaire
- Pré-remplissage des fiches depuis **OpenFoodFacts** (recherche par nom ou code-barres)
- **Gestion des localisations** : espaces de stockage nommés (cave, armoire à vins…) avec description
- **Éditeur de plan** par localisation : ajout et positionnement libre de slots (drag & drop)
- **Sélection visuelle de l'emplacement** dans le formulaire bouteille : le plan de la localisation s'affiche et l'on clique sur un slot pour y associer la bouteille
- Tableau des bouteilles actives et section archives avec détail consultable

---

## Architecture technique

| Couche | Choix |
|---|---|
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 — aucun framework, aucun bundler |
| **Hébergement** | GitHub Pages |
| **Base de données** | Google Sheets via Apps Script (API REST) |
| **Enrichissement** | API OpenFoodFacts |
| **Auth admin** | Hash SHA-256 (côté client) — le hash sert aussi de token d'API pour les écritures |
| **Secrets** | GitHub Actions injecte les valeurs au déploiement (2 secrets : `SHEETS_API_URL` + `ADMIN_PASSWORD_HASH`) |

---

## Structure du projet

```
la-cave/
├── .github/
│   ├── copilot-instructions.md     # Instructions globales pour GitHub Copilot
│   ├── instructions/               # Instructions Copilot (scoped)
│   │   ├── adr-compliance.instructions.md
│   │   └── code-style.instructions.md
│   └── workflows/
│       └── deploy.yml              # Déploiement GitHub Pages
│
├── docs/
│   ├── adr/                        # Architecture Decision Records
│   │   ├── 001-architecture-generale.md
│   │   ├── 002-persistance-google-sheets.md
│   │   ├── 003-authentification-admin.md
│   │   ├── 004-integration-openfoodfacts.md
│   │   ├── 005-structure-emplacement.md
│   │   ├── 006-modele-donnees-bouteille.md
│   │   ├── 007-localisations.md
│   │   ├── 008-chargement-complet-session-hors-reseau.md
│   │   └── 009-visualisation-plans-localisations.md
│   └── guides/                     # Guides de configuration
│       ├── setup-apps-script.md
│       ├── setup-github-pages.md
│       └── setup-github-secrets.md
│
├── scripts/
│   └── apps-script/
│       └── Code.gs                 # Code Google Apps Script (référence)
│
├── tools/
│   └── generate-hash.html          # Outil local pour générer le hash du MDP admin
│
└── public/                         # Site web (déployé sur GitHub Pages)
    ├── index.html                  # Page publique (grille de bouteilles + localisations)
    ├── admin.html                  # Interface d'administration
    ├── css/
    │   └── style.css
    └── js/
        ├── config.js               # Configuration (placeholders remplacés par CI)
        ├── auth.js                 # Authentification admin
        ├── sheets-api.js           # Client API Google Sheets
        ├── openfoodfacts-api.js    # Client API OpenFoodFacts
        ├── public.js               # Logique page publique (index.html)
        └── admin.js                # Logique interface admin
```

---

## Google Sheets — structure attendue

| Onglet | Rôle |
|---|---|
| `Bouteilles` | Inventaire principal (créé automatiquement par Apps Script) |
| `Localisations` | Espaces de stockage nommés (créé automatiquement à la première localisation) |
| `Layouts` | Plans visuels par localisation, JSON sérialisé (créé automatiquement au premier enregistrement de plan) |

---

## Démarrage rapide

### Pré-requis

1. Un compte GitHub
2. Un compte Google (pour Google Sheets + Apps Script)

### Étapes de configuration

1. **Forker / cloner** ce dépôt
2. **Configurer Google Sheets** → voir [docs/guides/setup-apps-script.md](docs/guides/setup-apps-script.md)
3. **Générer le hash du mot de passe admin** → ouvrir `tools/generate-hash.html` dans un navigateur
4. **Configurer les secrets GitHub** → voir [docs/guides/setup-github-secrets.md](docs/guides/setup-github-secrets.md)
5. **Activer GitHub Pages** → voir [docs/guides/setup-github-pages.md](docs/guides/setup-github-pages.md)
6. **Pousser sur `main`** → le déploiement se lance automatiquement

---

## Mode démonstration

Sans configuration, le site fonctionne avec des données d'exemple.  
Une bannière indique le mode démonstration sur la page publique.

---

## Documentation

- [ADR 001 – Architecture générale](docs/adr/001-architecture-generale.md)
- [ADR 002 – Persistance Google Sheets](docs/adr/002-persistance-google-sheets.md)
- [ADR 003 – Authentification admin](docs/adr/003-authentification-admin.md)
- [ADR 004 – Intégration OpenFoodFacts](docs/adr/004-integration-openfoodfacts.md)
- [ADR 005 – Structure emplacement](docs/adr/005-structure-emplacement.md)
- [ADR 006 – Modèle de données bouteille](docs/adr/006-modele-donnees-bouteille.md)
- [ADR 007 – Gestion des localisations](docs/adr/007-localisations.md)

---

## Feuille de route

### Lot 1 (actuel)
- [x] Page publique avec filtres et fiches détaillées
- [x] Interface admin avec CRUD complet et archivage
- [x] Enrichissement via OpenFoodFacts (recherche texte et code-barres)
- [x] Déploiement GitHub Pages avec injection de secrets
- [x] Gestion de plusieurs localisations de stockage
- [x] Éditeur de plan visuel (drag & drop) par localisation
- [x] Association bouteille → emplacement précis (slot) du plan
- [x] Visualisation du plan avec emplacement mis en évidence dans la fiche publique

### Lot 2 (à venir)
- [ ] Lecture de code-barres via caméra (interface mobile)
- [ ] Export PDF / impression
- [ ] Historique des mouvements (achats, consommations)

---

*Projet personnel — aucune donnée n'est partagée avec des tiers en dehors de Google Sheets.*

