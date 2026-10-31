// ============================================================
// DASHBOARDS CANDIDATURES — v4 (31/10/2026)
// Remplace candidatures_2026 (v3) et restaurer_dashboard (obsolète, à supprimer).
// Nécessite Code.gs dans le même projet (normaliserPlateforme, CFG, COL).
// Rafraîchi automatiquement après chaque import Gmail + chaque matin à 6h.
// ============================================================

const DASH = { NOM: '📊 Dashboard', NOM_AB: '📊 Dashboard AB Test', RELANCE_J: 7 };

const STATUTS_DASHBOARD = ['Envoyé', 'En cours', 'Réponse reçue', 'Stand-by', 'Entretien 1',
                           'Entretien 2', 'Refus', 'Terminé', 'À faire', 'Pas commencé'];
const STATUTS_REPONSE = ['Réponse reçue', 'Stand-by', 'Entretien 1', 'Entretien 2', 'Refus', 'Terminé'];

function rafraichirDashboards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cand = ss.getSheetByName('Candidatures');
  if (!cand) { Logger.log("Onglet 'Candidatures' introuvable"); return; }
  _dashboardPrincipal(ss, cand);
  const ab = ss.getSheetByName('AB Test');
  if (ab) _dashboardABTest(ss, ab);
  SpreadsheetApp.flush();
}

// Compatibilité avec l'ancien bouton / ancien nom
function installerEtRafraichir() { rafraichirDashboards(); }


// ======================================================
// DASHBOARD PRINCIPAL
// ======================================================
function _dashboardPrincipal(ss, cand) {
  const s = _prepSheet(ss, DASH.NOM, ['Dashboard'], 1);
  const BLEU = '#1a73e8', BLEU_C = '#e8f0fe', VERT_C = '#e6f4ea', ORA_C = '#fff3e0',
        ROUGE_C = '#fce8e6', GRIS = '#f8f9fa';
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const fmt = d => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const today = fmt(now);
  const hier = fmt(new Date(now.getTime() - 86400000));

  // ---- Agrégation (une seule lecture) ----
  const data = cand.getDataRange().getValues().slice(1).filter(r => String(r[0]).trim());
  const total = data.length;
  const parStatut = {}, parPlat = {}, parJour = {};
  let ceMois = 0, nJ = 0, nJ1 = 0, aRelancer = 0;
  data.forEach(r => {
    const st = String(r[COL.STATUT - 1] || '').trim();
    parStatut[STATUTS_DASHBOARD.indexOf(st) !== -1 ? st : 'Autre / vide'] =
      (parStatut[STATUTS_DASHBOARD.indexOf(st) !== -1 ? st : 'Autre / vide'] || 0) + 1;
    const pl = normaliserPlateforme(r[COL.PLATEFORME - 1], r[COL.CONTACT - 1], r[COL.LIEN - 1]);
    const plK = PLATEFORMES_DASHBOARD.indexOf(pl) !== -1 ? pl : 'Autres';
    parPlat[plK] = (parPlat[plK] || 0) + 1;
    const d = r[COL.DATE_ENVOI - 1];
    if (d instanceof Date) {
      const k = fmt(d);
      parJour[k] = (parJour[k] || 0) + 1;
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) ceMois++;
      if (k === today) nJ++;
      if (k === hier) nJ1++;
      const age = (now - d) / 86400000;
      if (st === 'Envoyé' && age >= DASH.RELANCE_J && age <= 14) aRelancer++;
    }
  });
  const entretiens = (parStatut['Entretien 1'] || 0) + (parStatut['Entretien 2'] || 0);
  const reponses = STATUTS_REPONSE.reduce((a, k) => a + (parStatut[k] || 0), 0);
  const pct = (n, d) => d > 0 ? Math.round(n / d * 1000) / 10 + ' %' : '0 %';

  // ---- Titre + KPIs ----
  s.getRange('A1:G1').merge().setValue('📊 Dashboard Candidatures')
    .setBackground(BLEU).setFontColor('#fff').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  s.getRange('A2:G2').merge().setValue('Mise à jour : ' + Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm'))
    .setBackground(BLEU_C).setFontSize(10).setFontStyle('italic').setHorizontalAlignment('center');

  const kpis = [
    ['A4:B4', 'A5:B5', '📤 Total envois', total, BLEU_C, BLEU],
    ['C4:D4', 'C5:D5', '🎯 Entretiens', entretiens + ' (' + pct(entretiens, total) + ')', VERT_C, '#34a853'],
    ['E4:F4', 'E5:F5', '📬 Taux de réponse', pct(reponses, total), ORA_C, '#ff6d00'],
    ['G4', 'G5', '❌ Refus', parStatut['Refus'] || 0, ROUGE_C, '#c5221f'],
  ];
  kpis.forEach(([h, v, lib, val, bg, fc]) => {
    s.getRange(h).merge().setValue(lib).setBackground(bg).setFontWeight('bold').setHorizontalAlignment('center');
    s.getRange(v).merge().setValue(val).setBackground(bg).setFontSize(20).setFontWeight('bold')
      .setFontColor(fc).setHorizontalAlignment('center');
  });
  s.setRowHeight(5, 55);

  // ---- Tableaux statut / plateforme (écriture en bloc) ----
  s.getRange('A7:C7').merge().setValue('📋 Répartition par statut')
    .setBackground(BLEU).setFontColor('#fff').setFontWeight('bold');
  s.getRange('E7:G7').merge().setValue('🌐 Répartition par plateforme')
    .setBackground(BLEU).setFontColor('#fff').setFontWeight('bold');

  const lignesSt = [['Statut', 'Nb', '%']]
    .concat(STATUTS_DASHBOARD.concat(['Autre / vide']).map(k => [k, parStatut[k] || 0, pct(parStatut[k] || 0, total)]))
    .concat([['TOTAL', total, '100 %']]);
  const lignesPl = [['Plateforme', 'Nb', '%']]
    .concat(PLATEFORMES_DASHBOARD.concat(['Autres']).map(k => [k, parPlat[k] || 0, pct(parPlat[k] || 0, total)]))
    .concat([['TOTAL', total, '100 %']]);
  _tableau(s, 8, 1, lignesSt, GRIS);
  _tableau(s, 8, 5, lignesPl, GRIS);

  // ---- Activité ----
  let r = 8 + Math.max(lignesSt.length, lignesPl.length) + 1;
  s.getRange(r, 1, 1, 7).merge().setValue('🕐 Activité')
    .setBackground(BLEU).setFontColor('#fff').setFontWeight('bold');
  const evo = nJ - nJ1;
  const act = [
    ['Ce mois', ceMois, '', 'À relancer (Envoyé, J+7 à J+14)', '', aRelancer, ''],
    ["Aujourd'hui (J)", nJ, '', 'Hier (J-1)', '', nJ1, (evo > 0 ? '▲ +' : evo < 0 ? '▼ ' : '= ') + evo],
  ];
  s.getRange(r + 1, 1, 2, 7).setValues(act)
    .setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  s.getRange(r + 1, 1, 2, 1).setFontWeight('bold').setBackground(GRIS);
  s.getRange(r + 1, 4, 2, 1).setFontWeight('bold').setBackground(GRIS);
  s.getRange(r + 2, 7).setFontColor(evo > 0 ? '#34a853' : evo < 0 ? '#c5221f' : '#666');

  // ---- Graphiques (données dans colonnes masquées I:L) ----
  const jours = Object.keys(parJour).sort();
  const g1 = [['Date', 'Candidatures']].concat(jours.map(j => [j, parJour[j]]));
  const g2 = [['Date', 'Candidatures']];
  for (let i = 13; i >= 0; i--) { const k = fmt(new Date(now.getTime() - i * 86400000)); g2.push([k, parJour[k] || 0]); }
  s.getRange(1, 9, g1.length, 2).setValues(g1);
  s.getRange(1, 11, g2.length, 2).setValues(g2);
  s.hideColumns(9, 4);

  const gR = r + 4;
  s.getRange(gR, 1, 1, 7).merge().setValue('📈 Candidatures par jour — depuis le début')
    .setBackground(BLEU).setFontColor('#fff').setFontWeight('bold');
  s.getRange(gR + 21, 1, 1, 7).merge().setValue('📈 Candidatures par jour — 14 derniers jours')
    .setBackground(BLEU).setFontColor('#fff').setFontWeight('bold');
  _graph(s, s.getRange(1, 9, g1.length, 2), 'Candidatures par jour — depuis le début', '#1a73e8', gR + 1);
  _graph(s, s.getRange(1, 11, g2.length, 2), 'Candidatures par jour — 14 derniers jours', '#34a853', gR + 22);

  [170, 70, 70, 20, 190, 70, 90].forEach((w, i) => s.setColumnWidth(i + 1, w));
}

function _tableau(s, row, col, lignes, gris) {
  const rg = s.getRange(row, col, lignes.length, 3);
  rg.setValues(lignes).setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  s.getRange(row, col, 1, 3).setFontWeight('bold').setBackground(gris);
  s.getRange(row + lignes.length - 1, col, 1, 3).setFontWeight('bold');
}

function _graph(s, range, titre, couleur, ligne) {
  s.insertChart(s.newChart().asColumnChart().addRange(range).setTitle(titre)
    .setXAxisTitle('Date').setYAxisTitle('Nb candidatures').setColors([couleur])
    .setLegendPosition(Charts.Position.NONE).setPosition(ligne, 1, 0, 0).build());
}

/** Récupère/crée l'onglet, le vide (valeurs, formats, graphiques). */
function _prepSheet(ss, nom, alias, position) {
  let s = ss.getSheetByName(nom);
  for (let i = 0; !s && i < alias.length; i++) s = ss.getSheetByName(alias[i]);
  if (!s) s = ss.insertSheet(nom, position);
  s.getCharts().forEach(c => s.removeChart(c));
  s.clear();
  s.getRange(1, 1, s.getMaxRows(), s.getMaxColumns()).breakApart();
  if (s.getName() !== nom) s.setName(nom);
  return s;
}


// ======================================================
// DASHBOARD AB TEST (logique v3 conservée, écriture en bloc)
// Colonnes AB Test : A=N° B=Date C=Entreprise D=Poste E=Plateforme
// F=Langue G=Version CV H=Statut I=Réponse perso (O/N) J=Entretien (O/N)
// ======================================================
function _dashboardABTest(ss, ab) {
  const s = _prepSheet(ss, DASH.NOM_AB, ['Dashboard AB Test'], ss.getSheets().length);
  const VIOLET = '#6200ea', VIOLET_C = '#ede7f6', GRIS = '#f8f9fa';
  const tz = ss.getSpreadsheetTimeZone();

  const stats = {};
  ['FR', 'EN', 'ES'].forEach(l => stats[l] = { A: { e: 0, r: 0, i: 0 }, B: { e: 0, r: 0, i: 0 } });
  ab.getDataRange().getValues().slice(1).forEach(row => {
    if (!String(row[0]).trim()) return;
    const l = String(row[5]).trim().toUpperCase(), v = String(row[6]).trim().toUpperCase();
    if (!stats[l] || !stats[l][v]) return;
    stats[l][v].e++;
    if (String(row[8]).trim().toUpperCase() === 'O') stats[l][v].r++;
    if (String(row[9]).trim().toUpperCase() === 'O') stats[l][v].i++;
  });

  s.getRange('A1:G1').merge().setValue('🧪 Dashboard A/B Test CV — Résultats')
    .setBackground(VIOLET).setFontColor('#fff').setFontSize(15).setFontWeight('bold').setHorizontalAlignment('center');
  s.getRange('A2:D2').merge().setValue('Mise à jour : ' + Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm'))
    .setBackground(VIOLET_C).setFontSize(10).setFontStyle('italic').setHorizontalAlignment('center');

  const legende = [
    ['Légende', ''],
    ['🇫🇷 FR — CV A', '1 page compact, FR (09/2026)'], ['🇫🇷 FR — CV B', '2 pages aéré, FR (08/2026)'],
    ['🇬🇧 EN — CV A', '1 page compact, EN (09/2026)'], ['🇬🇧 EN — CV B', '2 pages aéré, EN (09/2026)'],
    ['🇪🇸 ES — CV A', '1 page compact, ES (09/2026)'], ['🇪🇸 ES — CV B', '2 pages aéré, ES (09/2026)'],
  ];
  s.getRange(4, 6, legende.length, 2).setValues(legende)
    .setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  s.getRange(4, 6).setFontWeight('bold').setBackground(GRIS);

  const pct = (n, d) => d > 0 ? Math.round(n / d * 100) + ' %' : '0 %';
  const av = (a, b) => a > b ? 'CV A ✅' : b > a ? 'CV B ✅' : 'Égalité';
  [['FR', '🇫🇷', 4], ['EN', '🇬🇧', 13], ['ES', '🇪🇸', 22]].forEach(([l, emoji, row]) => {
    const A = stats[l].A, B = stats[l].B;
    const tA = A.e ? A.r / A.e : 0, tB = B.e ? B.r / B.e : 0;
    const eA = A.r ? A.i / A.r : 0, eB = B.r ? B.i / B.r : 0;
    s.getRange(row, 1, 1, 4).merge().setValue(emoji + ' CV ' + l + ' — CV A (1 page) vs CV B (2 pages)')
      .setBackground(VIOLET).setFontColor('#fff').setFontWeight('bold');
    s.getRange(row + 1, 1, 6, 4).setValues([
      ['Métrique', 'CV A – 1 page', 'CV B – 2 pages', 'Avantage'],
      ['📤 Envois', A.e, B.e, av(A.e, B.e)],
      ['💬 Réponses perso', A.r, B.r, av(A.r, B.r)],
      ['📈 Taux de réponse', pct(A.r, A.e), pct(B.r, B.e), av(tA, tB)],
      ['🎯 Entretiens obtenus', A.i, B.i, av(A.i, B.i)],
      ['📊 Taux entretien / réponse', pct(A.i, A.r), pct(B.i, B.r), av(eA, eB)],
    ]);
    s.getRange(row + 1, 1, 1, 4).setFontWeight('bold').setBackground(GRIS);
    s.getRange(row, 1, 7, 4).setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  });
  [210, 115, 115, 120, 20, 165, 210].forEach((w, i) => s.setColumnWidth(i + 1, w));
}
