# Tracker candidatures : fiche mémoire

> Fichier de référence pour Claude et pour Marie. **En cas de panne, commencer par ici**, puis lancer le menu « 🔍 Candidatures → 🩺 Diagnostic » dans le Sheet.

- **Sheet** : [Candidatures 2026](https://docs.google.com/spreadsheets/d/1J9SbqQSrsYOjXmo_fdnKQ6aEU8MDo6DC0j17T2GcYs0/edit) (ID `1J9SbqQSrsYOjXmo_fdnKQ6aEU8MDo6DC0j17T2GcYs0`)
- **Onglets** : `Candidatures` · `📊 Dashboard` · `AB Test` · `📊 Dashboard AB Test`
- **Projet Apps Script** (Extensions → Apps Script) : 2 fichiers seulement
  - `Code.gs` : import Gmail, IA, liens, nettoyage, diagnostic, menu
  - `Dashboard.gs` : les deux dashboards + graphiques

## Comment ça marche

```
Filtre Gmail ─► libellé « Job-2025 »
                     │  (toutes les 15 min)
                     ▼
        automateJobToSheet()
          ├─ Gemini lit le mail ─► entreprise, poste, plateforme, statut, contact
          ├─ Regex sur le HTML ─► lien de l'offre (LinkedIn, WTTJ, ATS…)
          ├─ Ligne existante ? (même thread Gmail, sinon même entreprise normalisée)
          │     oui ─► MAJ statut (jamais de retour en arrière) + « Dernière MAJ »
          │     non ─► nouvelle ligne
          ├─ Libellé « Job-2025-Traite »      (succès)
          ├─ Libellé « Job-2025-A-verifier »  (pas une candidature, ou 3 échecs)
          └─ rafraichirDashboards()
Chaque nuit 3h : scanLiensManquants()  (40 lignes max, ne repasse pas sur une ligne déjà tentée)
Chaque matin 6h : rafraichirDashboards() (bascule J / J-1)
```

## Colonnes de l'onglet `Candidatures`

| Col | Champ | Rempli par |
|---|---|---|
| A | Entreprise | IA |
| B | Poste (liste fermée `VALID_POSTES`) | IA |
| C | Plateforme (canal : LinkedIn, WTTJ, Site carrière, HelloWork, Indeed, Cadremploi, Apec, InfoJobs, Email direct, Autres) | IA + normalisation |
| D | Secteur | IA |
| E | Type candidature | IA |
| F | Statut (liste fermée `VALID_STATUSES`) | IA, ne descend jamais |
| G | Date d'envoi = 1er mail du thread, **jamais écrasée** | script |
| H | Lien annonce (orange + note = non trouvé) | regex |
| I | Contact (lien mailto, jamais ton propre email) | IA / expéditeur |
| J | mots_cles_ats | manuel |
| K | resume_optimise | manuel |
| L | Dernière MAJ (date du dernier mail) | script |
| M | Gmail thread ID (traçabilité, clé de dédoublonnage) | script |

## Installation / réinstallation

1. Extensions → Apps Script. Supprimer les anciens fichiers (`script_lien_annonce`, `restaurer_dashboard`, `candidatures_2026`, `automate_job_to_sheet`).
2. Créer `Code.gs` et `Dashboard.gs` avec le contenu de ce dossier.
3. ⚙️ Paramètres du projet → Propriétés du script → `GEMINI_API_KEY` = clé [AI Studio](https://aistudio.google.com/apikey).
4. Exécuter `installerTout` → autoriser.
5. Une seule fois : Fichier → Créer une copie (sauvegarde), puis menu → 🧹 Nettoyer l'historique.

## Dépannage (runbook)

| Symptôme | Cause probable | Solution |
|---|---|---|
| Plus rien ne s'importe | Trigger supprimé (un ancien script faisait `deleteTrigger` sur **tous** les triggers) | Menu → ⚙️ Réinstaller les triggers |
| Mails bloqués dans « Job-2025 » | Quota Gemini (429/503) ou clé invalide | 🩺 Diagnostic ; vérifier la clé ; baisser `BATCH` ou passer `GEMINI_MODEL` à `gemini-2.5-flash-lite` |
| Mails dans « Job-2025-A-verifier » | Alerte emploi / newsletter, ou mail illisible | Saisir à la main ou remettre le libellé « Job-2025 » |
| Doublon d'entreprise | Nom très différent (ex. marque vs raison sociale) | Fusionner à la main ; la colonne M évite que ça se reproduise |
| Lien orange | Mail sans lien d'offre (ATS qui n'en met pas) | Coller le lien à la main |
| Dashboard faux / cassé | Onglet renommé, cellules fusionnées | Menu → 📊 Rafraîchir les dashboards (reconstruit tout) |
| « Exceeded maximum execution time » | Trop de mails d'un coup | Normal, le script s'arrête à 5 min et reprend 15 min plus tard |
| Erreur `GEMINI_API_KEY manquante` | Propriété du script absente | Étape 3 de l'installation |

Journal des exécutions : Apps Script → ⏰ Exécutions (chaque run y logue ce qu'il a fait).

## Audit de la v3 (31/10/2026) : ce qui a été corrigé

Mesuré sur 736 lignes :

- **Clé API Gemini en clair dans le code** → déplacée dans les Propriétés du script. Régénérer l'ancienne clé dans AI Studio.
- **`installTriggers()` supprimait tous les triggers du projet**, y compris l'import Gmail et le dashboard → cause la plus probable de la panne de fin octobre.
- **Date d'envoi écrasée** par la date du refus / de la réponse → graphiques « candidatures par jour » et J / J-1 faux.
- **Liens d'annonce faux sur ~46 % des lignes** (341 / 734 : logos, footers Teamtailor, Google Maps, pages d'accueil, page de planning d'entretien) ; seulement 287 vrais liens d'offre.
- **Doublons** : dédoublonnage sur le nom exact (`Vente-unique.com` ≠ `VENTE UNIQUE.COM`, `Mondial Relay` ≠ `Mondial Relay by InPost`) → 26 doublons.
- **Contact = ton propre email** sur 59 lignes.
- **Plateformes en texte libre** (Welcomekit / WelcomeKit / Welcome Kit, « site carrière » ×3 casses, noms d'ATS) → la ligne « Autres » du dashboard était toujours à 0.
- **Statut qui recule** : un mail « Envoyé » pouvait écraser « Entretien 1 ».
- **Blocage silencieux** : 25 mails non lisibles par l'IA restaient en tête du libellé et bloquaient tous les suivants.
- **Débit Gemini** : 1 requête / 1,2 s (≈ 50 / min) dépassait le quota gratuit → 429 / 503 en série.
- **Trigger `onEdit`** inutile (ne se déclenche pas sur les lignes écrites par script) et lent (pause de 1 s + recherche Gmail à chaque frappe).
- **Scan des liens toutes les 2 h** sur toutes les lignes vides, sans mémoire → requêtes Gmail répétées à l'infini, risque de dépassement des 6 min.
- **Dashboard** : statuts `Entretien 2`, `Stand-by`, `À faire` absents du tableau (TOTAL ≠ total) ; ajout d'un KPI « À relancer J+7 à J+14 » (raccord avec la skill `email-relancer`).
- `restaurer_dashboard` : obsolète (version formules), à supprimer.

Les versions d'origine sont dans [`archive/`](archive/) (clé API retirée).

## Historique

- **v4 (31/10/2026)** : consolidation en 2 fichiers, corrections ci-dessus, menu, diagnostic, nettoyage de l'historique.
- v3 : import Gmail + Gemini, scan liens séparé, dashboards JS avec graphiques.
