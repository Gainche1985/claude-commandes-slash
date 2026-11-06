// ============================================================
// BOUTON « ➕ Tracker » (06/11/2026)
// Pour les sites qui n'envoient pas de mail de confirmation (InfoJobs, sites carrière…).
// Un favori dans Chrome envoie la page d'offre ouverte à cette mini application web,
// qui crée la ligne dans « Candidatures » (Gemini extrait l'entreprise et le poste).
//
// Mise en place : Déployer → Nouveau déploiement → Application Web
//   Exécuter en tant que : Moi · Qui a accès : Tout le monde
//   (protégé par une clé secrète propre au favori : sans elle, rien n'est écrit)
// puis menu 🔍 Candidatures → ➕ Installer le bouton Tracker.
// ============================================================

var BOUTON_BOOKMARKLET = "javascript:(()=>{const W='__W__';const g=s=>{const n=document.querySelector(s);return n?(n.content||n.innerText||''):''};const p=new URLSearchParams({k:'__K__',u:location.href,t:document.title,h:g('h1'),o:g('meta[property=\"og:site_name\"]'),x:(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,1200)});window.open(W+'?'+p.toString(),'_blank','width=560,height=420');})()";

/** Reçoit la page d'offre envoyée par le favori et ajoute la candidature. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.u) return _pageBouton('ℹ️ Bouton Tracker', 'Clique sur le favori « ➕ Tracker » depuis la page d\'une offre.');
  if (String(p.k || '') !== _tokenBouton()) return _pageBouton('⛔ Accès refusé', 'Clé du bouton invalide. Réinstalle le favori via le menu 🔍 Candidatures → ➕ Installer le bouton Tracker.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return _pageBouton('⏳ Occupé', 'Le tracker est en cours de mise à jour. Réessaie dans une minute.');
  try {
    const sheet = _sheet();
    _assurerEntetes(sheet);
    const lien = _canoniser(_nettoyerUrl(String(p.u)));

    // Déjà présent ? (même lien d'annonce)
    const n = sheet.getLastRow() - 1;
    if (n > 0) {
      const liens = sheet.getRange(2, COL.LIEN, n, 1).getValues().map(r => String(r[0]));
      const i = liens.indexOf(lien);
      if (i !== -1) return _pageBouton('👌 Déjà dans le tracker', 'Ligne ' + (i + 2) + ' : ' + _html(sheet.getRange(i + 2, 1).getValue()));
    }

    const info = _geminiOffre(p) || {};
    let entreprise = String(info.entreprise || '').trim();
    if (!entreprise || ENTREPRISES_BLACKLIST.test(entreprise)) entreprise = 'À compléter';
    const poste = VALID_POSTES.indexOf(info.poste) !== -1 ? info.poste : 'Inconnu';
    const host = (lien.match(/^https?:\/\/([^/]+)/) || [])[1] || '';
    const plateforme = normaliserPlateforme(host, '', lien);
    const now = new Date();

    const row = _indexer(sheet).prochaineLigne;
    sheet.getRange(row, 1, 1, 8).setValues([[
      entreprise, poste, plateforme, info.secteur || 'Non spécifié',
      info.type || 'Réponse à offre', 'Envoyé', now, lien,
    ]]);
    sheet.getRange(row, COL.CONTACT).setValue('Équipe RH');
    sheet.getRange(row, COL.MAJ).setValue(now);
    if (entreprise === 'À compléter') sheet.getRange(row, 1).setBackground('#FFE0B2');
    _trierParDate(sheet);

    return _pageBouton('✅ Ajouté au tracker',
      '<b>' + _html(entreprise) + '</b><br>' + _html(info.intitule || poste) + ' · ' + _html(plateforme) +
      (entreprise === 'À compléter' ? '<br><br>⚠️ Entreprise non détectée : complète la cellule orange dans le Sheet.' : ''));
  } catch (err) {
    return _pageBouton('❌ Erreur', _html(err.message));
  } finally {
    lock.releaseLock();
  }
}

/** Gemini : entreprise + poste à partir de la page d'offre. */
function _geminiOffre(p) {
  const key = _geminiKey();
  if (!key) return null;
  const prompt =
`Page d'offre d'emploi sur laquelle Marie Gainche (Growth Marketer) vient de postuler.
URL : ${p.u}
Titre de la page : ${p.t || ''}
Titre principal (h1) : ${p.h || ''}
Site : ${p.o || ''}
Début du texte de la page : ${p.x || ''}

Règles :
- entreprise = l'employeur qui recrute (sur InfoJobs : le nom affiché sous l'intitulé de l'offre). Jamais le site d'emploi (InfoJobs, Indeed, LinkedIn…). Offre confidentielle : "Confidentiel (<ville>)". Introuvable : "".
- intitule = l'intitulé exact de l'offre.
- poste = l'élément le plus proche dans la liste imposée.`;
  const schema = {
    type: 'OBJECT',
    properties: {
      entreprise: { type: 'STRING' },
      intitule: { type: 'STRING' },
      poste: { type: 'STRING', enum: VALID_POSTES },
      secteur: { type: 'STRING' },
      type: { type: 'STRING', enum: ['Réponse à offre', 'Candidature spontanée'] },
    },
    required: ['entreprise', 'intitule', 'poste'],
  };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CFG.GEMINI_MODEL + ':generateContent';
  for (let i = 1; i <= 2; i++) {
    const res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': key },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: schema },
      }),
    });
    const code = res.getResponseCode();
    if (code === 200) {
      try {
        const parts = JSON.parse(res.getContentText()).candidates[0].content.parts;
        return JSON.parse(parts.map(x => x.text || '').join(''));
      } catch (e) { return null; }
    }
    if (code !== 429 && code !== 503 && code !== 500) return null;
    Utilities.sleep(3000);
  }
  return null;
}

/** Menu : fenêtre qui fabrique le favori avec l'URL de déploiement. */
function installerBoutonTracker() {
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  if (!/\/exec$/.test(url)) url = '';
  const html = HtmlService.createHtmlOutput(
`<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">
<p><b>1.</b> URL de l'application Web (Déployer → Gérer les déploiements → copier l'URL qui finit par <code>/exec</code>) :</p>
<input id="u" style="width:100%;padding:6px" placeholder="https://script.google.com/macros/s/.../exec" value="${url}" oninput="build()">
<p><b>2.</b> Affiche la barre de favoris (<b>Ctrl+Maj+B</b>), puis <b>glisse ce bouton dedans</b> :</p>
<p style="text-align:center"><a id="bm" href="#" style="display:inline-block;padding:8px 16px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">➕ Tracker</a></p>
<p style="color:#666;font-size:12px">Si le glisser ne marche pas : clic droit sur la barre de favoris → Ajouter une page → Nom : <b>➕ Tracker</b>, URL : colle le code ci-dessous.</p>
<textarea id="c" style="width:100%;height:70px;font-size:11px" readonly onclick="this.select()"></textarea>
<p id="w" style="color:#c5221f"></p>
<script>
const TPL = ${JSON.stringify(BOUTON_BOOKMARKLET.replace('__K__', _tokenBouton()))};
function build(){
  const w = document.getElementById('u').value.trim();
  const ok = /^https:\\/\\/script\\.google\\.com\\/.+\\/exec$/.test(w);
  document.getElementById('w').textContent = ok ? '' : 'Colle d\\'abord l\\'URL qui finit par /exec.';
  const code = ok ? TPL.replace('__W__', w) : '';
  document.getElementById('bm').href = code || '#';
  document.getElementById('c').value = code;
}
build();
</script></div>`).setWidth(560).setHeight(470);
  SpreadsheetApp.getUi().showModalDialog(html, '➕ Installer le bouton Tracker');
}

function _pageBouton(titre, msg) {
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + CFG.SPREADSHEET_ID + '/edit';
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:16px;font-size:15px;line-height:1.5">' +
    '<h2 style="margin-top:0">' + titre + '</h2><p>' + msg + '</p>' +
    (sheetUrl ? '<p><a href="' + sheetUrl + '" target="_blank">Ouvrir le tracker</a></p>' : '') +
    '<p style="color:#888;font-size:12px">Tu peux fermer cette fenêtre.</p></div>'
  ).setTitle(titre);
}

/** Clé secrète du favori (créée une fois, stockée dans les Propriétés du script). */
function _tokenBouton() {
  const props = PropertiesService.getScriptProperties();
  let t = props.getProperty('BOUTON_TOKEN');
  if (!t) { t = Utilities.getUuid().replace(/-/g, ''); props.setProperty('BOUTON_TOKEN', t); }
  return t;
}

function _html(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
