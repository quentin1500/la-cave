# 🍷 La Cave

Gestion personnelle de cave à vins, champagnes et spiritueux.  
Consultez votre collection, gérez les emplacements, suivez vos acquisitions.

---

## Fonctionnalités

| Interface | Description |
|---|---|
| **Publique** (`index.html`) | Consultation de la cave, filtres, fiches détaillées |
| **Admin** (`admin.html`) | Ajout, modification, suppression de bouteilles |

---

## Architecture technique

| Couche | Choix |
|---|---|
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 |
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
│   ├── instructions/               # Skills Copilot (scoped)
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
│   │   └── 006-modele-donnees-bouteille.md
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
    ├── index.html                  # Page publique
    ├── admin.html                  # Interface d'administration
    ├── css/
    │   └── style.css
    └── js/
        ├── config.js               # Configuration (placeholders remplacés par CI)
        ├── auth.js                 # Authentification admin
        ├── sheets-api.js           # Client API Google Sheets
        ├── openfoodfacts-api.js    # Client API OpenFoodFacts
        ├── public.js               # Logique page publique
        └── admin.js                # Logique interface admin
```

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

---

## Feuille de route

### Lot 1 (actuel)
- [x] Page publique avec filtres et fiches détaillées
- [x] Interface admin avec CRUD complet
- [x] Enrichissement via OpenFoodFacts (recherche texte)
- [x] Déploiement GitHub Pages avec injection de secrets

### Lot 2 (à venir)
- [ ] Lecture de code-barres via caméra (interface mobile)
- [ ] Visualisation graphique de l'emplacement (plan de cave)
- [ ] Export PDF / impression
- [ ] Historique des mouvements (achats, consommations)

---

*Projet personnel — aucune donnée n'est partagée avec des tiers en dehors de Google Sheets.*
