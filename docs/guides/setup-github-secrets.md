# Guide — Configuration des secrets GitHub

Ce guide explique comment configurer les secrets nécessaires au déploiement automatique.

Les secrets permettent d'injecter les valeurs sensibles (URL Apps Script, hash du mot de passe, clé API) dans le code **au moment du déploiement**, sans jamais les committer dans le dépôt.

---

## Pré-requis

- Avoir complété [setup-apps-script.md](setup-apps-script.md) → vous avez l'URL Apps Script et la clé API
- Avoir généré le hash du mot de passe admin → ouvrir `tools/generate-hash.html` dans votre navigateur

---

## Secrets à configurer

| Nom du secret | Description | Exemple |
|---|---|---|
| `SHEETS_API_URL` | URL de déploiement de votre Web App Apps Script | `https://script.google.com/macros/s/.../exec` |
| `ADMIN_PASSWORD_HASH` | Hash SHA-256 de votre mot de passe admin (en hexadécimal) | `a1b2c3d4...` (64 caractères) |
| `SHEETS_API_KEY` | Clé API configurée dans les Script Properties d'Apps Script | `lc-a8f3k2m9p7q1x5v` |

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
- **Secret** : l'URL Apps Script copiée à l'étape de déploiement

### Secret 2 : ADMIN_PASSWORD_HASH
- **Name** : `ADMIN_PASSWORD_HASH`
- **Secret** : le hash SHA-256 généré à l'étape 1

### Secret 3 : SHEETS_API_KEY
- **Name** : `SHEETS_API_KEY`
- **Secret** : la clé API configurée dans Apps Script

---

## Étape 3 — Déclencher un déploiement

Après avoir configuré tous les secrets :

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

## Rotation des secrets

Pour changer le mot de passe admin :
1. Générer un nouveau hash avec `tools/generate-hash.html`
2. Mettre à jour le secret `ADMIN_PASSWORD_HASH` dans GitHub
3. Faire un nouveau déploiement

Pour changer la clé API :
1. Mettre à jour la clé dans Apps Script (`setApiKey()`)
2. Mettre à jour le secret `SHEETS_API_KEY` dans GitHub
3. Faire un nouveau déploiement

---

## Dépannage

| Problème | Solution |
|---|---|
| Le workflow échoue | Vérifier les logs dans l'onglet Actions |
| La bannière démo persiste | Vérifier que `SHEETS_API_URL` est correctement configuré |
| Connexion admin refuse | Vérifier que le hash correspond bien au mot de passe (régénérer si doute) |
| Erreurs 401 dans la console | `SHEETS_API_KEY` incorrect ou différent de celui configuré dans Apps Script |
