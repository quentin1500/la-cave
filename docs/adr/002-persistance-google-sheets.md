# ADR-002 : Persistance des données via Google Sheets

## Statut
Accepté

## Contexte

L'application est un frontend statique (GitHub Pages), sans backend propre. Il faut néanmoins persister des données (liste des bouteilles) de manière :
- Durable et sauvegardée
- Modifiable hors application (directement dans un tableur)
- Accessible via une API HTTP depuis le navigateur
- Gratuite

## Décision

**Google Sheets comme base de données, exposé via Google Apps Script (Web App).**

### Architecture

```
Navigateur  →  fetch()  →  Apps Script Web App  →  Google Sheets
```

### Apps Script

- Déployé comme **Web App** accessible à « Tout le monde »
- Supporte GET (lecture publique) et POST (écritures authentifiées par clé API)
- La clé API est stockée dans les **Script Properties** (non exposée dans le code source)
- Toute opération d'écriture valide la clé API avant d'exécuter

### Feuilles Google Sheets

- Feuille `Bouteilles` : inventaire principal — la première ligne contient les en-têtes, chaque ligne suivante est une bouteille
- Feuille `Localisations` : espaces de stockage — `id | nom | description | date_creation | date_modification` ; créée automatiquement par Apps Script si absente
- Feuille `Layouts` : plans visuels par localisation — `localisation | layout_json` ; créée automatiquement par Apps Script lors du premier enregistrement de plan

### Contournement CORS

Apps Script ne gère pas les requêtes OPTIONS (preflight CORS).  
**Solution** : utiliser `Content-Type: text/plain` pour les requêtes POST.  
Le corps reste du JSON mais ce content-type déclenche une « requête simple » sans preflight.  
Le fetch doit inclure `redirect: 'follow'` pour suivre la redirection 302 d'Apps Script.

```javascript
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(payload),
  redirect: 'follow',
});
```

### Actions exposées

| Méthode | Action | Auth requise |
|---|---|---|
| GET  | `?action=getAll` | Non (lecture publique) |
| GET  | `?action=getLocalisations` | Non |
| GET  | `?action=getLayout&localisation_id=<id>` | Non |
| POST | `{ action: 'add', data: {...}, apiKey }` | Oui |
| POST | `{ action: 'update', id, data: {...}, apiKey }` | Oui |
| POST | `{ action: 'delete', id, apiKey, comment }` | Oui — archive la ligne au lieu de la supprimer |
| POST | `{ action: 'addLocalisation', data: {...}, apiKey }` | Oui |
| POST | `{ action: 'updateLocalisation', id, data: {...}, apiKey }` | Oui |
| POST | `{ action: 'deleteLocalisation', id, apiKey }` | Oui — supprime aussi le layout associé |
| POST | `{ action: 'saveLayout', localisation_id, data, apiKey }` | Oui |

### Écriture des ajouts en lot

- Le navigateur réutilise l'action `add` existante, avec **un appel séquentiel par bouteille** et un UUID généré côté client pour chaque fiche (ADR-006). Aucune action API de création en masse ni migration Apps Script n'est nécessaire.
- Les données communes sont copiées pour chaque appel ; l'emplacement est propre à chaque bouteille selon les sélections du formulaire (ADR-007).
- Le formulaire indique la progression et empêche les soumissions multiples ainsi que sa fermeture pendant l'enregistrement.
- Le lot n'est **pas transactionnel** : au premier échec, les enregistrements confirmés sont conservés, sans annulation automatique.
- Après un succès partiel, la quantité et les emplacements du formulaire sont réduits aux seuls ajouts non confirmés. Les informations communes sont conservées et la liste des bouteilles est rechargée ; une nouvelle soumission ne rejoue pas les ajouts déjà confirmés.
- Un échec réseau peut survenir après une écriture réussie mais avant la réception de sa confirmation. L'API ne garantit pas l'idempotence d'une nouvelle soumission : l'interface demande de vérifier la cave avant de réessayer et ne lance pas de nouvelle tentative automatique.

## Conséquences

**Positif :**
- Gratuit, robuste, données directement lisibles/éditables dans Sheets
- Pas de backend à héberger ou maintenir
- Google gère la sauvegarde, la redondance et la disponibilité

**Négatif :**
- Latence plus élevée qu'une vraie base de données (~500 ms à ~2 s)
- Pas de requêtes complexes (filtrage côté client uniquement)
- Limites Apps Script : 6 min/exécution, quotas journaliers (largement suffisants pour usage personnel)
- Données en clair dans Google Sheets (acceptable pour une cave personnelle)
- La durée d'un ajout en lot augmente avec le nombre d'appels ; des succès partiels et des confirmations perdues sont possibles, sans garantie de création atomique ni d'absence de doublons après une reprise manuelle

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Firebase Firestore | Gratuit mais avec dépendance à un SDK JS externe |
| Supabase | Nécessite un backend + gestion d'un projet tiers |
| Fichier JSON dans le dépôt | Pas d'écriture possible depuis GitHub Pages sans GitHub API |
| localStorage uniquement | Données perdues si changement de navigateur/appareil |
