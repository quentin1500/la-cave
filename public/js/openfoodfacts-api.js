'use strict';

/**
 * Client pour l'API OpenFoodFacts.
 * Voir docs/adr/004-integration-openfoodfacts.md pour les détails.
 */
const OpenFoodFacts = (() => {

  const BASE = CONFIG.OFF_API_BASE;

  // ── Requêtes ──────────────────────────────────────────────────────────────

  /**
   * Recherche un produit par son code-barres.
   * @param {string} barcode  Code EAN-13 ou autre
   * @returns {Promise<Object|null>}  Objet produit OFF ou null si non trouvé
   */
  async function getByBarcode(barcode) {
    const url = `${BASE}/api/v3/product/${encodeURIComponent(barcode)}.json`;
    const data = await fetchOFF_(url);
    if (data.status === 'success' && data.product) {
      return data.product;
    }
    return null;
  }

  /**
   * Recherche des produits par texte libre.
   * @param {string} query  Texte de recherche
   * @param {number} [pageSize=8]
   * @returns {Promise<Array>}  Tableau de produits OFF
   */
  async function search(query, pageSize = 8) {
    const params = new URLSearchParams({
      search_terms: query,
      json: '1',
      page_size: String(pageSize),
      fields: 'product_name,brands,categories_tags,origins,image_front_url,alcohol_100g,quantity,labels,code',
    });
    const url = `${BASE}/cgi/search.pl?${params}`;
    const data = await fetchOFF_(url);
    return Array.isArray(data.products) ? data.products : [];
  }

  // ── Mapping OFF → Bouteille ───────────────────────────────────────────────

  /**
   * Convertit un objet produit OpenFoodFacts en objet bouteille partiel.
   * L'utilisateur pourra compléter/corriger les champs dans le formulaire.
   * @param {Object} product  Produit OFF
   * @returns {Object}  Champs bouteille pré-remplis
   */
  function mapToBottle(product) {
    const bottle = {};

    // Nom / cuvée
    if (product.product_name) {
      bottle.cuvee = product.product_name.trim();
    }

    // Producteur / marque
    if (product.brands) {
      bottle.producteur = product.brands.split(',')[0].trim();
    }

    // Type à partir des catégories
    bottle.type = detectType_(product.categories_tags || []);

    // Origine → région / pays
    if (product.origins) {
      const origins = product.origins.split(',').map(s => s.trim()).filter(Boolean);
      if (origins.length > 0) {
        bottle.pays   = origins[0];
        bottle.region = origins.length > 1 ? origins[1] : '';
      }
    }

    // Volume en ml
    if (product.quantity) {
      const vol = parseVolume_(product.quantity);
      if (vol) bottle.volume = vol;
    }

    // Degré d'alcool
    if (product.alcohol_100g) {
      const degre = parseFloat(product.alcohol_100g);
      if (!isNaN(degre)) bottle.degre_alcool = degre;
    }

    // Photo
    if (product.image_front_url) {
      bottle.photo_url = product.image_front_url;
    }

    // Code-barres
    if (product.code) {
      bottle.code_barres = product.code;
    }

    return bottle;
  }

  // ── Helpers internes ──────────────────────────────────────────────────────

  async function fetchOFF_(url) {
    const response = await fetch(url, {
      headers: { 'User-Agent': CONFIG.OFF_USER_AGENT },
    });
    if (!response.ok) throw new Error(`OpenFoodFacts : erreur HTTP ${response.status}`);
    return response.json();
  }

  /**
   * Détecte le type de boisson à partir des catégories OpenFoodFacts.
   * @param {string[]} tags
   * @returns {string}
   */
  function detectType_(tags) {
    const tagStr = tags.join(' ').toLowerCase();
    if (tagStr.includes('champagne'))             return 'champagne';
    if (tagStr.includes('cremant') || tagStr.includes('crémant')) return 'cremant';
    if (tagStr.includes('mousseux') || tagStr.includes('sparkling-wine')) return 'mousseux';
    if (tagStr.includes('whisky') || tagStr.includes('whiskey'))  return 'whisky';
    if (tagStr.includes('cognac'))                return 'cognac';
    if (tagStr.includes('armagnac'))              return 'armagnac';
    if (tagStr.includes('rum') || tagStr.includes('rhum'))        return 'rhum';
    if (tagStr.includes('rosé') || tagStr.includes('rose-wine'))  return 'rose';
    if (tagStr.includes('white-wine') || tagStr.includes('vin-blanc')) return 'blanc';
    if (tagStr.includes('red-wine') || tagStr.includes('vin-rouge'))   return 'rouge';
    if (tagStr.includes('wines') || tagStr.includes('vin'))       return 'rouge';
    return 'autre';
  }

  /**
   * Tente d'extraire un volume en millilitres depuis une chaîne.
   * Ex: "75 cl" → 750, "750 ml" → 750, "1.5 L" → 1500
   * @param {string} str
   * @returns {number|null}
   */
  function parseVolume_(str) {
    const normalized = str.toLowerCase().replace(',', '.');
    const match = normalized.match(/([\d.]+)\s*(ml|cl|l)\b/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const unit  = match[2];
    if (unit === 'ml') return Math.round(value);
    if (unit === 'cl') return Math.round(value * 10);
    if (unit === 'l')  return Math.round(value * 1000);
    return null;
  }

  return { getByBarcode, search, mapToBottle };
})();
