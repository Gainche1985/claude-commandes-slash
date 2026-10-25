# Commandes slash Claude · fiche pratique

Fiche de référence des commandes « / » de Claude Code, orientée Growth Marketing (recherche d'emploi, automatisation, CRM).
Version interactive (commentaires et questions) : https://claude.ai/artifact/Pe3NtALc218q6bT32QVRDF

Mise à jour : 25 octobre 2026 · Source : https://code.claude.com/docs/en/commands

## Mode d'emploi
- Tape « / » en début de message, puis quelques lettres pour filtrer.
- Deux familles : commandes natives (réglages, mémoire, coûts) et skills perso (/brief-matin, /cv-updater…).
- Le texte après la commande devient son argument : `/cv-updater https://lien-offre`.

## Top 8
| # | Commande | Usage | Exemple |
|---|---|---|---|
| 1 | `/plan` | Claude propose un plan avant d'agir | `/plan crée un workflow n8n qui envoie les leads HubSpot chauds sur Slack` |
| 2 | `/schedule` | Tâche programmée dans le cloud | `/schedule chaque lundi 8h30, liste 10 offres Growth Manager Paris` |
| 3 | `/loop` | Répétition pendant la session | `/loop 30m vérifie si j'ai reçu une réponse de recruteur dans Gmail` |
| 4 | `/model` + `/effort` | Choisir le modèle et le niveau de réflexion | `/effort low` pour un mail, `/effort high` pour une stratégie |
| 5 | `/compact` | Résumer pour libérer du contexte | `/compact garde uniquement les décisions sur la campagne Lemlist` |
| 6 | `/clear` | Nouvelle conversation | `/clear` entre deux candidatures |
| 7 | `/rewind` | Revenir en arrière (alias `/undo`) | `/rewind` après une réécriture ratée |
| 8 | `/usage` | Consommation du forfait | `/usage` le vendredi |

Bonus : `/btw`, `/rename`, `/resume`.

## Récap par catégorie
| Catégorie | Commandes |
|---|---|
| Réglages | `/model`, `/effort`, `/fast`, `/config`, `/permissions`, `/sandbox` |
| Conversation | `/clear`, `/compact`, `/rewind`, `/btw`, `/resume`, `/rename`, `/branch`, `/recap`, `/export`, `/copy` |
| Mode de travail | `/plan`, `/goal`, `/subtask`, `/fork`, `/tasks` |
| Automatisation | `/schedule`, `/loop`, `/workflows`, `/deep-research` |
| Outils | `/skills`, `/plugin`, `/mcp`, `/memory`, `/init` |
| Création | `/slides`, `/design`, `/dataviz` |
| Coûts | `/usage` (`/cost`, `/stats`), `/usage-credits` |
| Aide | `/help`, `/doctor`, `/status`, `/powerup` |

## Skills perso
| Commande | Exemple |
|---|---|
| `/brief-matin` / `/brief-soir` | Brief quotidien et bilan avec report auto |
| `/cv-updater` | `/cv-updater https://lien-de-l-offre` |
| `/candidature-generator` | Coller l'annonce |
| `/email-relancer` | Relances J+7 en brouillons Gmail |
| `/linkedin-post-generator` | `/linkedin-post-generator mon site Webflow chez Consentio` |
| `/n8n-workflow-builder` | `/n8n-workflow-builder formulaire Typeform vers HubSpot` |
| `/prompt-optimizer` | `/prompt-optimizer <prompt brut>` |
| `/replanifier` | `/replanifier relancer Alan jeudi 10h` |
| `/renommer-conversations`, `/tri-fichiers` | Rangement |

## Pièges
- La commande doit être en tout début de message.
- `/clear` efface le contexte : `/rename` avant.
- `/loop` s'arrête avec la session ; `/schedule` tourne ordi éteint.
- `/rewind` ne rappelle pas un mail envoyé.
- `/effort max` consomme beaucoup de quota.

## Ressources
- Référence des commandes : https://code.claude.com/docs/en/commands
- Skills : https://code.claude.com/docs/en/skills
- Tâches programmées : https://code.claude.com/docs/en/routines
- Mode plan : https://code.claude.com/docs/en/permission-modes
