// ============================================================
// SCRIPT : Restauration des Dashboards — Candidatures Marie
// À coller dans Extensions > Apps Script > Nouveau script
// Puis cliquer sur ▶ "restaurerDashboards"
// ============================================================

function restaurerDashboards() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Vérification des onglets sources ---
  var candidaturesSheet = ss.getSheetByName("Candidatures");
  var abTestSheet       = ss.getSheetByName("AB Test");
  var dashboardSheet    = ss.getSheetByName("Dashboard");

  if (!candidaturesSheet) { SpreadsheetApp.getUi().alert("❌ Onglet 'Candidatures' introuvable."); return; }
  if (!abTestSheet)       { SpreadsheetApp.getUi().alert("❌ Onglet 'AB Test' introuvable."); return; }

  // =========================================================
  // ÉTAPE 1 — Renommer l'onglet Dashboard actuel (AB Test cassé)
  // et reconstruire ses formules correctement
  // =========================================================
  if (dashboardSheet) {
    dashboardSheet.setName("📊 Dashboard AB Test");
    _reconstruireDashboardABTest(dashboardSheet);
    SpreadsheetApp.flush();
  } else {
    // Si le Dashboard AB Test a déjà été renommé, on le retrouve
    var existingAB = ss.getSheetByName("📊 Dashboard AB Test");
    if (existingAB) {
      _reconstruireDashboardABTest(existingAB);
    }
  }

  // =========================================================
  // ÉTAPE 2 — Créer le Dashboard principal (stats globales)
  // Inséré en position 2, après "Candidatures"
  // =========================================================
  var mainDash = ss.getSheetByName("📊 Dashboard");
  if (!mainDash) {
    mainDash = ss.insertSheet("📊 Dashboard", 1); // index 1 = 2e onglet
  } else {
    mainDash.clear();
  }
  _construireDashboardPrincipal(mainDash);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✅ Dashboards restaurés !\n\n• 📊 Dashboard → stats globales candidatures\n• 📊 Dashboard AB Test → comparatif CV A vs B (corrigé)");
}


// ============================================================
// DASHBOARD PRINCIPAL — stats du suivi global
// Colonnes Candidatures : A=Entreprise B=Poste C=Plateforme
// D=Secteur E=Type F=Statut G=Date H=Lien I=Contact J=ATS K=CV
// ============================================================
function _construireDashboardPrincipal(sheet) {
  sheet.clear();

  var c = sheet.getRange.bind(sheet); // raccourci

  // --- Couleurs ---
  var BLEU_FOND   = "#1a73e8";
  var BLEU_CLAIR  = "#e8f0fe";
  var VERT        = "#34a853";
  var VERT_CLAIR  = "#e6f4ea";
  var ORANGE      = "#ff6d00";
  var ORANGE_CLAIR= "#fff3e0";
  var GRIS_FOND   = "#f8f9fa";
  var BLANC       = "#ffffff";

  // ---- TITRE ----
  sheet.getRange("A1:G1").merge()
    .setValue("📊 Dashboard Candidatures")
    .setBackground(BLEU_FOND)
    .setFontColor("#ffffff")
    .setFontSize(16)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sheet.getRange("A2:G2").merge()
    .setFormula("=\"Mise à jour : \"&TEXT(NOW(),\"dd/mm/yyyy HH:mm\")")
    .setBackground(BLEU_CLAIR)
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setFontStyle("italic");

  // ---- KPI BLOC : ligne 4 ----
  // KPI 1 — Total envois
  sheet.getRange("A4:B4").merge()
    .setValue("📤 Total envois")
    .setBackground(BLEU_CLAIR)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange("A5:B5").merge()
    .setFormula("=COUNTA(Candidatures!A2:A5000)-COUNTIF(Candidatures!A2:A5000,\"\")")
    .setBackground(BLEU_CLAIR)
    .setFontSize(22)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setFontColor(BLEU_FOND);

  // KPI 2 — Entretiens
  sheet.getRange("C4:D4").merge()
    .setValue("🎯 Entretiens")
    .setBackground(VERT_CLAIR)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange("C5:D5").merge()
    .setFormula("=COUNTIFS(Candidatures!F2:F5000,\"Entretien*\")+COUNTIFS(Candidatures!F2:F5000,\"Entretien 1\")")
    .setBackground(VERT_CLAIR)
    .setFontSize(22)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setFontColor(VERT);

  // KPI 3 — Taux de réponse
  sheet.getRange("E4:F4").merge()
    .setValue("📬 Taux de réponse")
    .setBackground(ORANGE_CLAIR)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange("E5:F5").merge()
    .setFormula("=IFERROR(TEXT((COUNTIFS(Candidatures!F2:F5000,\"Réponse reçue\")+COUNTIFS(Candidatures!F2:F5000,\"Entretien*\")+COUNTIFS(Candidatures!F2:F5000,\"Refus\"))/MAX(1,COUNTA(Candidatures!A2:A5000)-COUNTIF(Candidatures!A2:A5000,\"\")),\"0%\"),\"0%\")")
    .setBackground(ORANGE_CLAIR)
    .setFontSize(22)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setFontColor(ORANGE);

  // KPI 4 — Refus
  sheet.getRange("G4").setValue("❌ Refus")
    .setBackground("#fce8e6")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange("G5")
    .setFormula("=COUNTIF(Candidatures!F2:F5000,\"Refus\")")
    .setBackground("#fce8e6")
    .setFontSize(22)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setFontColor("#c5221f");

  // ---- SECTION : Répartition par statut ----
  sheet.getRange("A7:C7").merge()
    .setValue("📋 Répartition par statut")
    .setBackground(BLEU_FOND)
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  var statuts = ["Envoyé","En cours","Réponse reçue","Entretien 1","Refus","Terminé"];
  var row = 8;
  sheet.getRange(row, 1).setValue("Statut").setFontWeight("bold").setBackground(GRIS_FOND);
  sheet.getRange(row, 2).setValue("Nb").setFontWeight("bold").setBackground(GRIS_FOND);
  sheet.getRange(row, 3).setValue("%").setFontWeight("bold").setBackground(GRIS_FOND);
  row++;
  statuts.forEach(function(s) {
    sheet.getRange(row, 1).setValue(s);
    sheet.getRange(row, 2).setFormula("=COUNTIF(Candidatures!$F:$F,\"" + s + "\")");
    sheet.getRange(row, 3).setFormula("=IFERROR(TEXT(B" + row + "/MAX(1,SUM($B$9:$B$14)),\"0%\"),\"-\")");
    row++;
  });
  // Total
  sheet.getRange(row, 1).setValue("TOTAL").setFontWeight("bold");
  sheet.getRange(row, 2).setFormula("=SUM(B9:B14)").setFontWeight("bold");
  sheet.getRange(row, 3).setValue("100%").setFontWeight("bold");

  // ---- SECTION : Répartition par plateforme ----
  sheet.getRange("E7:G7").merge()
    .setValue("🌐 Répartition par plateforme")
    .setBackground(BLEU_FOND)
    .setFontColor("#ffffff")
    .setFontWeight("bold");

  var plateformes = ["LinkedIn","Indeed","Welcome to the Jungle","Site carrière","Cadremploi","HelloWork","Autres"];
  var prow = 8;
  sheet.getRange(prow, 5).setValue("Plateforme").setFontWeight("bold").setBackground(GRIS_FOND);
  sheet.getRange(prow, 6).setValue("Nb").setFontWeight("bold").setBackground(GRIS_FOND);
  sheet.getRange(prow, 7).setValue("%").setFontWeight("bold").setBackground(GRIS_FOND);
  prow++;
  plateformes.forEach(function(p) {
    sheet.getRange(prow, 5).setValue(p);
    sheet.getRange(prow, 6).setFormula("=COUNTIF(Candidatures!$C:$C,\"" + p + "\")");
    sheet.getRange(prow, 7).setFormula("=IFERROR(TEXT(F" + prow + "/MAX(1,SUM($F$9:$F$15)),\"0%\"),\"-\")");
    prow++;
  });

  // ---- SECTION : Candidatures récentes ----
  var recRow = 17;
  sheet.getRange(recRow, 1, 1, 6).merge()
    .setValue("🕐 Candidatures ce mois-ci")
    .setBackground(BLEU_FOND)
    .setFontColor("#ffffff")
    .setFontWeight("bold");
  recRow++;
  sheet.getRange(recRow, 1).setValue("Ce mois").setFontWeight("bold").setBackground(GRIS_FOND);
  sheet.getRange(recRow, 2)
    .setFormula("=COUNTIFS(Candidatures!G2:G5000,\">=\"&DATE(YEAR(TODAY()),MONTH(TODAY()),1),Candidatures!G2:G5000,\"<\"&DATE(YEAR(TODAY()),MONTH(TODAY())+1,1))")
    .setFontWeight("bold").setFontSize(14);

  // ---- Formatage général ----
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 20);
  sheet.setColumnWidth(5, 160);
  sheet.setColumnWidth(6, 80);
  sheet.setColumnWidth(7, 80);
  sheet.setRowHeight(5, 55);

  // Bordures sur les tableaux statuts
  sheet.getRange("A8:C16").setBorder(true, true, true, true, true, true, "#dadce0", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange("E8:G15").setBorder(true, true, true, true, true, true, "#dadce0", SpreadsheetApp.BorderStyle.SOLID);
}


// ============================================================
// DASHBOARD AB TEST — comparatif CV A vs CV B
// Colonnes AB Test : A=N° B=Date C=Entreprise D=Poste
// E=Plateforme F=Langue G=Version CV H=Statut
// I=Réponse perso (O/N) J=Entretien (O/N) K=Notes
// ============================================================
function _reconstruireDashboardABTest(sheet) {
  sheet.clear();

  var VIOLET_FOND  = "#6200ea";
  var VIOLET_CLAIR = "#ede7f6";
  var VERT         = "#34a853";
  var GRIS_FOND    = "#f8f9fa";

  // ---- TITRE ----
  sheet.getRange("A1:G1").merge()
    .setValue("🧪 Dashboard A/B Test CV — Résultats")
    .setBackground(VIOLET_FOND)
    .setFontColor("#ffffff")
    .setFontSize(15)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sheet.getRange("A2:G2").merge()
    .setFormula("=\"Mise à jour : \"&TEXT(NOW(),\"dd/mm/yyyy HH:mm\")")
    .setBackground(VIOLET_CLAIR)
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setFontStyle("italic");

  // ---- Légende des versions ----
  sheet.getRange("F4").setValue("Légende").setFontWeight("bold").setBackground(GRIS_FOND);
  var legende = [
    ["🇫🇷 FR — CV A", "1 page compact, FR (09/2026)"],
    ["🇫🇷 FR — CV B", "2 pages aéré, FR (08/2026)"],
    ["🇬🇧 EN — CV A", "1 page compact, EN (09/2026)"],
    ["🇬🇧 EN — CV B", "2 pages aéré, EN (09/2026)"],
    ["🇪🇸 ES — CV A", "1 page compact, ES (09/2026)"],
    ["🇪🇸 ES — CV B", "2 pages aéré, ES (09/2026)"]
  ];
  sheet.getRange(5, 6, legende.length, 2).setValues(legende);
  sheet.getRange(5, 6, legende.length, 2).setBorder(true,true,true,true,true,true,"#dadce0",SpreadsheetApp.BorderStyle.SOLID);

  // ---- Fonction helper pour un bloc langue ----
  function _blocLangue(startRow, emoji, langue, code) {
    // Titre bloc
    sheet.getRange(startRow, 1, 1, 4).merge()
      .setValue(emoji + " CV " + langue + " — CV A (1 page) vs CV B (2 pages)")
      .setBackground(VIOLET_FOND)
      .setFontColor("#ffffff")
      .setFontWeight("bold");

    // En-tête
    var headers = [["Métrique","CV A – 1 page","CV B – 2 pages","Avantage"]];
    sheet.getRange(startRow+1, 1, 1, 4).setValues(headers)
      .setBackground(GRIS_FOND)
      .setFontWeight("bold");

    var r = startRow + 2;

    // Formules de base : nb envois
    var envA = "=COUNTIFS('AB Test'!$F:$F,\"" + code + "\",'AB Test'!$G:$G,\"A\",'AB Test'!$A:$A,\">0\")";
    var envB = "=COUNTIFS('AB Test'!$F:$F,\"" + code + "\",'AB Test'!$G:$G,\"B\",'AB Test'!$A:$A,\">0\")";

    // Ligne envois
    sheet.getRange(r, 1).setValue("📤 Envois");
    sheet.getRange(r, 2).setFormula(envA);
    sheet.getRange(r, 3).setFormula(envB);
    sheet.getRange(r, 4).setFormula("=IF(B" + r + ">C" + r + ",\"CV A ✅\",IF(C" + r + ">B" + r + ",\"CV B ✅\",\"Égalité\"))");
    r++;

    // Ligne réponses perso
    var repA = "=COUNTIFS('AB Test'!$F:$F,\"" + code + "\",'AB Test'!$G:$G,\"A\",'AB Test'!$I:$I,\"O\")";
    var repB = "=COUNTIFS('AB Test'!$F:$F,\"" + code + "\",'AB Test'!$G:$G,\"B\",'AB Test'!$I:$I,\"O\")";
    sheet.getRange(r, 1).setValue("💬 Réponses perso");
    sheet.getRange(r, 2).setFormula(repA);
    sheet.getRange(r, 3).setFormula(repB);
    sheet.getRange(r, 4).setFormula("=IF(B" + r + ">C" + r + ",\"CV A ✅\",IF(C" + r + ">B" + r + ",\"CV B ✅\",\"Égalité\"))");
    r++;

    // Taux de réponse
    sheet.getRange(r, 1).setValue("📈 Taux de réponse");
    var txA_row = r - 1; var env_row = r - 2;
    sheet.getRange(r, 2).setFormula("=IFERROR(TEXT(B" + txA_row + "/MAX(1,B" + env_row + "),\"0%\"),\"0%\")");
    sheet.getRange(r, 3).setFormula("=IFERROR(TEXT(C" + txA_row + "/MAX(1,C" + env_row + "),\"0%\"),\"0%\")");
    sheet.getRange(r, 4).setFormula("=IF(B" + r + ">C" + r + ",\"CV A ✅\",IF(C" + r + ">B" + r + ",\"CV B ✅\",\"Égalité\"))");
    r++;

    // Entretiens
    var entA = "=COUNTIFS('AB Test'!$F:$F,\"" + code + "\",'AB Test'!$G:$G,\"A\",'AB Test'!$J:$J,\"O\")";
    var entB = "=COUNTIFS('AB Test'!$F:$F,\"" + code + "\",'AB Test'!$G:$G,\"B\",'AB Test'!$J:$J,\"O\")";
    sheet.getRange(r, 1).setValue("🎯 Entretiens obtenus");
    sheet.getRange(r, 2).setFormula(entA);
    sheet.getRange(r, 3).setFormula(entB);
    sheet.getRange(r, 4).setFormula("=IF(B" + r + ">C" + r + ",\"CV A ✅\",IF(C" + r + ">B" + r + ",\"CV B ✅\",\"Égalité\"))");
    r++;

    // Taux entretien / réponse
    var ent_row = r - 1; var rep_row = r - 3;
    sheet.getRange(r, 1).setValue("📊 Taux entretien / réponse");
    sheet.getRange(r, 2).setFormula("=IFERROR(TEXT(B" + ent_row + "/MAX(1,B" + rep_row + "),\"0%\"),\"0%\")");
    sheet.getRange(r, 3).setFormula("=IFERROR(TEXT(C" + ent_row + "/MAX(1,C" + rep_row + "),\"0%\"),\"0%\")");
    sheet.getRange(r, 4).setFormula("=IF(B" + r + ">C" + r + ",\"CV A ✅\",IF(C" + r + ">B" + r + ",\"CV B ✅\",\"Égalité\"))");

    // Bordures
    sheet.getRange(startRow, 1, r - startRow + 1, 4)
      .setBorder(true,true,true,true,true,true,"#dadce0",SpreadsheetApp.BorderStyle.SOLID);
  }

  // ---- Blocs par langue ----
  _blocLangue(4,  "🇫🇷", "FR", "FR");
  _blocLangue(13, "🇬🇧", "EN", "EN");
  _blocLangue(22, "🇪🇸", "ES", "ES");

  // ---- Largeurs colonnes ----
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 110);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 20);
  sheet.setColumnWidth(6, 160);
  sheet.setColumnWidth(7, 200);
}