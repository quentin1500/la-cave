---
applyTo: "**"
---

# Conformité aux ADRs — La Cave

## Obligation de consultation

À chaque proposition de modification architecturale ou introduction d'un nouveau pattern, **consulter systématiquement** les fichiers `docs/adr/*.md`.

## Liste des ADRs actifs

| Numéro | Sujet | Fichier |
|---|---|---|
| ADR-001 | Architecture générale | `docs/adr/001-architecture-generale.md` |
| ADR-002 | Persistance Google Sheets | `docs/adr/002-persistance-google-sheets.md` |
| ADR-003 | Authentification admin | `docs/adr/003-authentification-admin.md` |
| ADR-004 | Intégration OpenFoodFacts | `docs/adr/004-integration-openfoodfacts.md` |
| ADR-005 | Structure emplacement | `docs/adr/005-structure-emplacement.md` |
| ADR-006 | Modèle de données bouteille | `docs/adr/006-modele-donnees-bouteille.md` |

## Comportement attendu

- Si une demande **respecte** les ADRs → implémenter directement
- Si une demande **contredit** un ADR → signaler le conflit, proposer une mise à jour de l'ADR, attendre validation avant implémentation
- Si une demande introduit une **nouvelle décision** architecturale → proposer un nouvel ADR à créer

## Format ADR

```markdown
# ADR-XXX : Titre

## Statut
Accepté | Proposé | Déprécié | Remplacé par ADR-YYY

## Contexte
Pourquoi cette décision est nécessaire.

## Décision
Ce qui a été décidé.

## Conséquences
Impacts positifs et négatifs.

## Alternatives considérées
Ce qui a été écarté et pourquoi.
```
