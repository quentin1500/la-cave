// ============================================================
// La Cave — Google Apps Script
// Déployer comme Web App (voir docs/guides/setup-apps-script.md)
// ============================================================

var SHEET_NAME = 'Bouteilles';

var HEADERS = [
  'id', 'type', 'producteur', 'cuvee', 'millesime', 'appellation',
  'region', 'pays', 'cepages', 'volume', 'degre_alcool', 'code_barres',
  'photo_url', 'rang', 'colonne', 'quantite', 'date_achat', 'prix_achat',
  'valeur_estimee', 'notes_personnelles', 'date_creation', 'date_modification'
];

// ── Handlers HTTP ─────────────────────────────────────────────────────────────

function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) ? e.parameter.action : 'getAll';

    if (action === 'getAll') {
      return buildResponse_(getAllBottles_());
    }

    return buildResponse_({ error: 'Action non reconnue : ' + action }, 400);

  } catch (err) {
    Logger.log('Erreur doGet : ' + err.message);
    return buildResponse_({ error: 'Erreur serveur : ' + err.message }, 500);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // Validation de la clé API
    if (!validateApiKey_(body.apiKey)) {
      return buildResponse_({ error: 'Non autorisé — clé API invalide' }, 401);
    }

    var action = body.action;

    if (action === 'add') {
      if (!body.data) return buildResponse_({ error: 'Champ data manquant' }, 400);
      return buildResponse_(addBottle_(body.data));
    }

    if (action === 'update') {
      if (!body.id) return buildResponse_({ error: 'Champ id manquant' }, 400);
      if (!body.data) return buildResponse_({ error: 'Champ data manquant' }, 400);
      return buildResponse_(updateBottle_(body.id, body.data));
    }

    if (action === 'delete') {
      if (!body.id) return buildResponse_({ error: 'Champ id manquant' }, 400);
      return buildResponse_(deleteBottle_(body.id));
    }

    return buildResponse_({ error: 'Action non reconnue : ' + action }, 400);

  } catch (err) {
    Logger.log('Erreur doPost : ' + err.message);
    return buildResponse_({ error: 'Erreur serveur : ' + err.message }, 500);
  }
}

// ── Opérations CRUD ───────────────────────────────────────────────────────────

function getAllBottles_() {
  var sheet = getSheet_();
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  var headers = data[0];
  var bottles = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Ignorer les lignes vides
    if (!row[0]) continue;

    var bottle = {};
    for (var j = 0; j < headers.length; j++) {
      bottle[headers[j]] = row[j] !== undefined ? row[j] : '';
    }
    bottles.push(bottle);
  }

  return bottles;
}

function addBottle_(data) {
  var sheet = getSheet_();
  var now = new Date().toISOString();

  data.date_creation = now;
  data.date_modification = now;

  // Générer un id si absent
  if (!data.id) {
    data.id = Utilities.getUuid();
  }

  var row = HEADERS.map(function(header) {
    return data[header] !== undefined ? data[header] : '';
  });

  sheet.appendRow(row);
  return { success: true, id: data.id };
}

function updateBottle_(id, data) {
  var sheet = getSheet_();
  var sheetData = sheet.getDataRange().getValues();
  var headers = sheetData[0];
  var idIndex = headers.indexOf('id');

  if (idIndex === -1) throw new Error('Colonne id introuvable');

  for (var i = 1; i < sheetData.length; i++) {
    if (String(sheetData[i][idIndex]) === String(id)) {
      data.date_modification = new Date().toISOString();
      // Conserver l'id et la date_creation d'origine
      data.id = id;
      data.date_creation = sheetData[i][headers.indexOf('date_creation')] || new Date().toISOString();

      var updatedRow = HEADERS.map(function(header) {
        return data[header] !== undefined ? data[header] : sheetData[i][headers.indexOf(header)];
      });

      sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      return { success: true, id: id };
    }
  }

  return { error: 'Bouteille introuvable : ' + id };
}

function deleteBottle_(id) {
  var sheet = getSheet_();
  var sheetData = sheet.getDataRange().getValues();
  var headers = sheetData[0];
  var idIndex = headers.indexOf('id');

  if (idIndex === -1) throw new Error('Colonne id introuvable');

  for (var i = 1; i < sheetData.length; i++) {
    if (String(sheetData[i][idIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true, id: id };
    }
  }

  return { error: 'Bouteille introuvable : ' + id };
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    // Créer la feuille avec les en-têtes si elle n'existe pas
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    // Style en-têtes
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#722F37')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
  }

  return sheet;
}

function validateApiKey_(key) {
  if (!key) return false;
  // Le client envoie le hash SHA-256 du mot de passe admin.
  // Apps Script compare ce hash à celui stocké dans les Script Properties.
  var storedHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
  if (!storedHash) {
    Logger.log('⚠️  ADMIN_PASSWORD_HASH non configuré dans les Script Properties');
    return false;
  }
  return key === storedHash;
}

function buildResponse_(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Fonction d'initialisation (à exécuter une fois) ───────────────────────────

/**
 * Exécuter cette fonction une fois depuis l'éditeur Apps Script
 * pour configurer le hash du mot de passe admin.
 *
 * 1. Générer le hash SHA-256 de votre mot de passe admin via tools/generate-hash.html
 * 2. Remplacer 'VOTRE_HASH_ICI' par la valeur obtenue (64 caractères hexadécimaux)
 * 3. Exécuter cette fonction depuis l'éditeur Apps Script
 */
function setAdminPasswordHash() {
  var hash = 'VOTRE_HASH_ICI'; // ← remplacer par votre hash SHA-256 (64 caractères hex)
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', hash);
  Logger.log('Hash admin configuré : ' + hash);
}
