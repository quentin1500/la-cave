# Guide — Configuration des secrets GitHub

Ce guide explique comment configurer les secrets nécessaires au déploiement automatique.

Les secrets permettent d'injecter les valeurs sensibles (URL Apps Script, hash du mot de passe) dans le code **au moment du déploiement**, sans jamais les committer dans le dépôt.

---

## Pré-requis

- Avoir complété [setup-apps-script.md](setup-apps-script.md) → vous avez l'URL Apps Script et le hash est configuré dans Apps Script
- Avoir généré le hash du mot de passe admin → ouvrir `tools/generate-hash.html` dans votre navigateur

---

## Secrets à configurer (2 au total)

| Nom du secret | Description | Exemple |
|---|---|---|
| `SHEETS_API_URL` | URL de déploiement de votre Web App Apps Script | `https://script.google.com/macros/s/.../exec` |
| `ADMIN_PASSWORD_HASH` | Hash SHA-256 de votre mot de passe admin (hexadécimal, 64 caractères) | `a1b2c3d4...` |

> Ce hash joue un double rôle : il authentifie la connexion *et* sert de clé API pour les écritures vers Google Sheets. Voir [ADR-003](../adr/003-authentification-admin.md).

---

## Étape 1 — Générer le hash du mot de passe

1. **Ouvrir** le fichier `tools/generate-hash.html` dans votre navigateur (double-clic sur le fichier)
2. Saisir votre mot de passe admin dans le champ
3. Cliquer sur **Générer le hash**
4. **Copier** le hash SHA-256 affiché (64 caractères hexadécimaux)

> 💡 Choisissez un mot de passe fort (12+ caractères, chiffres, symboles).

---

## Étape 2 — Configurer les secrets dans GitHub

1. Ouvrir votre dépôt sur **GitHub.com**
2. Onglet **Settings** → section **Secrets and variables** → **Actions**
3. Cliquer sur **New repository secret** pour chaque secret :

### Secret 1 : SHEETS_API_URL
- **Name** : `SHEETS_API_URL`
- **Secret** : l'URL Apps Script copiée lors du déploiement (guide Apps Script, étape 4)

### Secret 2 : ADMIN_PASSWORD_HASH
- **Name** : `ADMIN_PASSWORD_HASH`
- **Secret** : le hash SHA-256 généré à l'étape 1

---

## Étape 3 — Déclencher un déploiement

Après avoir configuré les deux secrets :

1. Faire un `git push` sur la branche `main`

   **OU**

2. Onglet **Actions** → workflow **Déploiement GitHub Pages** → **Run workflow**

Vérifier que le workflow s'exécute sans erreur (✅ vert).

---

## Vérification

Après déploiement :

1. Visiter votre site GitHub Pages : `https://VOTRE_USERNAME.github.io/la-cave/`
2. La bannière de démonstration ne doit **plus** apparaître
3. Visiter `https://VOTRE_USERNAME.github.io/la-cave/admin.html`
4. Tester la connexion avec votre mot de passe

---

## Rotation du mot de passe admin

Pour changer le mot de passe :
1. Générer un nouveau hash avec `tools/generate-hash.html`
2. Mettre à jour le secret GitHub `ADMIN_PASSWORD_HASH`
3. Mettre à jour la Script Property `ADMIN_PASSWORD_HASH` dans Apps Script (relancer `setAdminPasswordHash()`)
4. Faire un nouveau déploiement

> Une seule valeur à synchroniser entre GitHub et Apps Script — plus de clé API séparée à gérer.

---

## Dépannage

| Problème | Solution |
|---|---|
| Le workflow échoue | Vérifier les logs dans l'onglet Actions |
| La bannière démo persiste | Vérifier que `SHEETS_API_URL` est correctement configuré |
| Connexion admin refuse | Vérifier que le hash dans GitHub correspond bien au mot de passe (regénérer si doute) |
| Erreurs 401 dans la console | Le hash dans Apps Script (`ADMIN_PASSWORD_HASH` Script Property) ne correspond pas à celui dans GitHub |
| La bannière démo persiste | Vérifier que `SHEETS_API_URL` est correctement configuré |
| Connexion admin refuse | Vérifier que le hash correspond bien au mot de passe (régénérer si doute) |
| Erreurs 401 dans la console | `SHEETS_API_KEY` incorrect ou différent de celui configuré dans Apps Script |
