---
applyTo: "public/js/**"
---

# Style de code JavaScript — La Cave

## Règles fondamentales

1. **`'use strict'`** en première ligne de chaque fichier JS
2. **`const`** par défaut, **`let`** si la variable est réaffectée, jamais **`var`**
3. **Pas de framework** — vanilla JS uniquement, pas d'import/export (scripts chargés en ordre)
4. **Pas de dépendance externe** — aucun CDN JS, aucun npm

## Pattern de module

Chaque fichier exposant une API publique utilise le pattern IIFE :

```javascript
'use strict';

const MonModule = (() => {
  // Variables privées
  let etatInterne = null;

  // Fonctions privées (suffixe _)
  function fonctionPrivee_() { }

  // API publique
  return {
    methodePublique() { },
  };
})();
```

## Sécurité XSS

**Obligatoire** avant tout `innerHTML` avec données dynamiques :

```javascript
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

## Appels API

Pattern standard pour les appels fetch :

```javascript
async function appelApi_() {
  try {
    const reponse = await fetch(url, options);
    if (!reponse.ok) throw new Error(`Erreur HTTP : ${reponse.status}`);
    return await reponse.json();
  } catch (erreur) {
    console.error('Description de l\'erreur :', erreur);
    throw erreur; // Remonter pour que l'UI puisse afficher un message
  }
}
```

## Commentaires

- **Français** pour les blocs métier et les fonctions exposées
- **Anglais** acceptable pour les utilitaires génériques
- Préférer un code lisible à des commentaires excessifs

## Nommage

| Élément | Convention | Exemple |
|---|---|---|
| Variable / constante | camelCase | `allBottles`, `apiUrl` |
| Fonction privée | camelCase + `_` | `fetchData_()`, `buildRow_()` |
| Constante globale | SCREAMING_SNAKE_CASE | `CONFIG`, `TYPE_LABELS` |
| Classe / Module | PascalCase | `SheetsAPI`, `PublicApp` |
| ID HTML | kebab-case | `bottle-grid`, `filter-type` |
| Classe CSS | BEM kebab-case | `bottle-card__name` |

## Gestion des erreurs

- Messages d'erreur **en français** compréhensibles pour l'utilisateur
- Toujours logger les erreurs techniques en console (pour le débogage)
- Ne jamais afficher de stack trace ou de détail technique à l'utilisateur final
