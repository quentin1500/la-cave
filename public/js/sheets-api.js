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
    return post_({ action: 'delete', id });
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

  return { getAllBottles, addBottle, updateBottle, deleteBottle };
})();
