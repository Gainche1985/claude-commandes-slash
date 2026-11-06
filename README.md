# Commandes slash Claude · fiche pratique

Fiche de référence des commandes « / » de Claude Code, orientée Growth Marketing (recherche d'emploi, automatisation, CRM).
Version interactive (commentaires et questions) : https://claude.ai/artifact/Pe3NtALc218q6bT32QVRDF

Mise à jour : 29 octobre 2026 · Source : https://code.claude.com/docs/en/commands

## Mode d'emploi
- Tape « / » en début de message, puis quelques lettres pour filtrer.
- Deux familles : commandes natives (réglages, mémoire, coûts) et skills perso (/brief-matin, /cv-updater…).
- Le texte après la commande devient son argument : `/cv-updater https://lien-offre`.

## Top 8 (commandes visibles dans le menu de l'app)
| # | Commande | Usage | Exemple |
|---|---|---|---|
| 1 | `/plan` | Claude propose un plan avant d'agir | `/plan crée un workflow n8n qui envoie les leads HubSpot chauds sur Slack` |
| 2 | `/effort` | Niveau de réflexion | `/effort low` pour un mail, `/effort high` pour une stratégie |
| 3 | `/model` | Choisir le modèle | Sonnet pour les relances, Opus pour un CV |
| 4 | `/fast` | Mode rapide | Avant une série de petites retouches |
| 5 | `/skills` | Lister et activer ses skills | Taper « cv » pour retrouver `/cv-updater` |
| 6 | `/usage` | Consommation du forfait | Le vendredi |
| 7 | `/permissions` | Ce que Claude fait sans demander | Autoriser Gmail en lecture |
| 8 | `/config` | Paramètres généraux | Fixer Sonnet par défaut |

Pour programmer un rappel : skill `/replanifier` dans une nouvelle session, ou la page Tâches planifiées (https://claude.ai/code/routines).

## Récap
Règle : si une commande n'apparaît pas quand tu tapes « / », elle n'existe pas dans ton app.

| Dans le menu de l'app | Terminal uniquement |
|---|---|
| `/model`, `/effort`, `/fast`, `/config`, `/permissions`, `/sandbox`, `/plan`, `/skills`, `/plugin`, `/workflows`, `/usage`, `/usage-credits`, `/storage` | `/schedule`, `/loop`, `/powerup`, `/clear`, `/resume`, `/rename`, `/compact`, `/rewind`, `/btw` |

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
- Une commande absente du menu n'existe pas dans l'app : beaucoup d'articles parlent du terminal.
- Les rappels se créent depuis une session ordinaire (bouton Créer), sinon ils sont invisibles dans Tâches planifiées.
- Un rappel ponctuel = « Une fois », pas « Quotidien ».
- `/effort max` consomme beaucoup de quota.

## Ressources
- Référence des commandes : https://code.claude.com/docs/en/commands
- Skills : https://code.claude.com/docs/en/skills
- Tâches planifiées : https://claude.ai/code/routines
- Mode plan : https://code.claude.com/docs/en/permission-modes

## Tracker candidatures (Google Sheets + Apps Script)
Scripts, fiche mémoire et dépannage : [`candidatures/`](candidatures/README.md).
