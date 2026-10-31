const GEMINI_API_KEY = "CLE_RETIREE_VOIR_SCRIPT_PROPERTIES"; 

const VALID_STATUSES = [
  "À faire", "Pas commencé", "Stand-by", "Refus", 
  "Entretien 2", "Entretien 1", "Réponse reçue", 
  "Envoyé", "En cours", "Terminé"
];

const VALID_POSTES = [
  "CRM Manager",
  "Growth Manager",
  "Responsable CRM",
  "Responsable Acquisition",
  "Growth marketer",
  "candidature spontanée",
  "Inconnu",
  "Responsable marketing",
  "Head of growth",
  "Lead generation manager"
];

function automateJobToSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Candidatures"); 
  
  if (!sheet) {
    Logger.log("❌ Erreur : Onglet 'Candidatures' introuvable");
    return;
  }
  
  const label = GmailApp.getUserLabelByName("Job-2025");
  let labelProcessed = GmailApp.getUserLabelByName("Job-2025-Traite");
  if (!labelProcessed) labelProcessed = GmailApp.createLabel("Job-2025-Traite");

  if (!label) {
    Logger.log("❌ Erreur : Libellé 'Job-2025' introuvable.");
    return;
  }

  // Traitement par lot stable de 25 mails
  const threads = label.getThreads(0, 25); 
  if (threads.length === 0) {
    Logger.log("✅ Aucun nouveau mail à traiter.");
    return;
  }
  
  Logger.log("⚡ Traitement sécurisé de " + threads.length + " mails...");

  const aValues = sheet.getRange("A:A").getValues();
  let lastDataRow = 1;
  for (let i = aValues.length - 1; i >= 0; i--) {
    if (aValues[i][0] && String(aValues[i][0]).trim() !== "") {
      lastDataRow = i + 1;
      break;
    }
  }
  
  let nextEmptyRow = lastDataRow + 1;
  let existingCompanies = [];
  if (lastDataRow > 1) {
    existingCompanies = sheet.getRange(2, 1, lastDataRow - 1, 1).getValues().flat().map(c => String(c).toLowerCase().trim());
  }

  let threadsToRelabel = [];

  threads.forEach((thread) => {
    try {
      const msg = thread.getMessages()[thread.getMessageCount() - 1]; 
      const sujet = msg.getSubject();
      const dateMessage = msg.getDate();
      
      let corps = msg.getPlainBody();
      corps = corps ? corps.substring(0, 1500) : "";
      
      let techEmail = msg.getReplyTo() || msg.getFrom() || "";
      const emailMatch = techEmail.match(/<([^>]+)>/);
      let cleanEmail = emailMatch ? emailMatch[1] : techEmail;
      cleanEmail = cleanEmail.trim();

      // Appel avec tentative de relance automatique en cas de 503
      const info = callGeminiWithAutoRetry(corps, sujet, cleanEmail);
      
      if (info && info.entreprise && info.entreprise !== "Inconnu") {
        let entrepriseClean = info.entreprise.trim();
        const entrepriseLower = entrepriseClean.toLowerCase();
        
        let finalContact = info.contactEmail && String(info.contactEmail).includes("@") ? String(info.contactEmail) : cleanEmail;
        if (!finalContact.includes("@")) finalContact = "Équipe RH";

        const companyIndex = existingCompanies.indexOf(entrepriseLower);
        
        if (companyIndex !== -1) {
          const rowToUpdate = companyIndex + 2; 
          sheet.getRange(rowToUpdate, 6).setValue(info.statut || "Envoyé"); 
          sheet.getRange(rowToUpdate, 7).setValue(dateMessage);
          setSmartContact(sheet, rowToUpdate, 9, finalContact);
          
          const currentPoste = String(sheet.getRange(rowToUpdate, 2).getValue()).trim();
          if (!VALID_POSTES.includes(currentPoste)) {
            sheet.getRange(rowToUpdate, 2).setValue(info.poste || "Inconnu");
          }
          Logger.log("🔄 MAJ : " + entrepriseClean);
        } else {
          sheet.getRange(nextEmptyRow, 1, 1, 9).setValues([[
            entrepriseClean, 
            info.poste || "Inconnu", 
            info.plateforme || "Direct", 
            info.secteur || "Non spécifié",         
            "Réponse à offre", 
            info.statut || "Envoyé", 
            dateMessage, 
            info.lien || "", 
            "" 
          ]]);
          setSmartContact(sheet, nextEmptyRow, 9, finalContact);
          existingCompanies.push(entrepriseLower);
          nextEmptyRow++; 
          Logger.log("🆕 Ajouté : " + entrepriseClean);
        }

        threadsToRelabel.push(thread);
      } else {
        Logger.log("⚠️ Mail non traitable pour l'instant : " + sujet);
      }

      // Pause de sécurité pour ne pas saturer l'API
      Utilities.sleep(1200); 

    } catch (e) {
      Logger.log("❌ Erreur sur un mail : " + e.message);
    }
  });

  if (threadsToRelabel.length > 0) {
    labelProcessed.addToThreads(threadsToRelabel);
    label.removeFromThreads(threadsToRelabel);
    Logger.log("✅ " + threadsToRelabel.length + " mails traités et archivés.");
  }

  if (nextEmptyRow > 2) {
    const numRowsToSort = nextEmptyRow - 2; 
    sheet.getRange(2, 1, numRowsToSort, sheet.getLastColumn()).sort({column: 7, ascending: false});
    Logger.log("✅ Tableau trié.");
  }
}

function setSmartContact(sheet, row, col, contactValue) {
  const cell = sheet.getRange(row, col);
  if (contactValue && String(contactValue).includes("@") && String(contactValue).length > 3) {
    const richValue = SpreadsheetApp.newRichTextValue()
      .setText(contactValue)
      .setLinkUrl("mailto:" + contactValue)
      .build();
    cell.setRichTextValue(richValue);
  } else {
    cell.setValue(contactValue);
  }
}

// 🟢 MODULE DE PROTECTION CONTRE L'ERREUR 503
function callGeminiWithAutoRetry(text, subject, senderEmail) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = callGeminiForCRM(text, subject, senderEmail);
    if (result && result !== "RETRY") {
      return result;
    }
    if (attempt < maxRetries) {
      Logger.log(`⏳ Serveur Google occupé (503). Nouvelle tentative (${attempt}/${maxRetries}) dans 2s...`);
      Utilities.sleep(2000 * attempt);
    }
  }
  return null;
}

function callGeminiForCRM(text, subject, senderEmail) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY;
  const statusListString = JSON.stringify(VALID_STATUSES);
  const postesListString = JSON.stringify(VALID_POSTES);

  const prompt = `Analyse ce mail de recrutement.
Sujet: "${subject}"
Expéditeur: "${senderEmail}"
Corps: "${text}"

RÈGLES :
1. Entreprise = celle ciblée par la candidature (jamais LinkedIn, Indeed, Welcome to the Jungle).
2. Poste = choisis l'élément le plus proche parmi : ${postesListString} (sinon "Inconnu").
3. Statut = choisis parmi : ${statusListString} (si confirmation LinkedIn -> "Envoyé").

Format JSON attendu :
{"entreprise": "...", "poste": "...", "plateforme": "...", "secteur": "...", "lien": "...", "statut": "...", "contactEmail": "..."}`;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1
        }
      }),
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    
    // Si Google renvoie une 503 ou 429, on déclenche le retry automatique
    if (code === 503 || code === 429) {
      return "RETRY";
    }
    
    if (code !== 200) {
      Logger.log("🔴 Erreur API Code " + code);
      return null;
    }
    
    const resObj = JSON.parse(response.getContentText());
    if (!resObj.candidates || resObj.candidates.length === 0) return null;

    return JSON.parse(resObj.candidates[0].content.parts[0].text);
  } catch (e) { 
    return null; 
  }
}