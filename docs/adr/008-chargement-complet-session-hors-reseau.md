# ADR-009 : Chargement complet des donnees publiques en memoire de session

## Statut
Accepte

## Contexte

Le besoin est de consulter les donnees publiques meme en cas de coupure reseau, sans introduire de mecanisme de telechargement de fichier.

Le comportement attendu est :
- charger l'integralite des donnees publiques quand la page publique est ouverte
- continuer l'affichage hors reseau tant que la page reste chargee
- ne pas proposer d'export/import manuel

Contraintes :
- Respecter l'architecture statique (ADR-001)
- Respecter la persistance Google Sheets via Apps Script (ADR-002)
- Ne pas introduire de dependance externe
- Conserver une implementation simple cote client

## Decision

Implementer un mode snapshot en memoire volatile de la page publique.

### 1) Chargement initial complet

Au demarrage de la page publique, l'application charge toutes les donnees publiques necessaires a l'affichage :
- bouteilles visibles (hors archive)
- localisations
- layouts associes

Ce chargement est realise en une phase de synchronisation initiale. Le rendu principal s'appuie ensuite sur ce snapshot en memoire.

### 2) Continuite d'affichage hors reseau

Une fois le snapshot charge, toute navigation/filtrage/consultation utilise les donnees en memoire.

Si la connexion est perdue apres le chargement initial, l'application continue de fonctionner avec ce snapshot tant que l'onglet n'est pas ferme ni recharge.

### 3) Pas de persistance locale durable

Pas d'export de fichier, pas d'import de fichier, pas de persistance offline durable imposee par ce lot.

Le stockage du snapshot est limite a la memoire d'execution de la page.

### 4) Messages utilisateur

L'interface doit expliciter l'etat des donnees :
- donnees chargees (avec horodatage du dernier chargement)
- mode hors reseau actif si perte de connexion apres chargement
- erreur bloquante si aucun chargement initial n'a pu etre realise

## Consequences

Positif :
- Repond exactement au besoin de consultation hors reseau pendant la session active
- UX simple : aucun fichier a gerer pour l'utilisateur
- Pas de complexite de versionnement de format d'export
- Compatible avec les ADR existants et sans dependance supplementaire

Negatif :
- Le mode hors reseau ne survit pas a un rechargement de page ou une fermeture d'onglet
- Si le reseau est absent au premier chargement, aucune donnee ne peut etre affichee
- Les donnees peuvent devenir obsoletes pendant une longue session hors reseau

## Alternatives considerees

| Alternative | Raison du rejet |
|---|---|
| Export/import JSON manuel | Rejete explicitement : flux utilisateur non souhaite |
| Persistance locale durable (localStorage/IndexedDB) | Hors besoin exprime pour ce lot, augmente le perimetre de maintenance |
| PWA avec Service Worker | Plus complexe et non necessaire pour ce niveau de besoin |
| Fonctionnement online uniquement | Ne couvre pas la continuite d'affichage en cas de coupure reseau |