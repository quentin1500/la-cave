'use strict';

/**
 * Client pour l'API Google Sheets via Apps Script.
 * Voir docs/adr/002-persistance-google-sheets.md pour les détails techniques.
 */
const SheetsAPI = (() => {

  // ── Lecture ───────────────────────────────────────────────────────────────

  /**
   * Récupère toutes les bouteilles depuis Google Sheets.
   * @returns {Promise<Array>}
   */
  async function getAllBottles() {
    const url = `${CONFIG.SHEETS_API_URL}?action=getAll`;
    const data = await get_(url);
    if (data.error) throw new Error(data.error);
    return Array.isArray(data) ? data : [];
  }

  // ── Écriture ──────────────────────────────────────────────────────────────

  /**
   * Ajoute une nouvelle bouteille.
   * @param {Object} bottle  Objet bouteille sans id (généré côté client)
   * @returns {Promise<Object>} { success: true, id }
   */
  async function addBottle(bottle) {
    bottle.id = crypto.randomUUID();
    return post_({ action: 'add', data: bottle });
  }

  /**
   * Met à jour une bouteille existante.
   * @param {string} id
   * @param {Object} bottle
   * @returns {Promise<Object>}
   */
  async function updateBottle(id, bottle) {
    return post_({ action: 'update', id, data: bottle });
  }

  /**
   * Supprime une bouteille.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async function deleteBottle(id) {
    // Optional comment for archival
    const comment = (arguments.length > 1 && arguments[1]) ? arguments[1] : '';
    return post_({ action: 'delete', id, comment });
  }

  /**
   * Récupère toutes les localisations.
   * @returns {Promise<Array>}
   */
  async function getLocalisations() {
    const url = `${CONFIG.SHEETS_API_URL}?action=getLocalisations`;
    const data = await get_(url);
    if (data.error) throw new Error(data.error);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Ajoute une nouvelle localisation.
   * @param {Object} localisation  { nom, description }
   * @returns {Promise<Object>} { success: true, id }
   */
  async function addLocalisation(localisation) {
    localisation.id = crypto.randomUUID();
    return post_({ action: 'addLocalisation', data: localisation });
  }

  /**
   * Met à jour une localisation existante.
   * @param {string} id
   * @param {Object} localisation
   * @returns {Promise<Object>}
   */
  async function updateLocalisation(id, localisation) {
    return post_({ action: 'updateLocalisation', id, data: localisation });
  }

  /**
   * Supprime une localisation et son layout associé.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async function deleteLocalisation(id) {
    return post_({ action: 'deleteLocalisation', id });
  }

  /**
   * Récupère le layout d'une localisation spécifique.
   * @param {string} localisationId
   * @returns {Promise<Object|null>}
   */
  async function getLayout(localisationId) {
    const url = `${CONFIG.SHEETS_API_URL}?action=getLayout&localisation_id=${encodeURIComponent(localisationId || '')}`;
    const data = await get_(url);
    if (data.error) throw new Error(data.error);
    return data.layout || null;
  }

  /**
   * Sauvegarde le layout d'une localisation (nécessite token admin).
   * @param {string} localisationId
   * @param {Object} layout
   * @returns {Promise<Object>}
   */
  async function saveLayout(localisationId, layout) {
    return post_({ action: 'saveLayout', localisation_id: localisationId, data: layout });
  }

  // ── Helpers internes ──────────────────────────────────────────────────────

  async function get_(url) {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
    return response.json();
  }

  async function post_(payload) {
    // Content-Type text/plain évite le preflight CORS avec Apps Script.
    // Voir ADR-002 pour l'explication complète.
    payload.apiKey = Auth.getToken();

    const response = await fetch(CONFIG.SHEETS_API_URL, {
      method:   'POST',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     JSON.stringify(payload),
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  return { getAllBottles, addBottle, updateBottle, deleteBottle, getLocalisations, addLocalisation, updateLocalisation, deleteLocalisation, getLayout, saveLayout };
})();
