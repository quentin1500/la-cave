// ============================================================
// La Cave — Google Apps Script
// Déployer comme Web App (voir docs/guides/setup-apps-script.md)
// ============================================================

var SHEET_NAME = 'Bouteilles';
var LOCALISATIONS_SHEET_NAME = 'Localisations';
var LAYOUTS_SHEET_NAME = 'Layouts';

var HEADERS = [
  'id', 'type', 'producteur', 'cuvee', 'millesime', 'appellation',
  'region', 'pays', 'cepages', 'volume', 'degre_alcool', 'code_barres',
  'photo_url', 'rang', 'colonne', 'localisation', 'slot_id',
  'date_achat', 'prix_achat', 'valeur_estimee', 'notes_personnelles',
  'date_creation', 'date_modification',
  // Archivage
  'archived', 'archived_at', 'archive_comment'
];

var LOCALISATIONS_HEADERS = [
  'id', 'nom', 'description', 'date_creation', 'date_modification'
];

// ── Handlers HTTP ─────────────────────────────────────────────────────────────

function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) ? e.parameter.action : 'getAll';

    if (action === 'getAll') {
      return buildResponse_(getAllBottles_());
    }

    if (action === 'getLocalisations') {
      return buildResponse_(getLocalisations_());
    }

    if (action === 'getLayout') {
      var localisationId = (e.parameter && e.parameter.localisation_id) ? e.parameter.localisation_id : '';
      return buildResponse_(getLayout_(localisationId));
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
      return buildResponse_(deleteBottle_(body.id, body.comment || ''));
    }

    if (action === 'addLocalisation') {
      if (!body.data) return buildResponse_({ error: 'Champ data manquant' }, 400);
      return buildResponse_(addLocalisation_(body.data));
    }

    if (action === 'updateLocalisation') {
      if (!body.id) return buildResponse_({ error: 'Champ id manquant' }, 400);
      if (!body.data) return buildResponse_({ error: 'Champ data manquant' }, 400);
      return buildResponse_(updateLocalisation_(body.id, body.data));
    }

    if (action === 'deleteLocalisation') {
      if (!body.id) return buildResponse_({ error: 'Champ id manquant' }, 400);
      return buildResponse_(deleteLocalisation_(body.id));
    }

    if (action === 'saveLayout') {
      if (!body.localisation_id) return buildResponse_({ error: 'Champ localisation_id manquant' }, 400);
      if (!body.data) return buildResponse_({ error: 'Champ data manquant' }, 400);
      return buildResponse_(saveLayout_(body.localisation_id, body.data));
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

      // Utiliser les en-têtes RÉELS de la feuille (pas la constante HEADERS)
      // pour garantir que l'ordre et le nombre de colonnes correspondent exactement.
      var updatedRow = headers.map(function(header, j) {
        return data[header] !== undefined ? data[header] : sheetData[i][j];
      });

      sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      return { success: true, id: id };
    }
  }

  return { error: 'Bouteille introuvable : ' + id };
}

function deleteBottle_(id) {
  // Archive la bouteille au lieu de la supprimer physiquement
  var sheet = getSheet_();
  var sheetData = sheet.getDataRange().getValues();
  var headers = sheetData[0];
  var idIndex = headers.indexOf('id');

  if (idIndex === -1) throw new Error('Colonne id introuvable');

  var archivedIndex = headers.indexOf('archived');
  var archivedAtIndex = headers.indexOf('archived_at');
  var archiveCommentIndex = headers.indexOf('archive_comment');
  var dateModifIndex = headers.indexOf('date_modification');

  for (var i = 1; i < sheetData.length; i++) {
    if (String(sheetData[i][idIndex]) === String(id)) {
      var now = new Date().toISOString();
      var row = sheetData[i].slice();
      if (archivedIndex !== -1) row[archivedIndex] = true;
      if (archivedAtIndex !== -1) row[archivedAtIndex] = now;
      if (archiveCommentIndex !== -1) row[archiveCommentIndex] = arguments[1] || '';
      if (dateModifIndex !== -1) row[dateModifIndex] = now;

      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { success: true, id: id };
    }
  }

  return { error: 'Bouteille introuvable : ' + id };
}

// ── Opérations CRUD Localisations ────────────────────────────────────────────────────

function getLocalisations_() {
  var sheet = getLocalisationsSheet_();
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  var headers = data[0];
  var localisations = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var loc = {};
    for (var j = 0; j < headers.length; j++) {
      loc[headers[j]] = row[j] !== undefined ? row[j] : '';
    }
    localisations.push(loc);
  }

  return localisations;
}

function addLocalisation_(data) {
  var sheet = getLocalisationsSheet_();
  var now = new Date().toISOString();

  data.date_creation = now;
  data.date_modification = now;

  if (!data.id) {
    data.id = Utilities.getUuid();
  }

  var row = LOCALISATIONS_HEADERS.map(function(header) {
    return data[header] !== undefined ? data[header] : '';
  });

  sheet.appendRow(row);
  return { success: true, id: data.id };
}

function updateLocalisation_(id, data) {
  var sheet = getLocalisationsSheet_();
  var sheetData = sheet.getDataRange().getValues();
  var headers = sheetData[0];
  var idIndex = headers.indexOf('id');

  if (idIndex === -1) throw new Error('Colonne id introuvable');

  for (var i = 1; i < sheetData.length; i++) {
    if (String(sheetData[i][idIndex]) === String(id)) {
      data.date_modification = new Date().toISOString();
      data.id = id;
      data.date_creation = sheetData[i][headers.indexOf('date_creation')] || new Date().toISOString();

      var updatedRow = headers.map(function(header, j) {
        return data[header] !== undefined ? data[header] : sheetData[i][j];
      });

      sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      return { success: true, id: id };
    }
  }

  return { error: 'Localisation introuvable : ' + id };
}

function deleteLocalisation_(id) {
  var sheet = getLocalisationsSheet_();
  var sheetData = sheet.getDataRange().getValues();
  var headers = sheetData[0];
  var idIndex = headers.indexOf('id');

  if (idIndex === -1) throw new Error('Colonne id introuvable');

  for (var i = 1; i < sheetData.length; i++) {
    if (String(sheetData[i][idIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      deleteLayout_(id);
      return { success: true };
    }
  }

  return { error: 'Localisation introuvable : ' + id };
}

// ── Layout (plan par localisation) ──────────────────────────────────────────────────────────────

function getLayout_(localisationId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LAYOUTS_SHEET_NAME);
  if (!sheet) return { layout: null };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { layout: null };

  // Chaque ligne : [localisation_id, layout_json]
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(localisationId)) {
      try {
        return { layout: JSON.parse(data[i][1]) };
      } catch (e) {
        return { layout: null };
      }
    }
  }
  return { layout: null };
}

function saveLayout_(localisationId, data) {
  try {
    var json = typeof data === 'string' ? data : JSON.stringify(data);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(LAYOUTS_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(LAYOUTS_SHEET_NAME);
      sheet.appendRow(['localisation_id', 'layout_json']);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 2)
        .setBackground('#722F37')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
    }

    var sheetData = sheet.getDataRange().getValues();
    for (var i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][0]) === String(localisationId)) {
        sheet.getRange(i + 1, 2).setValue(json);
        return { success: true };
      }
    }

    // Nouvelle entrée
    sheet.appendRow([localisationId, json]);
    return { success: true };
  } catch (e) {
    return { error: 'Impossible de sauvegarder le layout : ' + e.message };
  }
}

function deleteLayout_(localisationId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LAYOUTS_SHEET_NAME);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(localisationId)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#722F37')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
  }

  return sheet;
}

function getLocalisationsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LOCALISATIONS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(LOCALISATIONS_SHEET_NAME);
    sheet.appendRow(LOCALISATIONS_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, LOCALISATIONS_HEADERS.length)
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
