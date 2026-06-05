# ADR-003 : Authentification de l'interface admin

## Statut
Accepté (mis à jour — remplace la version initiale avec clé API distincte)

## Contexte

L'interface admin permet de modifier les données de la cave (ajout, modification, suppression de bouteilles). Elle doit être protégée pour n'être accessible qu'au propriétaire.

Contraintes :
- Le site est un frontend statique sur GitHub Pages — pas de serveur d'authentification
- La solution doit fonctionner sans dépendance externe
- Le mot de passe ne doit pas être stocké en clair dans le dépôt Git
- Minimiser le nombre de secrets à gérer

## Décision

**Authentification côté client par comparaison de hash SHA-256. Le hash du mot de passe est réutilisé directement comme token d'API pour les opérations d'écriture — aucune clé API distincte.**

### Mécanisme

1. L'utilisateur saisit son mot de passe dans `admin.html`
2. Le navigateur calcule le hash SHA-256 via l'API Web Crypto (native, sans lib)
3. Le hash calculé est comparé à `CONFIG.ADMIN_PASSWORD_HASH` (injecté par GitHub Actions)
4. Si le hash correspond, **ce même hash** est stocké en `sessionStorage` (c'est lui qui joue le rôle de token d'API)
5. Chaque requête d'écriture vers Apps Script inclut ce hash dans le corps de la requête
6. Apps Script compare le hash reçu à la valeur `ADMIN_PASSWORD_HASH` stockée dans ses Script Properties

```
Navigateur : SHA-256(mot_de_passe) → comparaison → stockage en sessionStorage
     ↓
Requête écriture : { action, data, apiKey: hash }
     ↓
Apps Script : hash_reçu === Script Properties["ADMIN_PASSWORD_HASH"] ?
```

### Injection des secrets (GitHub Actions)

```yaml
sed -i "s|__ADMIN_PASSWORD_HASH__|${{ secrets.ADMIN_PASSWORD_HASH }}|g" public/js/config.js
```

Un seul secret suffit : `ADMIN_PASSWORD_HASH`. Il est utilisé à la fois pour l'authentification côté client et comme référence côté Apps Script.

### Génération du hash

Voir `tools/generate-hash.html` : outil HTML standalone à ouvrir localement pour générer le hash SHA-256.

Le **même hash** doit être configuré :
- En secret GitHub `ADMIN_PASSWORD_HASH` (injection dans `config.js` par le CI)
- Dans les Script Properties d'Apps Script (propriété `ADMIN_PASSWORD_HASH`, via `setAdminPasswordHash()`)

## Limites connues et acceptées

| Limite | Mitigation |
|---|---|
| Le hash est visible dans le JS déployé | Acceptable : SHA-256 sans sel est résistant aux attaques courantes pour un usage personnel |
| Si le hash fuite, il peut être utilisé directement comme token | Même risque qu'une clé API distincte — acceptable pour un usage personnel |
| Pas de limitation de tentatives | Acceptable : usage personnel, pas d'attaque automatisée attendue |
| Session non chiffrée en `sessionStorage` | Acceptable : la session expire à la fermeture de l'onglet |

## Avantage par rapport à la version initiale

La version initiale utilisait deux secrets distincts (`ADMIN_PASSWORD_HASH` + `SHEETS_API_KEY`). Cette approche réduit à **un seul secret** à gérer, et crée un lien logique direct entre le mot de passe admin et l'autorisation d'écriture : changer le mot de passe invalide automatiquement les sessions existantes **et** les accès directs à l'API.

## Conséquences

**Positif :**
- Un seul secret GitHub à configurer et à maintenir
- Cohérence totale : le même facteur d'authentification protège l'interface et l'API
- Changer le mot de passe invalide immédiatement l'accès à l'API
- Aucune dépendance externe (Web Crypto natif)

**Négatif :**
- Sécurité côté client uniquement — analysable par un attaquant avec accès au code déployé
- SHA-256 sans sel est vulnérable aux rainbow tables pour les mots de passe courants (mitigation : choisir un mot de passe fort et unique)

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Clé API séparée (version initiale) | Deux secrets à gérer, découplage artificiel sans gain de sécurité réel |
| GitHub OAuth | Nécessite un backend pour gérer le flux OAuth |
| Google OAuth | Idem — requiert un serveur pour l'échange de tokens |
| Netlify Identity / Auth0 | Dépendance à une plateforme tierce |
| Pas d'auth | Inacceptable — n'importe qui pourrait modifier la cave |
