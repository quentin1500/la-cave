# ADR-006 : Modèle de données d'une bouteille

## Statut
Accepté

## Contexte

Le modèle de données est la pierre angulaire de l'application. Il doit couvrir :
- L'identification du produit (type, producteur, cuvée, millésime)
- La localisation géographique et l'appellation
- Les caractéristiques techniques (volume, degré)
- L'emplacement physique dans la cave
- Les informations d'acquisition
- Les notes personnelles

## Décision

### Modèle complet

```
Bouteille
├─ id                   UUID v4 généré côté client à la création
├─ type                 Valeur normalisée (voir table ci-dessous)
├─ producteur           Chaîne libre — nom du producteur / domaine / château
├─ cuvee                Chaîne libre — nom de la cuvée ou du produit
├─ millesime            Entier (année) ou chaîne vide
├─ appellation          Chaîne libre (ex: Margaux, Puligny-Montrachet)
├─ region               Chaîne libre (ex: Bordeaux, Bourgogne)
├─ pays                 Chaîne libre (ex: France, Écosse)
├─ cepages              Chaîne libre, cépages séparés par virgule
├─ volume               Entier en millilitres (ex: 750)
├─ degre_alcool         Décimal (ex: 13.5)
├─ code_barres          Chaîne (EAN-13 ou autre)
├─ photo_url            URL complète de l'image
├─ rang                 Entier ≥ 1 (voir ADR-005)
├─ colonne              Entier ≥ 1 (voir ADR-005)
├─ date_achat           Chaîne ISO 8601 (YYYY-MM-DD)
├─ prix_achat           Décimal en euros
├─ valeur_estimee       Décimal en euros (peut différer du prix d'achat)
├─ notes_personnelles   Texte libre (impressions, accords, occasions)
├─ date_creation        Chaîne ISO 8601 datetime (auto-générée)
└─ date_modification    Chaîne ISO 8601 datetime (auto-mise à jour)

### Archivage

Les bouteilles **ne sont pas supprimées** définitivement : elles sont archivées.
Champs ajoutés :

```
archived           Boolean (true si archivée)
archived_at        Chaîne ISO 8601 datetime de l'archivage
archive_comment    Texte libre — commentaire ajouté lors de l'archivage
```

Conséquence : l'interface publique n'affiche pas les bouteilles archivées, mais
l'historique est conservé et consultable via l'interface d'administration.
```

### Types normalisés

| Valeur (`type`) | Libellé affiché | Couleur UI |
|---|---|---|
| `rouge` | Vin Rouge | `#8B1A2A` |
| `blanc` | Vin Blanc | `#B89020` |
| `rose` | Vin Rosé | `#C05878` |
| `champagne` | Champagne | `#C8A035` |
| `cremant` | Crémant | `#8A9A40` |
| `mousseux` | Mousseux | `#608060` |
| `whisky` | Whisky | `#C06830` |
| `cognac` | Cognac | `#904820` |
| `armagnac` | Armagnac | `#804018` |
| `rhum` | Rhum | `#703810` |
| `autre` | Autre | `#605048` |

### Colonnes Google Sheets (ordre)

```
id | type | producteur | cuvee | millesime | appellation | region | pays |
cepages | volume | degre_alcool | code_barres | photo_url | rang | colonne |
date_achat | prix_achat | valeur_estimee | notes_personnelles |
date_creation | date_modification
```

### Identifiant

L'`id` est un UUID v4 généré côté client au moment de la création (pas d'auto-incrément en base).  
Génération : `crypto.randomUUID()` (API Web Crypto, disponible dans tous les navigateurs modernes).

## Conséquences

**Positif :**
- Modèle complet couvrant tous les cas d'usage exprimés
- Types normalisés permettant le filtrage et le coloriage

**Négatif :**
- Pas de gestion des fournisseurs / cavistes (hors périmètre)
- Pas d'historique de dégustation structuré (les notes libres compensent pour le Lot 1)

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Cépage(s) en tableau | Plus complexe à stocker dans Sheets — chaîne séparée par virgule suffit |
| Notation de 1 à 5 étoiles | Inclus dans les notes personnelles en Lot 1, peut être ajouté en Lot 2 |
| Prix en centimes (entier) | Décimal plus naturel pour la saisie utilisateur |
