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

### Feuille Google Sheets

- Nom de feuille : `Bouteilles`
- La première ligne contient les en-têtes (noms des champs)
- Chaque ligne suivante est une bouteille

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
| GET  | `?action=getLayout` | Non |
| POST | `{ action: 'add', data: {...}, apiKey }` | Oui |
| POST | `{ action: 'update', id, data: {...}, apiKey }` | Oui |
| POST | `{ action: 'delete', id, apiKey, comment }` | Oui — archive la ligne au lieu de la supprimer |
| POST | `{ action: 'saveLayout', data, apiKey }` | Oui |

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

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Firebase Firestore | Gratuit mais avec dépendance à un SDK JS externe |
| Supabase | Nécessite un backend + gestion d'un projet tiers |
| Fichier JSON dans le dépôt | Pas d'écriture possible depuis GitHub Pages sans GitHub API |
| localStorage uniquement | Données perdues si changement de navigateur/appareil |
