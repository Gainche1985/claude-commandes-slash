/**
 * ============================================================
 * TRACKER CANDIDATURES — v4 consolidée (31/10/2026)
 * Remplace : automate_job_to_sheet (v3) + script_lien_annonce (v1)
 * À coller dans le fichier « Code.gs » du projet Apps Script du Sheet.
 * Le fichier « Dashboard.gs » (même dossier) doit être dans le même projet.
 *
 * INSTALLATION (une seule fois) :
 * 1. Paramètres du projet (⚙️) → Propriétés du script → Ajouter :
 *      GEMINI_API_KEY = <ta clé AI Studio>
 * 2. Exécuter installerTout() → autoriser Gmail + Sheets + requêtes externes
 * 3. Recharger le Sheet → menu « 🔍 Candidatures »
 * 4. (Optionnel, une fois) Menu → « Nettoyer l'historique » après une copie de sauvegarde
 * ============================================================
 */

// ===================== CONFIGURATION =====================
const CFG = {
  SHEET: 'Candidatures',
  LABEL_IN: 'Job-2025',                 // libellé posé par tes filtres Gmail
  LABEL_DONE: 'Job-2025-Traite',
  LABEL_REVIEW: 'Job-2025-A-verifier',  // mails que l'IA n'arrive pas à lire / non-candidatures
  MY_EMAILS: ['marie.gainche@gmail.com'],
  BATCH: 15,                            // threads par exécution (toutes les 15 min)
  MAX_RUNTIME_MS: 5 * 60 * 1000,        // marge sous la limite Apps Script de 6 min
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_PAUSE_MS: 4500,                // ≈ 13 requêtes/min, sous le quota gratuit
  MAX_ECHECS: 3,                        // après 3 échecs → libellé « à vérifier »
  NOUVELLE_CANDIDATURE_APRES_J: 30,     // même entreprise, ligne close depuis 30 j → nouvelle ligne
};

const COL = {
  ENTREPRISE: 1, POSTE: 2, PLATEFORME: 3, SECTEUR: 4, TYPE: 5, STATUT: 6,
  DATE_ENVOI: 7, LIEN: 8, CONTACT: 9, ATS: 10, RESUME: 11, MAJ: 12, THREAD: 13,
};
const NB_COLS = 13;
const ENTETES_AJOUTEES = { 12: 'Dernière MAJ', 13: 'Gmail thread ID' };

const VALID_STATUSES = [
  'À faire', 'Pas commencé', 'Envoyé', 'En cours', 'Réponse reçue',
  'Stand-by', 'Entretien 1', 'Entretien 2', 'Refus', 'Terminé',
];
// Un statut ne peut que « monter » (sauf nouvelle candidature)
const STATUT_RANG = {
  'À faire': 0, 'Pas commencé': 0, 'Envoyé': 1, 'En cours': 2, 'Réponse reçue': 3,
  'Stand-by': 3, 'Entretien 1': 4, 'Entretien 2': 5, 'Refus': 9, 'Terminé': 9,
};
const STATUTS_CLOS = ['Refus', 'Terminé'];

const VALID_POSTES = [
  'CRM Manager', 'Growth Manager', 'Responsable CRM', 'Responsable Acquisition',
  'Growth marketer', 'candidature spontanée', 'Inconnu', 'Responsable marketing',
  'Head of growth', 'Lead generation manager',
];

// Plateforme = canal par lequel tu as postulé (les ATS = « Site carrière »)
const PLATEFORMES_DASHBOARD = [
  'LinkedIn', 'Welcome to the Jungle', 'Site carrière', 'HelloWork', 'Indeed',
  'Cadremploi', 'Apec', 'InfoJobs', 'Email direct',
];
const PLATEFORME_REGLES = [
  [/linked ?in/i, 'LinkedIn'],
  [/welcome ?to ?the ?jungle|wttj|welcome ?kit/i, 'Welcome to the Jungle'],
  [/hello ?work|regionsjob/i, 'HelloWork'],
  [/indeed/i, 'Indeed'],
  [/cadre ?emploi/i, 'Cadremploi'],
  [/apec/i, 'Apec'],
  [/infojobs/i, 'InfoJobs'],
  [/^(e-?mail|direct|email direct|gmail)$/i, 'Email direct'],
  [/site carri|career|carri[eè]re|teamtailor|smart ?recruiters|workday|workable|ashby|lever|greenhouse|taleez|beetween|flatchr|comeet|jobvite|recruitee|personio|factorial|hubspot|ats|hr system|talentsoft|cornerstone|softgarden|join\.com|bamboo/i, 'Site carrière'],
];

// Entreprises qui ne sont jamais la cible d'une candidature
const ENTREPRISES_BLACKLIST = /^(inconnu|inconnue|linkedin|indeed|welcome to the jungle|hellowork|built ?in|glassdoor|jobgether|apec|cadremploi|infojobs|google|gmail)$/i;

// Liens d'OFFRES reconnus (le reste est ignoré : logos, footers, pages d'accueil…)
const JOB_URL_PATTERNS = [
  /linkedin\.com\/(?:comm\/)?jobs\/view\/\d+/i,
  /welcometothejungle\.com\/[a-z-]+\/companies\/[^/]+\/jobs\/[^/?#]+/i,
  /welcomekit\.co\/.+\/jobs?\//i,
  /\.teamtailor\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?jobs\/\d+/i,
  /indeed\.[a-z.]+\/(?:viewjob|rc\/clk|pagead\/clk|m\/viewjob)/i,
  /hellowork\.com\/fr-fr\/emplois\/\d+/i,
  /apec\.fr\/.*detail-offre/i,
  /cadremploi\.fr\/emploi\/detail_offre/i,
  /jobs\.ashbyhq\.com\/[^/]+\/[0-9a-f-]{20,}/i,
  /jobs\.lever\.co\/[^/]+\/[0-9a-f-]{20,}/i,
  /(?:jobs|careers)\.smartrecruiters\.com\/[^/]+\/\d+/i,
  /apply\.workable\.com\/[^/]+\/j\/[0-9a-z]+/i,
  /myworkdayjobs\.com\/.+\/job\//i,
  /greenhouse\.io\/[^/]+\/jobs\/\d+/i,
  /jobteaser\.com\/[a-z-]+\/job-offers\//i,
  /infojobs\.net\/.+\/of-i[0-9a-f]+/i,
  /taleez\.com\/apply\//i,
  /comeet\.com\/jobs\/[^/]+\/[^/]+\/[^/]+/i,
  /\/(?:jobs?|careers?|offres?(?:-d-emploi)?|emplois?|postes?|vacanc(?:y|ies)|annonces?)\/[^?#\s]{6,}/i,
];
const URL_EXCLUSIONS = [
  /unsubscribe|desabonn|désabonn|optout|opt-out|preferences|manage-?alerts/i,
  /\.(?:png|jpe?g|gif|svg|webp|ico)(?:[?#]|$)/i,
  /utm_content=(?:email-footer|logoheader|logo|footer)/i,
  /google\.[a-z.]+\/maps|maps\.google|play\.google|apps\.apple/i,
  /\/(?:schedule|privacy|confidentialite|legal|cgu|terms)\b/i,
  /pixel|beacon|open\.aspx|\/track\/open/i,
];


// ===================== INSTALLATION =====================
function installerTout() {
  const handlers = ['automateJobToSheet', 'scanLiensManquants', 'rafraichirDashboards',
                    'onEditFillLien', 'scanAllMissingLinks'];
  // On ne supprime QUE nos propres triggers (l'ancien script supprimait tout)
  ScriptApp.getProjectTriggers()
    .filter(t => handlers.indexOf(t.getHandlerFunction()) !== -1)
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('automateJobToSheet').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('scanLiensManquants').timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger('rafraichirDashboards').timeBased().everyDays(1).atHour(6).create();

  _assurerEntetes(_sheet());
  ['LABEL_DONE', 'LABEL_REVIEW'].forEach(k => _label(CFG[k]));

  if (!_geminiKey()) Logger.log('⚠️ GEMINI_API_KEY absente des Propriétés du script.');
  Logger.log('✅ Triggers : import Gmail /15 min · liens manquants 3h · dashboard 6h (+ après chaque import)');
  _alerte('✅ Installation OK\n\n• Import Gmail toutes les 15 min\n• Recherche des liens manquants chaque nuit\n• Dashboard mis à jour après chaque import'
    + (_geminiKey() ? '' : '\n\n⚠️ Ajoute GEMINI_API_KEY dans Paramètres du projet → Propriétés du script.'));
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔍 Candidatures')
    .addItem('📥 Importer les mails maintenant', 'automateJobToSheet')
    .addItem('🔗 Chercher les liens manquants', 'scanLiensManquants')
    .addItem('📊 Rafraîchir les dashboards', 'rafraichirDashboards')
    .addSeparator()
    .addItem('🩺 Diagnostic', 'diagnostic')
    .addItem('🧹 Nettoyer l\'historique (une fois)', 'nettoyerHistorique')
    .addItem('⚙️ Réinstaller les triggers', 'installerTout')
    .addToUi();
}


// ===================== IMPORT GMAIL → SHEET =====================
function automateJobToSheet() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { Logger.log('⏭️ Exécution déjà en cours, on saute.'); return; }
  const t0 = Date.now();
  try {
    const sheet = _sheet();
    _assurerEntetes(sheet);
    const label = GmailApp.getUserLabelByName(CFG.LABEL_IN);
    if (!label) { Logger.log('❌ Libellé « ' + CFG.LABEL_IN + ' » introuvable.'); return; }
    const labelDone = _label(CFG.LABEL_DONE);
    const labelReview = _label(CFG.LABEL_REVIEW);

    const threads = label.getThreads(0, CFG.BATCH);
    if (!threads.length) { Logger.log('✅ Aucun nouveau mail.'); return; }

    const idx = _indexer(sheet);
    const props = PropertiesService.getScriptProperties();
    const done = [], review = [];
    let changements = 0;

    for (const thread of threads) {
      if (Date.now() - t0 > CFG.MAX_RUNTIME_MS) { Logger.log('⏱️ Temps max atteint, suite au prochain passage.'); break; }
      const tid = thread.getId();
      try {
        const res = _traiterThread(sheet, idx, thread);
        if (res === 'QUOTA') { Logger.log('🛑 Quota Gemini atteint, arrêt propre.'); break; }
        if (res === 'OK') { done.push(thread); changements++; props.deleteProperty('fail_' + tid); }
        else if (res === 'IGNORE') { review.push(thread); }
        else { // ECHEC
          const n = Number(props.getProperty('fail_' + tid) || 0) + 1;
          if (n >= CFG.MAX_ECHECS) { review.push(thread); props.deleteProperty('fail_' + tid); }
          else props.setProperty('fail_' + tid, String(n));
        }
      } catch (e) {
        Logger.log('❌ ' + thread.getFirstMessageSubject() + ' : ' + e.message);
      }
      Utilities.sleep(CFG.GEMINI_PAUSE_MS); // respecte le quota gratuit Gemini
    }

    if (done.length) { labelDone.addToThreads(done); label.removeFromThreads(done); }
    if (review.length) { labelReview.addToThreads(review); label.removeFromThreads(review); }
    Logger.log('✅ ' + done.length + ' traités · ' + review.length + ' à vérifier dans Gmail (« ' + CFG.LABEL_REVIEW + ' »)');

    if (changements) {
      _trierParDate(sheet);
      if (typeof rafraichirDashboards === 'function') rafraichirDashboards();
    }
  } finally {
    lock.releaseLock();
  }
}

/** Retourne 'OK' | 'IGNORE' | 'ECHEC' | 'QUOTA' */
function _traiterThread(sheet, idx, thread) {
  const msgs = thread.getMessages();
  const last = msgs[msgs.length - 1];
  const first = msgs[0];
  const sujet = last.getSubject();
  const expediteur = _email(last.getFrom());
  const corps = (last.getPlainBody() || '').replace(/\s+/g, ' ').substring(0, 2500);

  const info = _geminiAvecRetry(corps, sujet, expediteur);
  if (info === 'QUOTA') return 'QUOTA';
  if (!info) return 'ECHEC';
  if (info.est_candidature === false) { Logger.log('🗑️ Pas une candidature : ' + sujet); return 'IGNORE'; }

  const entreprise = String(info.entreprise || '').trim();
  if (!entreprise || ENTREPRISES_BLACKLIST.test(entreprise)) return 'ECHEC';

  const lien = _meilleurLien(msgs);
  const contact = _choisirContact(info.contactEmail, last);
  const statut = VALID_STATUSES.indexOf(info.statut) !== -1 ? info.statut : 'Envoyé';
  const now = last.getDate();

  // 1) même thread déjà connu ? 2) même entreprise (nom normalisé) ?
  let row = idx.parThread[thread.getId()] || idx.parCle[_cle(entreprise)] || 0;
  if (row) {
    const ligne = sheet.getRange(row, 1, 1, NB_COLS).getValues()[0];
    const ancienStatut = String(ligne[COL.STATUT - 1]).trim();
    const dateEnvoi = ligne[COL.DATE_ENVOI - 1];
    const ageJ = dateEnvoi instanceof Date ? (now - dateEnvoi) / 86400000 : 0;
    const nouvelleCandidature = !idx.parThread[thread.getId()] && statut === 'Envoyé'
      && STATUTS_CLOS.indexOf(ancienStatut) !== -1 && ageJ > CFG.NOUVELLE_CANDIDATURE_APRES_J;
    if (nouvelleCandidature) row = 0;
  }

  if (row) {
    const ligne = sheet.getRange(row, 1, 1, NB_COLS).getValues()[0];
    const ancienStatut = String(ligne[COL.STATUT - 1]).trim();
    sheet.getRange(row, COL.STATUT).setValue(_fusionStatut(ancienStatut, statut));
    sheet.getRange(row, COL.MAJ).setValue(now);              // ⚠️ la date d'envoi (G) n'est plus écrasée
    if (!_estLienOffre(ligne[COL.LIEN - 1]) && lien) _ecrireLien(sheet, row, lien);
    if (!ligne[COL.THREAD - 1]) sheet.getRange(row, COL.THREAD).setValue(thread.getId());
    const ancienContact = String(ligne[COL.CONTACT - 1]);
    if (contact && (!ancienContact.includes('@') || _estMoi(ancienContact) || /no-?reply|ne-pas-repondre/i.test(ancienContact)))
      _setContact(sheet, row, contact);
    if (VALID_POSTES.indexOf(String(ligne[COL.POSTE - 1]).trim()) === -1 || ligne[COL.POSTE - 1] === 'Inconnu')
      sheet.getRange(row, COL.POSTE).setValue(info.poste || 'Inconnu');
    Logger.log('🔄 MAJ ligne ' + row + ' : ' + entreprise + ' → ' + statut);
  } else {
    row = idx.prochaineLigne++;
    sheet.getRange(row, 1, 1, 8).setValues([[
      entreprise,
      info.poste || 'Inconnu',
      normaliserPlateforme(info.plateforme, expediteur, lien),
      info.secteur || 'Non spécifié',
      info.type || 'Réponse à offre',
      statut,
      first.getDate(),                                       // date du 1er mail du thread
      '',
    ]]);
    if (lien) _ecrireLien(sheet, row, lien); else _marquerLienManquant(sheet.getRange(row, COL.LIEN));
    _setContact(sheet, row, contact || 'Équipe RH');
    sheet.getRange(row, COL.MAJ, 1, 2).setValues([[now, thread.getId()]]);
    idx.parCle[_cle(entreprise)] = row;
    Logger.log('🆕 Ajout ligne ' + row + ' : ' + entreprise);
  }
  idx.parThread[thread.getId()] = row;
  return 'OK';
}

function _fusionStatut(actuel, nouveau) {
  if (!actuel) return nouveau;
  const a = STATUT_RANG[actuel] !== undefined ? STATUT_RANG[actuel] : 0;
  const n = STATUT_RANG[nouveau] !== undefined ? STATUT_RANG[nouveau] : 0;
  return n >= a ? nouveau : actuel;
}


// ===================== GEMINI =====================
function _geminiAvecRetry(corps, sujet, expediteur) {
  for (let i = 1; i <= 3; i++) {
    const r = _appelGemini(corps, sujet, expediteur);
    if (r !== 'RETRY') return r;
    if (i < 3) Utilities.sleep(5000 * i);
  }
  return 'QUOTA';
}

function _appelGemini(corps, sujet, expediteur) {
  const key = _geminiKey();
  if (!key) throw new Error('GEMINI_API_KEY manquante (Paramètres du projet → Propriétés du script)');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CFG.GEMINI_MODEL + ':generateContent';
  const prompt =
`Tu analyses un mail lié à une recherche d'emploi de Marie Gainche (Growth Marketer).
Sujet : "${sujet}"
Expéditeur : "${expediteur}"
Corps : "${corps}"

Règles :
- est_candidature = false si c'est une alerte emploi, une newsletter, une suggestion d'offres ou une pub (pas une candidature précise).
- entreprise = l'employeur visé, jamais la plateforme (LinkedIn, Indeed, Welcome to the Jungle, HelloWork, Teamtailor…). Nom court, sans « SAS », sans « .com ».
- plateforme = canal de candidature (LinkedIn, Welcome to the Jungle, HelloWork, Indeed, Cadremploi, Apec, InfoJobs, Email direct, ou le nom de l'ATS).
- statut : confirmation de réception = « Envoyé » ; refus = « Refus » ; proposition d'échange/entretien = « Entretien 1 » (« Entretien 2 » si 2e tour) ; autre réponse humaine = « Réponse reçue ».
- contactEmail = email d'un humain recruteur si présent, sinon "".`;

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': key },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            est_candidature: { type: 'BOOLEAN' },
            entreprise: { type: 'STRING' },
            poste: { type: 'STRING', enum: VALID_POSTES },
            plateforme: { type: 'STRING' },
            secteur: { type: 'STRING' },
            type: { type: 'STRING', enum: ['Réponse à offre', 'Candidature spontanée'] },
            statut: { type: 'STRING', enum: VALID_STATUSES },
            contactEmail: { type: 'STRING' },
          },
          required: ['est_candidature', 'entreprise', 'poste', 'plateforme', 'statut'],
        },
      },
    }),
  });
  const code = res.getResponseCode();
  if (code === 429 || code === 503 || code === 500) return 'RETRY';
  if (code !== 200) { Logger.log('🔴 Gemini HTTP ' + code + ' : ' + res.getContentText().substring(0, 300)); return null; }
  try {
    const obj = JSON.parse(res.getContentText());
    const parts = obj.candidates && obj.candidates[0].content && obj.candidates[0].content.parts;
    const txt = parts ? parts.map(p => p.text || '').join('') : '';
    return txt ? JSON.parse(txt) : null;
  } catch (e) { Logger.log('🔴 Réponse Gemini illisible : ' + e.message); return null; }
}


// ===================== LIENS D'OFFRE =====================
/** Cherche le meilleur lien d'offre dans tous les messages d'un thread (HTML inclus). */
function _meilleurLien(messages) {
  for (const m of messages) {
    const l = extraireLienOffre(m.getBody() + ' ' + m.getPlainBody());
    if (l) return l;
  }
  return '';
}

function extraireLienOffre(texte) {
  if (!texte) return '';
  const urls = (texte.match(/https?:\/\/[^\s"'<>\])]+/gi) || []).map(_nettoyerUrl);
  for (const brut of urls) {
    const u = _deballerRedirection(brut);
    if (_estLienOffre(u)) return _canoniser(u);
  }
  return '';
}

function _estLienOffre(u) {
  u = String(u || '');
  if (!/^https?:\/\//i.test(u)) return false;
  if (URL_EXCLUSIONS.some(p => p.test(u))) return false;
  return JOB_URL_PATTERNS.some(p => p.test(u));
}

function _nettoyerUrl(u) {
  return u.replace(/&amp;/g, '&').replace(/\\u003d/gi, '=').replace(/[.,;:'">\]]+$/, '').trim();
}

/** Déballe google.com/url?q=…, et les liens de tracking HelloWork (URL réelle encodée en base64). */
function _deballerRedirection(u) {
  try {
    const g = u.match(/google\.[a-z.]+\/url\?(?:.*&)?q=([^&]+)/i);
    if (g) return decodeURIComponent(g[1]);
    const hw = u.match(/hellowork\.com\/clic\/(?:[^/]+\/)+([A-Za-z0-9_-]{20,})$/);
    if (hw) {
      let b = hw[1]; while (b.length % 4) b += '=';
      const txt = Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString();
      const m = txt.match(/https?:\/\/\S+/);
      if (m) return m[0];
    }
  } catch (e) { /* lien laissé tel quel */ }
  return u;
}

/** URL courte et stable (retire tokens de tracking LinkedIn, utm…). */
function _canoniser(u) {
  const li = u.match(/linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/i);
  if (li) return 'https://www.linkedin.com/jobs/view/' + li[1] + '/';
  return u.replace(/[?&](utm_[a-z]+|trk[a-zA-Z]*|refId|trackingId|lipi|midToken|midSig|eid|otpToken)=[^&#]*/g, '')
          .replace(/\?&/, '?').replace(/[?&]$/, '');
}

function _ecrireLien(sheet, row, lien) {
  const c = sheet.getRange(row, COL.LIEN);
  c.setValue(lien).setBackground(null);
  if (/lien.*non trouvé/i.test(c.getNote())) c.clearNote();
}

function _marquerLienManquant(cell) {
  cell.setBackground('#FFE0B2').setNote('🔍 Lien non trouvé automatiquement (' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy') + '). À renseigner si besoin.');
}

/** Rattrapage nocturne : lignes sans lien valide, jamais tentées. 40 lignes max / nuit. */
function scanLiensManquants() {
  const t0 = Date.now();
  const sheet = _sheet();
  const n = sheet.getLastRow() - 1;
  if (n < 1) return;
  const data = sheet.getRange(2, 1, n, NB_COLS).getValues();
  const notes = sheet.getRange(2, COL.LIEN, n, 1).getNotes();
  let tentes = 0, trouves = 0;

  for (let i = 0; i < n && tentes < 40; i++) {
    if (Date.now() - t0 > CFG.MAX_RUNTIME_MS) break;
    const r = data[i];
    if (!r[0] || _estLienOffre(r[COL.LIEN - 1])) continue;
    if (/non trouvé/i.test(notes[i][0])) continue; // déjà tenté → on ne repasse pas
    tentes++;
    let lien = '';
    const tid = r[COL.THREAD - 1];
    if (tid) {
      try { lien = _meilleurLien(GmailApp.getThreadById(tid).getMessages()); } catch (e) {}
    }
    if (!lien) lien = _chercherLienGmail(String(r[0]), r[COL.DATE_ENVOI - 1]);
    if (lien) { _ecrireLien(sheet, i + 2, lien); trouves++; }
    else _marquerLienManquant(sheet.getRange(i + 2, COL.LIEN));
  }
  Logger.log('🔗 Liens : ' + trouves + ' trouvés sur ' + tentes + ' tentatives.');
}

function _chercherLienGmail(entreprise, dateEnvoi) {
  const nom = entreprise.replace(/[^\p{L}\p{N}\s.-]/gu, ' ').trim();
  if (!nom) return '';
  let filtre = '';
  if (dateEnvoi instanceof Date) {
    const a = new Date(dateEnvoi); a.setDate(a.getDate() - 2);
    const b = new Date(dateEnvoi); b.setDate(b.getDate() + 3);
    filtre = ' after:' + _fmtGmail(a) + ' before:' + _fmtGmail(b);
  }
  try {
    const threads = GmailApp.search('"' + nom + '"' + filtre, 0, 5);
    for (const t of threads) { const l = _meilleurLien(t.getMessages()); if (l) return l; }
  } catch (e) { Logger.log('Recherche Gmail : ' + e.message); }
  return '';
}


// ===================== NETTOYAGE DE L'HISTORIQUE (une fois) =====================
/**
 * Non destructif : les anciens liens non-offre sont déplacés en note, les doublons
 * possibles sont surlignés (jamais supprimés). Faire une copie du Sheet avant.
 */
function nettoyerHistorique() {
  const sheet = _sheet();
  _assurerEntetes(sheet);
  const n = sheet.getLastRow() - 1;
  if (n < 1) return;
  const rng = sheet.getRange(2, COL.POSTE, n, COL.LIEN - COL.POSTE + 1); // B:H
  const v = rng.getValues();
  const ents = sheet.getRange(2, 1, n, 1).getValues();
  const contacts = sheet.getRange(2, COL.CONTACT, n, 1).getValues();
  const notesLien = sheet.getRange(2, COL.LIEN, n, 1).getNotes();
  const bgA = sheet.getRange(2, 1, n, 1).getBackgrounds();
  const notesA = sheet.getRange(2, 1, n, 1).getNotes();
  const vus = {};
  const contactsModifies = [];
  const stats = { plateformes: 0, liensCanonises: 0, liensDeplaces: 0, doublons: 0, contacts: 0 };

  for (let i = 0; i < n; i++) {
    if (!ents[i][0]) continue;
    const r = v[i]; // 0=B poste,1=C plateforme,2=D secteur,3=E type,4=F statut,5=G date,6=H lien
    // Poste
    const p = String(r[0]).trim();
    if (/spontan/i.test(p)) { r[0] = 'candidature spontanée'; r[3] = 'Candidature spontanée'; }
    else if (!p || /non sp|inconnu/i.test(p)) r[0] = 'Inconnu';
    // Plateforme
    const np = normaliserPlateforme(r[1], String(contacts[i][0]), String(r[6]));
    if (np !== r[1]) { r[1] = np; stats.plateformes++; }
    // Secteur / type / statut
    if (!String(r[2]).trim() || /^inconnu$/i.test(String(r[2]).trim())) r[2] = 'Non spécifié';
    if (!String(r[3]).trim()) r[3] = 'Réponse à offre';
    if (!String(r[4]).trim()) r[4] = 'Envoyé';
    // Lien
    const lien = String(r[6]).trim();
    if (lien && _estLienOffre(lien)) {
      const c = _canoniser(lien); if (c !== lien) { r[6] = c; stats.liensCanonises++; }
    } else if (lien) {
      notesLien[i][0] = ('Ancien lien (pas une offre) : ' + lien + '\n' + notesLien[i][0]).trim();
      r[6] = ''; stats.liensDeplaces++;
    }
    // Contact = toi-même → inutile
    if (_estMoi(String(contacts[i][0]))) { contactsModifies.push(i + 2); stats.contacts++; }
    // Doublons
    const k = _cle(ents[i][0]);
    if (k && vus[k]) {
      bgA[i][0] = '#FFF59D';
      notesA[i][0] = ('Doublon possible avec la ligne ' + vus[k]).trim();
      stats.doublons++;
    } else if (k) vus[k] = i + 2;
  }

  rng.setValues(v);
  sheet.getRange(2, COL.LIEN, n, 1).setNotes(notesLien);
  sheet.getRange(2, 1, n, 1).setBackgrounds(bgA).setNotes(notesA);
  // Contacts : uniquement les cellules modifiées (préserve les liens mailto)
  contactsModifies.forEach(row => sheet.getRange(row, COL.CONTACT).setValue('Équipe RH'));

  const msg = '🧹 Nettoyage terminé\n\n' +
    '• Plateformes normalisées : ' + stats.plateformes + '\n' +
    '• Liens LinkedIn raccourcis : ' + stats.liensCanonises + '\n' +
    '• Faux liens déplacés en note : ' + stats.liensDeplaces + '\n' +
    '• Contacts « moi-même » remplacés : ' + stats.contacts + '\n' +
    '• Doublons possibles surlignés en jaune : ' + stats.doublons + '\n\n' +
    'Lance ensuite « Chercher les liens manquants » (40 lignes par passage).';
  Logger.log(msg);
  _alerte(msg);
  if (typeof rafraichirDashboards === 'function') rafraichirDashboards();
}


// ===================== DIAGNOSTIC (en cas de panne) =====================
function diagnostic() {
  const out = [];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET);
  out.push((sheet ? '✅' : '❌') + ' Onglet « ' + CFG.SHEET + ' »' + (sheet ? ' (' + (sheet.getLastRow() - 1) + ' lignes)' : ''));
  const lab = GmailApp.getUserLabelByName(CFG.LABEL_IN);
  out.push((lab ? '✅' : '❌') + ' Libellé « ' + CFG.LABEL_IN + ' »' + (lab ? ' : ' + lab.getThreads(0, 100).length + ' mail(s) en attente' : ''));
  const rev = GmailApp.getUserLabelByName(CFG.LABEL_REVIEW);
  if (rev) out.push('ℹ️ « ' + CFG.LABEL_REVIEW + ' » : ' + rev.getThreads(0, 100).length + ' mail(s) à vérifier à la main');
  out.push((_geminiKey() ? '✅' : '❌') + ' Clé GEMINI_API_KEY');
  if (_geminiKey()) {
    const r = _appelGemini('Merci pour votre candidature au poste de Growth Manager chez Test SAS.', 'Votre candidature', 'jobs@test.fr');
    out.push(r && r !== 'RETRY' ? '✅ Gemini répond' : (r === 'RETRY' ? '⚠️ Gemini saturé / quota (429-503)' : '❌ Gemini en erreur (voir journal)'));
  }
  const trig = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  ['automateJobToSheet', 'scanLiensManquants', 'rafraichirDashboards'].forEach(h =>
    out.push((trig.indexOf(h) !== -1 ? '✅' : '❌') + ' Trigger ' + h));
  const autres = trig.filter(h => ['automateJobToSheet', 'scanLiensManquants', 'rafraichirDashboards'].indexOf(h) === -1);
  if (autres.length) out.push('⚠️ Triggers en trop (anciens scripts ?) : ' + autres.join(', '));
  out.push((typeof rafraichirDashboards === 'function' ? '✅' : '❌') + ' Fichier Dashboard.gs présent');
  const msg = '🩺 Diagnostic\n\n' + out.join('\n');
  Logger.log(msg);
  _alerte(msg);
}


// ===================== UTILITAIRES =====================
function normaliserPlateforme(brut, expediteur, lien) {
  const s = [brut, expediteur, lien].map(x => String(x || '')).join(' ');
  const b = String(brut || '').trim();
  for (const [re, nom] of PLATEFORME_REGLES) if (re.test(b)) return nom;
  for (const [re, nom] of PLATEFORME_REGLES) if (re.test(s)) return nom;
  return b && !/^(inconnu|autres?|non sp.*)$/i.test(b) ? b : 'Autres';
}

function _indexer(sheet) {
  const last = sheet.getLastRow();
  const idx = { parCle: {}, parThread: {}, prochaineLigne: 2 };
  if (last < 2) return idx;
  const data = sheet.getRange(2, 1, last - 1, NB_COLS).getValues();
  for (let i = 0; i < data.length; i++) {
    if (!String(data[i][0]).trim()) continue;
    const row = i + 2;
    const k = _cle(data[i][0]);
    if (k && !idx.parCle[k]) idx.parCle[k] = row;    // trié par date desc → la plus récente gagne
    const t = String(data[i][COL.THREAD - 1] || '');
    if (t) idx.parThread[t] = row;
    idx.prochaineLigne = row + 1;
  }
  return idx;
}

/** Clé de dédoublonnage : « Vente-unique.com » = « VENTE UNIQUE.COM », « Mondial Relay by InPost » = « Mondial Relay » */
function _cle(nom) {
  return String(nom || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+by\s+.*$/, '')
    .replace(/\.(com|fr|io|co|net|es|eu)\b/g, ' ')
    .replace(/\b(sas|sasu|sa|sarl|sl|group|groupe|france|spain|espana|inc|ltd|gmbh)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

function _choisirContact(contactIA, msg) {
  const ok = e => e && e.includes('@') && !_estMoi(e);
  if (ok(contactIA)) return contactIA.trim();
  const from = _email(msg.getReplyTo() || msg.getFrom());
  if (ok(from)) return from;
  if (_estMoi(from)) { // c'est toi qui as écrit → le contact est le destinataire
    const to = String(msg.getTo() || '').split(',').map(_email).find(ok);
    if (to) return to;
  }
  return '';
}

function _setContact(sheet, row, contact) {
  const cell = sheet.getRange(row, COL.CONTACT);
  if (contact && contact.includes('@')) {
    cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(contact).setLinkUrl('mailto:' + contact).build());
  } else cell.setValue(contact);
}

function _email(s) { const m = String(s || '').match(/<([^>]+)>/); return (m ? m[1] : String(s || '')).trim(); }
function _estMoi(e) { return CFG.MY_EMAILS.some(me => String(e || '').toLowerCase().includes(me)); }
function _geminiKey() { return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'); }
function _label(nom) { return GmailApp.getUserLabelByName(nom) || GmailApp.createLabel(nom); }
function _fmtGmail(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy/MM/dd'); }

function _sheet() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET);
  if (!s) throw new Error('Onglet « ' + CFG.SHEET + ' » introuvable');
  return s;
}

function _assurerEntetes(sheet) {
  Object.keys(ENTETES_AJOUTEES).forEach(c => {
    const cell = sheet.getRange(1, Number(c));
    if (!cell.getValue()) cell.setValue(ENTETES_AJOUTEES[c]).setFontWeight('bold');
  });
}

function _trierParDate(sheet) {
  const last = sheet.getLastRow();
  if (last > 2) sheet.getRange(2, 1, last - 1, Math.max(sheet.getLastColumn(), NB_COLS)).sort({ column: COL.DATE_ENVOI, ascending: false });
}

function _alerte(msg) { try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* exécution par trigger : pas d'UI */ } }
