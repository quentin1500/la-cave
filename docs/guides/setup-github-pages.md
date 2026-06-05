# Guide — Activation de GitHub Pages

Ce guide explique comment activer GitHub Pages pour héberger l'application La Cave.

---

## Pré-requis

- Le dépôt est public **OU** vous avez un plan GitHub Pro/Team (Pages gratuit uniquement sur repos publics)
- Le workflow GitHub Actions est configuré (`.github/workflows/deploy.yml`)
- Les secrets GitHub sont configurés (voir [setup-github-secrets.md](setup-github-secrets.md))

---

## Étape 1 — Activer GitHub Pages

1. Ouvrir votre dépôt sur **GitHub.com**
2. Onglet **Settings** → section **Pages** (dans le menu de gauche)
3. Dans **Build and deployment** :
   - **Source** : sélectionner **Deploy from a branch**
   - **Branch** : sélectionner **`gh-pages`** / **`/ (root)`**
4. Cliquer sur **Save**

> La branche `gh-pages` sera créée automatiquement par GitHub Actions lors du premier déploiement.

---

## Étape 2 — Premier déploiement

1. S'assurer que le code est committé et poussé sur `main` :
   ```bash
   git add .
   git commit -m "feat: initialisation du projet La Cave"
   git push origin main
   ```
2. Aller dans l'onglet **Actions** du dépôt
3. Le workflow **Déploiement GitHub Pages** doit se lancer automatiquement
4. Attendre la fin de l'exécution (⏱ ~1-2 minutes)

---

## Étape 3 — Accéder au site

Après déploiement, l'URL de votre site est :

```
https://VOTRE_USERNAME.github.io/VOTRE_REPO/
```

Par exemple : `https://jean.github.io/la-cave/`

Cette URL est également affichée dans **Settings → Pages** une fois le déploiement réussi.

---

## Structure du déploiement

Le workflow déploie uniquement le contenu du dossier `public/` :

```
public/           ← déployé sur gh-pages
  index.html      → https://username.github.io/la-cave/
  admin.html      → https://username.github.io/la-cave/admin.html
  css/style.css
  js/*.js
```

Les fichiers `docs/`, `scripts/` et autres ne sont **pas** publiés sur le site web.

---

## Nom de domaine personnalisé (optionnel)

Si vous possédez un nom de domaine :

1. Dans **Settings → Pages → Custom domain**, saisir votre domaine (ex: `cave.mondomaine.fr`)
2. Chez votre registrar DNS, ajouter un enregistrement CNAME :
   ```
   cave.mondomaine.fr  →  VOTRE_USERNAME.github.io
   ```
3. Cocher **Enforce HTTPS** une fois le certificat émis (~24h)

---

## Dépannage

| Problème | Solution |
|---|---|
| La branche `gh-pages` n'existe pas | Vérifier que le workflow s'est bien exécuté (onglet Actions) |
| Le site affiche une erreur 404 | Vérifier que Pages est configuré sur la branche `gh-pages` |
| Le site affiche l'ancienne version | Attendre quelques minutes (cache CDN GitHub) ou vider le cache navigateur |
| Le workflow échoue avec "Permission denied" | Dans Settings → Actions → General → vérifier que "Read and write permissions" est activé pour les workflows |
