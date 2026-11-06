/**
 * TRACKER CANDIDATURES — Script corrigé : remplissage automatique "Lien annonce"
 *
 * INSTALLATION :
 * 1. Dans le Google Sheet → Extensions → Apps Script
 * 2. Remplacer tout le contenu par ce script
 * 3. Sauvegarder (Ctrl+S)
 * 4. Exécuter installTriggers() une fois (bouton ▶ avec installTriggers sélectionné)
 * 5. Autoriser les permissions demandées (Gmail + Sheets)
 *
 * FEUILLE CIBLE : "Candidatures" (ou adapter SHEET_NAME ci-dessous)
 * COLONNE "Lien annonce" : colonne H (index 7, base 0)
 */

// ===== CONFIGURATION =====
const SHEET_NAME = 'Candidatures';  // Nom de la feuille principale
const COL_ENTREPRISE  = 1;  // A
const COL_PLATEFORME  = 3;  // C
const COL_DATE_ENVOI  = 7;  // G
const COL_LIEN        = 8;  // H ← colonne à remplir
const COL_CONTACT     = 9;  // I

// Couleur alerte si aucun lien trouvé après scan
const COLOR_MISSING = '#FFE0B2';  // orange clair
const COLOR_FOUND   = '#FFFFFF';  // blanc (normal)

// ===== POINT D'ENTRÉE PRINCIPAL =====

/**
 * Installe les deux triggers nécessaires.
 * À exécuter UNE SEULE FOIS manuellement après avoir collé ce script.
 */
function installTriggers() {
  // Supprimer les anciens triggers pour éviter les doublons
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Trigger 1 : à chaque modification du sheet (pour capter les nouvelles lignes)
  ScriptApp.newTrigger('onEditFillLien')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // Trigger 2 : scan horaire pour rattraper les lignes manquées
  ScriptApp.newTrigger('scanAllMissingLinks')
    .timeBased()
    .everyHours(2)
    .create();

  Logger.log('✅ Triggers installés avec succès.');
  SpreadsheetApp.getUi().alert('Triggers installés ✅\n\nLe script se déclenchera :\n• À chaque modification\n• Toutes les 2 heures en automatique');
}

// ===== TRIGGER onEdit =====

/**
 * Déclenché à chaque édition. Si une nouvelle ligne est ajoutée
 * et que la colonne "Lien annonce" est vide, on tente de remplir.
 */
function onEditFillLien(e) {
  try {
    const sheet = e.range.getSheet();
    if (sheet.getName() !== SHEET_NAME) return;

    const row = e.range.getRow();
    if (row <= 1) return; // ignorer l'en-tête

    const lienActuel = sheet.getRange(row, COL_LIEN).getValue();
    if (lienActuel && lienActuel.toString().startsWith('http')) return; // déjà rempli

    // Attendre un court délai pour que toute la ligne soit écrite
    Utilities.sleep(1000);
    fillLienForRow(sheet, row);
  } catch (err) {
    Logger.log('onEditFillLien error: ' + err.message);
  }
}

// ===== SCAN GLOBAL (toutes les 2h) =====

/**
 * Parcourt toutes les lignes avec "Lien annonce" vide et tente de remplir.
 */
function scanAllMissingLinks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log('⚠️ Feuille "' + SHEET_NAME + '" introuvable.');
    return;
  }

  const lastRow = sheet.getLastRow();
  let filled = 0;
  let skipped = 0;

  for (let row = 2; row <= lastRow; row++) {
    const lien = sheet.getRange(row, COL_LIEN).getValue();
    if (lien && lien.toString().startsWith('http')) {
      skipped++;
      continue;
    }
    const result = fillLienForRow(sheet, row);
    if (result) filled++;
  }

  Logger.log(`scanAllMissingLinks : ${filled} liens trouvés, ${skipped} déjà remplis.`);
}

// ===== CŒUR : remplissage d'une ligne =====

/**
 * Tente de trouver et écrire le lien de l'annonce pour une ligne donnée.
 * Retourne true si un lien a été trouvé et écrit.
 */
function fillLienForRow(sheet, row) {
  const values = sheet.getRange(row, 1, 1, COL_CONTACT).getValues()[0];
  const entreprise = (values[COL_ENTREPRISE - 1] || '').toString().trim();
  const plateforme  = (values[COL_PLATEFORME - 1] || '').toString().trim();
  const dateEnvoi   = values[COL_DATE_ENVOI - 1];
  const contact     = (values[COL_CONTACT - 1] || '').toString().trim();

  if (!entreprise) return false;

  // 1. Chercher dans Gmail un lien correspondant
  const lien = findLinkInGmail(entreprise, plateforme, contact, dateEnvoi);

  const lienCell = sheet.getRange(row, COL_LIEN);

  if (lien) {
    lienCell.setValue(lien);
    lienCell.setBackground(COLOR_FOUND);
    Logger.log(`✅ Ligne ${row} (${entreprise}) → ${lien.substring(0, 80)}...`);
    return true;
  } else {
    // Pas de lien trouvé : alerte visuelle + note
    lienCell.setBackground(COLOR_MISSING);
    const note = lienCell.getNote();
    if (!note) {
      lienCell.setNote('⚠️ Lien annonce non trouvé automatiquement. À renseigner manuellement.');
    }
    Logger.log(`⚠️ Ligne ${row} (${entreprise}) — aucun lien trouvé dans Gmail.`);
    return false;
  }
}

// ===== EXTRACTION GMAIL =====

/**
 * Cherche dans Gmail un email de confirmation de candidature
 * et extrait l'URL de l'annonce.
 *
 * Stratégie : plusieurs requêtes de recherche Gmail en cascade.
 */
function findLinkInGmail(entreprise, plateforme, contact, dateEnvoi) {
  // Construire une fenêtre de date ±3 jours autour de la date d'envoi
  let afterDate = '', beforeDate = '';
  if (dateEnvoi) {
    const d = new Date(dateEnvoi);
    if (!isNaN(d.getTime())) {
      const dAfter = new Date(d); dAfter.setDate(dAfter.getDate() - 1);
      const dBefore = new Date(d); dBefore.setDate(dBefore.getDate() + 2);
      afterDate  = formatDateGmail(dAfter);
      beforeDate = formatDateGmail(dBefore);
    }
  }

  const dateFilter = afterDate ? ` after:${afterDate} before:${beforeDate}` : '';

  // Liste de requêtes Gmail à essayer dans l'ordre
  const queries = [];

  // Requête 1 : email du contact spécifique
  if (contact && contact.includes('@')) {
    queries.push(`from:(${contact})${dateFilter}`);
  }

  // Requête 2 : nom entreprise + mots-clés de confirmation
  const cleanNom = entreprise.replace(/[^\w\s]/g, ' ').trim().split(' ').slice(0, 3).join(' ');
  if (cleanNom) {
    queries.push(`subject:(${cleanNom}) (candidature OR application OR confirmed OR confirmation OR postuler)${dateFilter}`);
  }

  // Requête 3 : plateforme connue + date
  const plateformeSenders = {
    'linkedin':           'jobs-noreply@linkedin.com OR jobalerts-noreply@linkedin.com',
    'cadremploi':         'cadremploi',
    'hellowork':          'hellowork',
    'welcome to the jungle': 'noreply@welcometothejungle.com',
    'apec':               'noreply@apec.fr',
    'indeed':             'indeed.com',
    'glassdoor':          'glassdoor.com',
  };
  const plateformeLower = plateforme.toLowerCase();
  for (const [key, sender] of Object.entries(plateformeSenders)) {
    if (plateformeLower.includes(key)) {
      queries.push(`from:(${sender})${dateFilter}`);
      break;
    }
  }

  // Essayer chaque requête
  for (const query of queries) {
    try {
      const threads = GmailApp.search(query, 0, 5);
      for (const thread of threads) {
        for (const message of thread.getMessages()) {
          const body = message.getPlainBody() + ' ' + message.getBody();
          const link = extractJobLink(body, plateforme, entreprise);
          if (link) return link;
        }
      }
    } catch (err) {
      Logger.log(`Gmail search error (query: ${query}): ${err.message}`);
    }
  }

  return null;
}

/**
 * Extrait le premier lien pertinent d'un corps d'email.
 * Prioritise les liens d'offres d'emploi plutôt que les liens de désabonnement.
 */
function extractJobLink(body, plateforme, entreprise) {
  if (!body) return null;

  // Patterns à EXCLURE (désabonnement, tracking pixel, etc.)
  const excludePatterns = [
    /unsubscribe/i, /se-desabonner/i, /optout/i, /opt-out/i,
    /tracking\?/i, /pixel\./i, /beacon\./i,
  ];

  // Patterns de liens d'offres connus par plateforme
  const platformPatterns = [
    /https?:\/\/(?:www\.)?linkedin\.com\/(?:comm\/)?jobs\/view\/\d+[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*cadremploi[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*hellowork[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*welcometothejungle[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*apec\.fr[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*indeed\.com\/viewjob[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*glassdoor\.com\/job-listing[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*teamtailor[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*welcomekit[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*ashby\.io[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*lever\.co\/[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*workable\.com[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*smartrecruiters\.com[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*jobteaser[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*meteojob[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*jobmania[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*beetween[^\s"'<>]*/gi,
    /https?:\/\/[^\s"'<>]*broadbean[^\s"'<>]*/gi,
  ];

  // D'abord chercher un lien de plateforme connue
  for (const pattern of platformPatterns) {
    pattern.lastIndex = 0;
    const matches = body.match(pattern);
    if (matches) {
      for (const url of matches) {
        const clean = cleanUrl(url);
        if (clean && !excludePatterns.some(p => p.test(clean))) {
          return clean;
        }
      }
    }
  }

  // Sinon : extraction générique de la première URL "job-like"
  const genericPattern = /https?:\/\/[^\s"'<>\]]+/gi;
  const allUrls = body.match(genericPattern) || [];
  const jobKeywords = /job|emploi|career|career|offre|poste|recrutement|candidature|application|apply/i;
  const entrepriseClean = entreprise.toLowerCase().replace(/[^\w]/g, '');

  for (const url of allUrls) {
    const clean = cleanUrl(url);
    if (!clean) continue;
    if (excludePatterns.some(p => p.test(clean))) continue;
    if (jobKeywords.test(clean)) return clean;
    if (entrepriseClean.length > 3 && clean.toLowerCase().includes(entrepriseClean)) return clean;
  }

  return null;
}

// ===== UTILITAIRES =====

function cleanUrl(url) {
  // Nettoyer les artefacts HTML (entités, guillemets)
  return url
    .replace(/&amp;/g, '&')
    .replace(/['">\]]+$/, '')
    .replace(/\\u003d/gi, '=')
    .trim();
}

function formatDateGmail(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

// ===== MENU MANUEL =====

/**
 * Ajoute un menu "Candidatures" dans le sheet pour relancer manuellement.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔍 Candidatures')
    .addItem('Remplir les liens manquants (scan Gmail)', 'scanAllMissingLinks')
    .addItem('Réinstaller les triggers', 'installTriggers')
    .addToUi();
}
