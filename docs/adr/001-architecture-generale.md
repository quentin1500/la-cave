# ADR-001 : Architecture générale de l'application

## Statut
Accepté

## Contexte

Il faut choisir la stack technique pour une application de gestion de cave à vins personnelle hébergée gratuitement, maintenue par une seule personne, sans backend dédié.

Les contraintes principales sont :
- Hébergement gratuit, sans serveur à gérer
- Déploiement simple (idéalement automatique via Git)
- Pas de compétences en DevOps nécessaires pour maintenir l'app
- Données stockées de manière pérenne et lisible hors application

## Décision

**Frontend statique Vanilla JavaScript, hébergé sur GitHub Pages.**

- **Aucun framework JS** (pas de React, Vue, Svelte) : réduction de la complexité, pas de dépendances à maintenir, pas de build step
- **Aucun bundler** (pas de Webpack, Vite) : fichiers servis tels quels, débogage simplifié
- **GitHub Pages** : hébergement gratuit directement depuis le dépôt Git, déploiement automatique via GitHub Actions
- **Deux pages HTML** : `index.html` (publique) et `admin.html` (administration)
- **Scripts chargés en ordre** via balises `<script>` classiques (pas d'ES modules)

## Conséquences

**Positif :**
- Aucune dépendance à maintenir ou mettre à jour
- Déploiement en quelques secondes après un `git push`
- L'application fonctionne tant que GitHub existe
- Code entièrement lisible sans outillage particulier

**Négatif :**
- Pas de rendu côté serveur (SSR) — pas nécessaire pour ce cas d'usage
- Toute la logique est visible dans la source (mitigation : secrets injectés par CI/CD)
- Pas de state management centralisé — acceptable pour la taille du projet

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| React / Next.js | Complexité inutile, dépendances à maintenir, build step |
| Vue.js | Idem — dépendance externe non justifiée |
| Jekyll (GitHub Pages natif) | Templating limité pour une SPA dynamique |
| Netlify / Vercel | Dépendance à une plateforme tierce non nécessaire |
