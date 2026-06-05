# ADR-003 : Authentification de l'interface admin

## Statut
Accepté

## Contexte

L'interface admin permet de modifier les données de la cave (ajout, modification, suppression de bouteilles). Elle doit être protégée pour n'être accessible qu'au propriétaire.

Contraintes :
- Le site est un frontend statique sur GitHub Pages — pas de serveur d'authentification
- La solution doit fonctionner sans dépendance externe
- Le mot de passe ne doit pas être stocké en clair dans le dépôt Git

## Décision

**Authentification côté client par comparaison de hash SHA-256, avec une clé API distincte pour les opérations d'écriture.**

### Mécanisme

1. L'utilisateur saisit son mot de passe dans `admin.html`
2. Le navigateur calcule le hash SHA-256 via l'API Web Crypto (native, sans lib)
3. Le hash est comparé à `CONFIG.ADMIN_PASSWORD_HASH` (injecté par GitHub Actions depuis les secrets)
4. Si le hash correspond, la clé API (`CONFIG.SHEETS_API_KEY`) est stockée en `sessionStorage`
5. Chaque requête d'écriture vers Apps Script inclut cette clé API dans le corps de la requête
6. Apps Script valide la clé API côté serveur (Script Properties)

### Injection des secrets (GitHub Actions)

```yaml
sed -i "s|__ADMIN_PASSWORD_HASH__|${{ secrets.ADMIN_PASSWORD_HASH }}|g" public/js/config.js
sed -i "s|__SHEETS_API_KEY__|${{ secrets.SHEETS_API_KEY }}|g" public/js/config.js
```

Les placeholders `__ADMIN_PASSWORD_HASH__` et `__SHEETS_API_KEY__` dans `config.js` sont remplacés **au moment du déploiement** et ne sont jamais présents dans le code source committé.

### Génération du hash

Voir `tools/generate-hash.html` : outil HTML standalone à ouvrir localement pour générer le hash.

## Limites connues et acceptées

| Limite | Mitigation |
|---|---|
| Le hash est visible dans le JS déployé | Acceptable : SHA-256 sans sel est résistant aux attaques courantes pour un usage personnel |
| La clé API est visible dans `admin.html` déployé | Acceptable : seul le propriétaire connaît l'URL admin ; la clé ne protège que les écritures |
| Pas de limitation de tentatives | Acceptable : usage personnel, pas d'attaque automatisée attendue |
| Session non chiffrée en `sessionStorage` | Acceptable : la session expire à la fermeture de l'onglet |

## Conséquences

**Positif :**
- Aucune dépendance externe (Web Crypto est nativement disponible dans tous les navigateurs modernes)
- Simple à mettre en œuvre et à maintenir
- Le mot de passe ne transite jamais (seul le hash est stocké/comparé)

**Négatif :**
- Sécurité côté client uniquement — un attaquant déterminé avec accès au code déployé pourrait analyser le mécanisme
- SHA-256 sans sel est vulnérable aux rainbow tables pour les mots de passe courants (mitigation : choisir un mot de passe fort)

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| GitHub OAuth | Nécessite un backend pour gérer le flux OAuth |
| Google OAuth | Idem — requiert un serveur pour l'échange de tokens |
| Netlify Identity / Auth0 | Dépendance à une plateforme tierce |
| Pas d'auth | Inacceptable — n'importe qui pourrait modifier la cave |
