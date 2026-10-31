// ============================================================
// SCRIPT V3 — Restauration Dashboards Candidatures Marie
// Calcul 100% JavaScript, zéro formule dans les cellules
// V3 : ajout des graphiques (depuis le début + 14 derniers jours)
//
// MODE D'EMPLOI :
// 1. Extensions → Apps Script → REMPLACER tout le contenu par ce fichier
// 2. Exécuter "installerEtRafraichir" (une seule fois)
//    → crée/corrige les dashboards, les graphiques ET installe un trigger auto
// 3. Ensuite "rafraichirDashboards" pour forcer une mise à jour
// ============================================================

// ======================================================
// POINT D'ENTRÉE PRINCIPAL
// ======================================================
function installerEtRafraichir() {
  rafraichirDashboards();

  var triggers = ScriptApp.getProjectTriggers();
  var deja = triggers.some(function(t) { return t.getHandlerFunction() === "rafraichirDashboards"; });
  if (!deja) {
    ScriptApp.newTrigger("rafraichirDashboards")
      .timeBased().everyHours(1).create();
  }

  SpreadsheetApp.getUi().alert(
    "✅ Dashboards + graphiques restaurés !\n\n" +
    "• 📊 Dashboard → stats globales + graphiques candidatures/jour\n" +
    "• 📊 Dashboard AB Test → comparatif CV A vs B\n\n" +
    "Mise à jour automatique toutes les heures."
  );
}

function rafraichirDashboards() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candidaturesSheet = ss.getSheetByName("Candidatures");
  var abTestSheet       = ss.getSheetByName("AB Test");

  if (!candidaturesSheet) { Logger.log("Onglet 'Candidatures' introuvable"); return; }
  if (!abTestSheet)       { Logger.log("Onglet 'AB Test' introuvable"); return; }

  _construireOuViderDashboardPrincipal(ss);
  _majDashboardPrincipal(ss, candidaturesSheet);
  _ajouterGraphiquesDashboard(ss, candidaturesSheet);

  _construireOuViderDashboardABTest(ss);
  _majDashboardABTest(ss, abTestSheet);

  SpreadsheetApp.flush();
}


// ======================================================
// DASHBOARD PRINCIPAL — construction de la structure
// ======================================================
function _construireOuViderDashboardPrincipal(ss) {
  var sheet = ss.getSheetByName("📊 Dashboard");
  if (!sheet) sheet = ss.getSheetByName("Dashboard");
  if (!sheet) {
    sheet = ss.insertSheet("📊 Dashboard", 1);
  } else {
    sheet.clear();
    // Supprimer les graphiques existants
    var charts = sheet.getCharts();
    charts.forEach(function(c) { sheet.removeChart(c); });
  }
  sheet.setName("📊 Dashboard");

  var BLEU   = "#1a73e8";
  var BLEU_C = "#e8f0fe";
  var VERT_C = "#e6f4ea";
  var ORA_C  = "#fff3e0";
  var ROUGE_C= "#fce8e6";
  var GRIS   = "#f8f9fa";

  // ---- LIGNE 1 : Titre ----
  sheet.getRange("A1:G1").merge()
    .setValue("📊 Dashboard Candidatures")
    .setBackground(BLEU).setFontColor("#ffffff")
    .setFontSize(16).setFontWeight("bold").setHorizontalAlignment("center");

  // ---- LIGNE 2 : Date mise à jour ----
  sheet.getRange("A2:G2").merge()
    .setBackground(BLEU_C).setFontSize(10)
    .setHorizontalAlignment("center").setFontStyle("italic");

  // ---- LIGNE 4-5 : KPIs ----
  sheet.getRange("A4:B4").merge().setValue("📤 Total envois")
    .setBackground(BLEU_C).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("C4:D4").merge().setValue("🎯 Entretiens")
    .setBackground(VERT_C).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("E4:F4").merge().setValue("📬 Taux de réponse")
    .setBackground(ORA_C).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("G4").setValue("❌ Refus")
    .setBackground(ROUGE_C).setFontWeight("bold").setHorizontalAlignment("center");

  sheet.getRange("A5:B5").merge()
    .setBackground(BLEU_C).setFontSize(22).setFontWeight("bold")
    .setHorizontalAlignment("center").setFontColor(BLEU);
  sheet.getRange("C5:D5").merge()
    .setBackground(VERT_C).setFontSize(22).setFontWeight("bold")
    .setHorizontalAlignment("center").setFontColor("#34a853");
  sheet.getRange("E5:F5").merge()
    .setBackground(ORA_C).setFontSize(22).setFontWeight("bold")
    .setHorizontalAlignment("center").setFontColor("#ff6d00");
  sheet.getRange("G5")
    .setBackground(ROUGE_C).setFontSize(22).setFontWeight("bold")
    .setHorizontalAlignment("center").setFontColor("#c5221f");

  // ---- LIGNE 7-15 : Tableaux statuts / plateformes ----
  sheet.getRange("A7:C7").merge().setValue("📋 Répartition par statut")
    .setBackground(BLEU).setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange("E7:G7").merge().setValue("🌐 Répartition par plateforme")
    .setBackground(BLEU).setFontColor("#ffffff").setFontWeight("bold");

  sheet.getRange("A8").setValue("Statut").setFontWeight("bold").setBackground(GRIS);
  sheet.getRange("B8").setValue("Nb").setFontWeight("bold").setBackground(GRIS);
  sheet.getRange("C8").setValue("%").setFontWeight("bold").setBackground(GRIS);
  sheet.getRange("E8").setValue("Plateforme").setFontWeight("bold").setBackground(GRIS);
  sheet.getRange("F8").setValue("Nb").setFontWeight("bold").setBackground(GRIS);
  sheet.getRange("G8").setValue("%").setFontWeight("bold").setBackground(GRIS);

  var statuts = ["Envoyé","En cours","Réponse reçue","Entretien 1","Refus","Terminé"];
  for (var s = 0; s < statuts.length; s++) {
    sheet.getRange(9 + s, 1).setValue(statuts[s]);
  }
  sheet.getRange(15, 1).setValue("TOTAL").setFontWeight("bold");

  var plat = ["LinkedIn","Indeed","Welcome to the Jungle","Site carrière","Cadremploi","HelloWork","Autres"];
  for (var p = 0; p < plat.length; p++) {
    sheet.getRange(9 + p, 5).setValue(plat[p]);
  }

  sheet.getRange("A8:C15").setBorder(true,true,true,true,true,true,"#dadce0",SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange("E8:G15").setBorder(true,true,true,true,true,true,"#dadce0",SpreadsheetApp.BorderStyle.SOLID);

  // ---- LIGNE 17-18 : Ce mois ----
  sheet.getRange("A17:F17").merge().setValue("🕐 Candidatures ce mois-ci")
    .setBackground(BLEU).setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange("A18").setValue("Ce mois").setFontWeight("bold").setBackground(GRIS);
  sheet.getRange("B18").setFontSize(14).setFontWeight("bold");

  // ---- LIGNE 20-21 : J vs J-1 ----
  sheet.getRange("A20:G20").merge().setValue("📅 Aujourd'hui vs Hier (J vs J-1)")
    .setBackground(BLEU).setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange("A21").setValue("Aujourd'hui (J)").setFontWeight("bold").setBackground(GRIS);
  sheet.getRange("B21").setFontSize(14).setFontWeight("bold").setFontColor(BLEU);
  sheet.getRange("C21").setValue("Hier (J-1)").setFontWeight("bold").setBackground(GRIS);
  sheet.getRange("D21").setFontSize(14).setFontWeight("bold").setFontColor("#666666");
  sheet.getRange("E21").setValue("Évolution").setFontWeight("bold").setBackground(GRIS);
  sheet.getRange("F21").setFontSize(14).setFontWeight("bold");

  sheet.getRange("A21:F21").setBorder(true,true,true,true,true,true,"#dadce0",SpreadsheetApp.BorderStyle.SOLID);

  // ---- LIGNE 23-24 : Titres graphiques ----
  sheet.getRange("A23:G23").merge().setValue("📈 Candidatures par jour — Depuis le début")
    .setBackground(BLEU).setFontColor("#ffffff").setFontWeight("bold");
  // Graphique 1 : lignes 24 à 43 (réservées)

  sheet.getRange("A44:G44").merge().setValue("📈 Candidatures par jour — 14 derniers jours")
    .setBackground(BLEU).setFontColor("#ffffff").setFontWeight("bold");
  // Graphique 2 : lignes 45 à 64 (réservées)

  // Largeurs colonnes
  sheet.setColumnWidth(1, 170); sheet.setColumnWidth(2, 80); sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 180); sheet.setColumnWidth(6, 80); sheet.setColumnWidth(7, 70);
  sheet.setRowHeight(5, 55);
}


// ======================================================
// DASHBOARD PRINCIPAL — injection des données
// ======================================================
function _majDashboardPrincipal(ss, candidaturesSheet) {
  var sheet = ss.getSheetByName("📊 Dashboard");
  if (!sheet) return;

  var data = candidaturesSheet.getDataRange().getValues();
  var statutsMap = {}, plateformesMap = {};
  var total = 0, cesMois = 0;
  var now = new Date();
  var moisNow = now.getMonth(), anneeNow = now.getFullYear();
  var todayStr = _dateStr(now);
  var hier = new Date(now); hier.setDate(hier.getDate() - 1);
  var hierStr = _dateStr(hier);
  var countAujourd = 0, countHier = 0;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] || row[0] === "") continue;
    total++;

    var statut = String(row[5] || "Inconnu").trim();
    statutsMap[statut] = (statutsMap[statut] || 0) + 1;

    var platf = String(row[2] || "Autre").trim();
    plateformesMap[platf] = (plateformesMap[platf] || 0) + 1;

    var d = row[6];
    if (d instanceof Date) {
      if (d.getMonth() === moisNow && d.getFullYear() === anneeNow) cesMois++;
      var dStr = _dateStr(d);
      if (dStr === todayStr) countAujourd++;
      if (dStr === hierStr) countHier++;
    }
  }

  // KPIs
  var entretiens = 0;
  for (var k in statutsMap) {
    if (k.indexOf("Entretien") !== -1) entretiens += statutsMap[k];
  }
  var reponses = (statutsMap["Réponse reçue"] || 0) + entretiens
               + (statutsMap["Refus"] || 0) + (statutsMap["Terminé"] || 0);
  var tauxRep  = total > 0 ? Math.round(reponses / total * 100) + "%" : "0%";
  var refus    = statutsMap["Refus"] || 0;

  // Écriture KPIs
  sheet.getRange("A5:B5").setValue(total);
  sheet.getRange("C5:D5").setValue(entretiens);
  sheet.getRange("E5:F5").setValue(tauxRep);
  sheet.getRange("G5").setValue(refus);
  sheet.getRange("A2:G2").setValue(
    "Mise à jour : " + Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "dd/MM/yyyy HH:mm")
  );
  sheet.getRange("B18").setValue(cesMois);

  // J vs J-1
  var evolution = countAujourd - countHier;
  var evoStr = (evolution > 0 ? "▲ +" : (evolution < 0 ? "▼ " : "= ")) + evolution;
  sheet.getRange("B21").setValue(countAujourd);
  sheet.getRange("D21").setValue(countHier);
  sheet.getRange("F21").setValue(evoStr)
    .setFontColor(evolution > 0 ? "#34a853" : (evolution < 0 ? "#c5221f" : "#666666"));

  // Statuts
  var statutsList = ["Envoyé","En cours","Réponse reçue","Entretien 1","Refus","Terminé"];
  var totalSt = 0;
  for (var s = 0; s < statutsList.length; s++) {
    var nb = statutsMap[statutsList[s]] || 0;
    totalSt += nb;
    var pct = total > 0 ? Math.round(nb / total * 100) + "%" : "0%";
    sheet.getRange(9 + s, 2).setValue(nb);
    sheet.getRange(9 + s, 3).setValue(pct);
  }
  sheet.getRange(15, 2).setValue(totalSt).setFontWeight("bold");
  sheet.getRange(15, 3).setValue(total > 0 ? "100%" : "0%").setFontWeight("bold");

  // Plateformes
  var platList = ["LinkedIn","Indeed","Welcome to the Jungle","Site carrière","Cadremploi","HelloWork","Autres"];
  var totalPlat = 0;
  for (var p = 0; p < platList.length; p++) totalPlat += (plateformesMap[platList[p]] || 0);
  for (var p2 = 0; p2 < platList.length; p2++) {
    var nbP = plateformesMap[platList[p2]] || 0;
    var pctP = totalPlat > 0 ? Math.round(nbP / totalPlat * 100) + "%" : "0%";
    sheet.getRange(9 + p2, 6).setValue(nbP);
    sheet.getRange(9 + p2, 7).setValue(pctP);
  }
}

// Helper : date → "YYYY-MM-DD" pour comparaison
function _dateStr(d) {
  return d.getFullYear() + "-" +
         String(d.getMonth() + 1).padStart(2, "0") + "-" +
         String(d.getDate()).padStart(2, "0");
}


// ======================================================
// GRAPHIQUES — création des deux graphiques
// ======================================================
function _ajouterGraphiquesDashboard(ss, candidaturesSheet) {
  var sheet = ss.getSheetByName("📊 Dashboard");
  if (!sheet) return;

  var data = candidaturesSheet.getDataRange().getValues();
  var now = new Date();

  // --- Agrégation : candidatures par jour (toutes) ---
  var dayMapAll = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] || row[0] === "") continue;
    var d = row[6];
    if (!(d instanceof Date)) continue;
    var key = _dateStr(d);
    dayMapAll[key] = (dayMapAll[key] || 0) + 1;
  }

  // Trier les dates
  var allDates = Object.keys(dayMapAll).sort();

  // --- Données graphique 1 : depuis le début ---
  // On écrit dans les colonnes I (date) et J (count) à partir de la ligne 1
  // Zone réservée : I1:J500 (zone masquée)
  var g1Data = [["Date", "Candidatures"]];
  for (var di = 0; di < allDates.length; di++) {
    g1Data.push([allDates[di], dayMapAll[allDates[di]]]);
  }

  var g1StartRow = 1;
  var g1Range = sheet.getRange(g1StartRow, 9, g1Data.length, 2); // colonnes I et J
  g1Range.setValues(g1Data);

  // --- Données graphique 2 : 14 derniers jours ---
  var g2Data = [["Date", "Candidatures"]];
  var cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 13); // 14 jours incluant aujourd'hui
  var cutoffStr = _dateStr(cutoff);

  for (var di2 = 0; di2 < allDates.length; di2++) {
    if (allDates[di2] >= cutoffStr) {
      g2Data.push([allDates[di2], dayMapAll[allDates[di2]]]);
    }
  }
  // S'assurer qu'on a les 14 jours même si certains = 0
  for (var dd = 0; dd < 14; dd++) {
    var dayD = new Date(cutoff);
    dayD.setDate(dayD.getDate() + dd);
    var dayStr = _dateStr(dayD);
    if (!dayMapAll[dayStr]) {
      g2Data.push([dayStr, 0]);
    }
  }
  // Re-trier g2Data (sans l'entête)
  var g2Header = g2Data[0];
  var g2Rows = g2Data.slice(1).sort(function(a,b){ return a[0] < b[0] ? -1 : 1; });
  g2Data = [g2Header].concat(g2Rows);

  var g2StartRow = 502; // zone séparée pour éviter collision
  var g2Range = sheet.getRange(g2StartRow, 9, g2Data.length, 2);
  g2Range.setValues(g2Data);

  // Masquer les colonnes I et J (données brutes des graphiques)
  sheet.hideColumns(9, 2);

  // --- Supprimer les anciens graphiques s'il y en a ---
  var existingCharts = sheet.getCharts();
  existingCharts.forEach(function(c) { sheet.removeChart(c); });

  // --- Créer Graphique 1 : depuis le début ---
  // Utilisation de asColumnChart() pour accéder aux méthodes natives typées
  var chart1DataRange = sheet.getRange(g1StartRow, 9, g1Data.length, 2);
  var chart1 = sheet.newChart()
    .asColumnChart()
    .addRange(chart1DataRange)
    .setTitle("Candidatures par jour — Depuis le debut")
    .setXAxisTitle("Date")
    .setYAxisTitle("Nb candidatures")
    .setColors(["#1a73e8"])
    .setLegendPosition(Charts.Position.NONE)
    .setPosition(24, 1, 0, 0)
    .build();
  sheet.insertChart(chart1);

  // --- Créer Graphique 2 : 14 derniers jours ---
  var chart2DataRange = sheet.getRange(g2StartRow, 9, g2Data.length, 2);
  var chart2 = sheet.newChart()
    .asColumnChart()
    .addRange(chart2DataRange)
    .setTitle("Candidatures par jour — 14 derniers jours")
    .setXAxisTitle("Date")
    .setYAxisTitle("Nb candidatures")
    .setColors(["#34a853"])
    .setLegendPosition(Charts.Position.NONE)
    .setPosition(45, 1, 0, 0)
    .build();
  sheet.insertChart(chart2);
}


// ======================================================
// DASHBOARD AB TEST — construction de la structure
// ======================================================
function _construireOuViderDashboardABTest(ss) {
  var sheet = ss.getSheetByName("📊 Dashboard AB Test");
  if (!sheet) sheet = ss.getSheetByName("Dashboard AB Test");
  if (!sheet) sheet = ss.getSheetByName("Dashboard");

  if (!sheet) {
    sheet = ss.insertSheet("📊 Dashboard AB Test");
  } else {
    sheet.clear();
    sheet.setName("📊 Dashboard AB Test");
  }

  var VIOLET   = "#6200ea";
  var VIOLET_C = "#ede7f6";
  var GRIS     = "#f8f9fa";

  sheet.getRange("A1:G1").merge()
    .setValue("🧪 Dashboard A/B Test CV — Résultats")
    .setBackground(VIOLET).setFontColor("#ffffff")
    .setFontSize(15).setFontWeight("bold").setHorizontalAlignment("center");

  sheet.getRange("A2:D2").merge()
    .setBackground(VIOLET_C).setFontSize(10)
    .setHorizontalAlignment("center").setFontStyle("italic");

  sheet.getRange("F4").setValue("Légende").setFontWeight("bold").setBackground(GRIS);
  var legende = [
    ["🇫🇷 FR — CV A", "1 page compact, FR (09/2026)"],
    ["🇫🇷 FR — CV B", "2 pages aéré, FR (08/2026)"],
    ["🇬🇧 EN — CV A", "1 page compact, EN (09/2026)"],
    ["🇬🇧 EN — CV B", "2 pages aéré, EN (09/2026)"],
    ["🇪🇸 ES — CV A", "1 page compact, ES (09/2026)"],
    ["🇪🇸 ES — CV B", "2 pages aéré, ES (09/2026)"]
  ];
  sheet.getRange(5, 6, legende.length, 2).setValues(legende);
  sheet.getRange(5, 6, legende.length, 2)
    .setBorder(true,true,true,true,true,true,"#dadce0",SpreadsheetApp.BorderStyle.SOLID);

  var configs = [
    { row: 4,  emoji: "🇫🇷", langue: "FR" },
    { row: 13, emoji: "🇬🇧", langue: "EN" },
    { row: 22, emoji: "🇪🇸", langue: "ES" }
  ];
  var metriques = ["📤 Envois","💬 Réponses perso","📈 Taux de réponse","🎯 Entretiens obtenus","📊 Taux entretien / réponse"];

  configs.forEach(function(c) {
    sheet.getRange(c.row, 1, 1, 4).merge()
      .setValue(c.emoji + " CV " + c.langue + " — CV A (1 page) vs CV B (2 pages)")
      .setBackground(VIOLET).setFontColor("#ffffff").setFontWeight("bold");
    sheet.getRange(c.row + 1, 1, 1, 4)
      .setValues([["Métrique", "CV A – 1 page", "CV B – 2 pages", "Avantage"]])
      .setFontWeight("bold").setBackground(GRIS);
    for (var m = 0; m < metriques.length; m++) {
      sheet.getRange(c.row + 2 + m, 1).setValue(metriques[m]);
    }
    sheet.getRange(c.row, 1, metriques.length + 2, 4)
      .setBorder(true,true,true,true,true,true,"#dadce0",SpreadsheetApp.BorderStyle.SOLID);
  });

  sheet.setColumnWidth(1, 210); sheet.setColumnWidth(2, 115);
  sheet.setColumnWidth(3, 115); sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 20);
  sheet.setColumnWidth(6, 165); sheet.setColumnWidth(7, 210);
}


// ======================================================
// DASHBOARD AB TEST — injection des données
// ======================================================
function _majDashboardABTest(ss, abTestSheet) {
  var sheet = ss.getSheetByName("📊 Dashboard AB Test");
  if (!sheet) return;

  var data = abTestSheet.getDataRange().getValues();
  var stats = {
    FR: { A: {e:0,r:0,i:0}, B: {e:0,r:0,i:0} },
    EN: { A: {e:0,r:0,i:0}, B: {e:0,r:0,i:0} },
    ES: { A: {e:0,r:0,i:0}, B: {e:0,r:0,i:0} }
  };

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] || row[0] === "") continue;
    var lng = String(row[5]).trim().toUpperCase();
    var ver = String(row[6]).trim().toUpperCase();
    if (!stats[lng] || !stats[lng][ver]) continue;
    stats[lng][ver].e++;
    if (String(row[8]).trim().toUpperCase() === "O") stats[lng][ver].r++;
    if (String(row[9]).trim().toUpperCase() === "O") stats[lng][ver].i++;
  }

  var blocDataRow = { FR: 6, EN: 15, ES: 24 };

  function avantage(vA, vB) {
    return vA > vB ? "CV A ✅" : vB > vA ? "CV B ✅" : "Égalité";
  }
  function pct(num, den) {
    return den > 0 ? Math.round(num / den * 100) + "%" : "0%";
  }

  ["FR","EN","ES"].forEach(function(lng) {
    var bRow = blocDataRow[lng];
    var sA = stats[lng]["A"], sB = stats[lng]["B"];

    sheet.getRange(bRow,   2).setValue(sA.e);
    sheet.getRange(bRow,   3).setValue(sB.e);
    sheet.getRange(bRow,   4).setValue(avantage(sA.e, sB.e));

    sheet.getRange(bRow+1, 2).setValue(sA.r);
    sheet.getRange(bRow+1, 3).setValue(sB.r);
    sheet.getRange(bRow+1, 4).setValue(avantage(sA.r, sB.r));

    var txRA = pct(sA.r, sA.e), txRB = pct(sB.r, sB.e);
    sheet.getRange(bRow+2, 2).setValue(txRA);
    sheet.getRange(bRow+2, 3).setValue(txRB);
    var txRnum = sA.e > 0 ? sA.r/sA.e : 0, txRden = sB.e > 0 ? sB.r/sB.e : 0;
    sheet.getRange(bRow+2, 4).setValue(avantage(txRnum, txRden));

    sheet.getRange(bRow+3, 2).setValue(sA.i);
    sheet.getRange(bRow+3, 3).setValue(sB.i);
    sheet.getRange(bRow+3, 4).setValue(avantage(sA.i, sB.i));

    var txEA = pct(sA.i, sA.r), txEB = pct(sB.i, sB.r);
    sheet.getRange(bRow+4, 2).setValue(txEA);
    sheet.getRange(bRow+4, 3).setValue(txEB);
    var txEnum = sA.r > 0 ? sA.i/sA.r : 0, txEdep = sB.r > 0 ? sB.i/sB.r : 0;
    sheet.getRange(bRow+4, 4).setValue(avantage(txEnum, txEdep));
  });

  var now = new Date();
  sheet.getRange("A2:D2").setValue(
    "Mise à jour : " + Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "dd/MM/yyyy HH:mm")
  );
}