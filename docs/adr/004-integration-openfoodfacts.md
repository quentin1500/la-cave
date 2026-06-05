# ADR-004 : Intégration de l'API OpenFoodFacts

## Statut
Accepté

## Contexte

Saisir manuellement toutes les informations d'une bouteille (producteur, cépages, volume, etc.) est fastidieux. Une source de données externe peut pré-remplir le formulaire d'ajout et accélérer la saisie.

OpenFoodFacts est une base de données alimentaire collaborative, ouverte et gratuite, qui contient des vins, champagnes et spiritueux avec leurs codes-barres.

## Décision

**Utiliser l'API OpenFoodFacts pour enrichir les données lors de l'ajout d'une bouteille, avec surcharge possible dans Google Sheets.**

### Principe de fonctionnement

```
Recherche OFF (code-barres ou nom)
         ↓
Données OFF → pré-remplissage du formulaire admin
         ↓
L'utilisateur complète / corrige les données
         ↓
Sauvegarde dans Google Sheets (données finales)
```

Les données sauvegardées dans Google Sheets **ont toujours la priorité** sur les données OFF.

### Endpoints utilisés

| Usage | URL |
|---|---|
| Recherche par code-barres | `https://world.openfoodfacts.org/api/v3/product/{barcode}.json` |
| Recherche par texte | `https://world.openfoodfacts.org/cgi/search.pl?search_terms={q}&json=1&page_size=10` |

### Mapping OFF → Bouteille

| Champ OFF | Champ bouteille | Notes |
|---|---|---|
| `product_name` | `cuvee` | Nom principal du produit |
| `brands` | `producteur` | Marque / producteur |
| `categories_tags` | `type` | Mapping depuis les catégories OFF |
| `origins` | `region` / `pays` | Origine géographique |
| `image_front_url` | `photo_url` | Image principale |
| `alcohol_100g` | `degre_alcool` | Teneur en alcool |
| `quantity` | `volume` | Contenance (parser pour extraire en ml) |
| `labels` | `appellation` | Appellation si disponible |

### Périmètre du Lot 1

- ✅ Recherche par **texte** (nom produit)
- ✅ Recherche par **code-barres** (saisie manuelle)
- ❌ Scan de code-barres via caméra → reporté au Lot 2 (ADR à créer)

### Politique d'utilisation

Conformément aux [conditions d'utilisation d'OFF](https://openfoodfacts.github.io/openfoodfacts-server/api/) :
- Usage personnel / non commercial : autorisé
- L'application identifie les requêtes via le header `User-Agent`

## Conséquences

**Positif :**
- Saisie accélérée, moins d'erreurs
- Base de données communautaire riche en produits français et européens
- API publique, gratuite, sans authentification requise
- CORS supporté nativement par OFF

**Négatif :**
- Qualité variable des données (base collaborative)
- Certains vins artisanaux ou rares absents de la base
- Dépendance à la disponibilité du service OFF (l'app fonctionne sans, avec saisie manuelle)

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Vivino API | API privée, nécessite partenariat |
| Wine-Searcher API | Payante |
| Saisie 100% manuelle | Fastidieux mais reste le fallback si OFF ne trouve rien |
