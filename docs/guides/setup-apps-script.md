# Guide — Configuration Google Apps Script

Ce guide explique comment connecter l'application La Cave à un Google Sheet via Apps Script.

---

## Étape 1 — Créer le Google Sheet

1. Ouvrir [Google Sheets](https://sheets.google.com)
2. Créer un nouveau fichier, le nommer **La Cave** (ou tout autre nom)
3. Renommer la première feuille en **`Bouteilles`** (exact, respecter la casse)

> La première ligne des en-têtes sera créée automatiquement par Apps Script au premier déploiement.  
> Un deuxième onglet **`Layout`** sera créé automatiquement lors du premier enregistrement du plan de cave.

---

## Étape 2 — Créer le projet Apps Script

1. Dans Google Sheets : menu **Extensions → Apps Script**
2. Un éditeur s'ouvre dans un nouvel onglet
3. Supprimer tout le contenu existant (`Code.gs`)
4. Copier-coller intégralement le contenu du fichier `scripts/apps-script/Code.gs` de ce dépôt
5. Sauvegarder (`Ctrl+S` ou `⌘+S`)

---

## Étape 3 — Configurer le hash du mot de passe admin

Apps Script doit connaître le hash SHA-256 de votre mot de passe pour valider les opérations d'écriture.

1. **Générer le hash** : ouvrir `tools/generate-hash.html` localement dans votre navigateur et copier le hash produit
2. Dans l'éditeur Apps Script, **sélectionner la fonction `setAdminPasswordHash`** dans le menu déroulant des fonctions
3. Remplacer `'VOTRE_HASH_ICI'` par votre hash (64 caractères hexadécimaux) :
   ```javascript
   var hash = 'a1b2c3d4e5f6...'; // ← coller votre hash SHA-256 ici
   ```
4. Cliquer sur **Exécuter** (▶)
5. Autoriser les permissions demandées (lecture/écriture sur le Spreadsheet)

> ⚠️ **Ce hash doit être identique** à celui configuré comme secret GitHub `ADMIN_PASSWORD_HASH`.  
> C'est le hash SHA-256 de votre mot de passe admin — il joue le double rôle d'identifiant de session *et* de clé API.

---

## Étape 4 — Déployer comme Web App

1. Menu **Déployer → Nouveau déploiement**
2. Cliquer sur l'icône ⚙️ à côté de « Sélectionner le type » → choisir **Application Web**
3. Configurer :
   | Champ | Valeur |
   |---|---|
   | Description | `La Cave v1` |
   | Exécuter en tant que | **Moi** (your email) |
   | Qui a accès | **Tout le monde** |
4. Cliquer sur **Déployer**
5. Autoriser les permissions si demandé
6. **Copier l'URL** de l'application web — elle ressemble à :
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

> ⚠️ **Notez cette URL** — vous en aurez besoin comme secret GitHub (`SHEETS_API_URL`).

---

## Étape 5 — Tester le déploiement

Dans votre navigateur, ouvrir l'URL suivante (remplacer `VOTRE_URL` par l'URL copiée) :

```
VOTRE_URL?action=getAll
```

Vous devez obtenir une réponse JSON :
```json
[]
```
(tableau vide si aucune bouteille n'a encore été ajoutée)

Pour vérifier que l'API supporte l'archivage et le layout :

- Tester la récupération du layout (GET) :

```
VOTRE_URL?action=getLayout
```

La réponse vaut `{"layout": null}` si aucun layout n'a été sauvegardé (onglet `Layout` absent ou cellule A1 vide).

- Tester l'archivage : appeler l'endpoint `POST` avec `action=delete` et un `id` (le serveur archive la ligne au lieu de la supprimer). Vous pouvez fournir `comment` dans le payload pour enregistrer un commentaire d'archivage.

---

---

## Mettre à jour le code Apps Script

Après une modification du fichier `Code.gs` :

1. Ouvrir l'éditeur Apps Script
2. Coller la nouvelle version du code
3. Menu **Déployer → Gérer les déploiements**
4. Cliquer sur ✏️ (modifier) à côté de votre déploiement
5. Dans "Version", sélectionner **"Nouvelle version"**
6. Cliquer sur **Déployer**

> L'URL reste la même après une mise à jour.

---

## Dépannage

| Problème | Solution |
|---|---|
| Erreur 401 dans la console | La clé API est incorrecte ou non configurée |
| Erreur CORS dans la console | Vérifier que le Content-Type est `text/plain` dans le code JS |
| Tableau vide malgré des données | Vérifier que la feuille est bien nommée `Bouteilles` |
| Layout non sauvegardé | Vérifier que l'onglet `Layout` existe (créé automatiquement au premier `saveLayout`) |
| Erreur d'autorisation au déploiement | Révoquer et re-autoriser dans [myaccount.google.com/permissions](https://myaccount.google.com/permissions) |
