'use strict';

/**
 * Logique de l'interface d'administration (admin.html).
 * Gère l'authentification, le CRUD des bouteilles et l'intégration OpenFoodFacts.
 */
const AdminApp = (() => {

  // ── État ──────────────────────────────────────────────────────────────────
  let allBottles      = [];
  let filteredBottles = [];

  // ── Initialisation ────────────────────────────────────────────────────────

  function init() {
    // Vérifier la session existante
    if (Auth.isLoggedIn()) {
      showApp_();
    }

    // Formulaire de connexion
    document.getElementById('login-form').addEventListener('submit', handleLogin_);

    // Formulaire d'ajout / édition de bouteille
    document.getElementById('bottle-form').addEventListener('submit', handleSubmit);

    // Fermeture du modal formulaire via le fond
    document.getElementById('form-backdrop').addEventListener('click', hideForm);

    // Fermeture via Echap
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideForm(); });

    // Recherche et filtre admin
    document.getElementById('admin-search').addEventListener('input', debounce_(applyAdminFilters_, 280));
    document.getElementById('admin-filter-type').addEventListener('change', applyAdminFilters_);

    // Remplir le select de types dans le formulaire
    populateTypeSelect_();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function handleLogin_(e) {
    e.preventDefault();
    const errorEl  = document.getElementById('login-error');
    const submitEl = e.target.querySelector('button[type="submit"]');
    const password = document.getElementById('login-password').value;

    errorEl.classList.add('hidden');
    submitEl.disabled    = true;
    submitEl.textContent = 'Vérification…';

    try {
      const ok = await Auth.verifyPassword(password, CONFIG.ADMIN_PASSWORD_HASH);
      if (ok) {
        Auth.login(CONFIG.SHEETS_API_KEY);
        showApp_();
      } else {
        errorEl.classList.remove('hidden');
        document.getElementById('login-password').value = '';
        document.getElementById('login-password').focus();
      }
    } catch (err) {
      console.error('Erreur lors de la vérification du mot de passe :', err);
      errorEl.textContent = 'Une erreur est survenue. Veuillez réessayer.';
      errorEl.classList.remove('hidden');
    } finally {
      submitEl.disabled    = false;
      submitEl.textContent = 'Se connecter';
    }
  }

  function logout() {
    Auth.logout();
    document.getElementById('auth-overlay').classList.remove('hidden');
    document.getElementById('admin-app').classList.add('hidden');
    document.getElementById('login-password').value = '';
  }

  function showApp_() {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('admin-app').classList.remove('hidden');
    loadBottles();
  }

  // ── CRUD Bouteilles ───────────────────────────────────────────────────────

  async function loadBottles() {
    showAdminState_('loading');

    try {
      allBottles = CONFIG.isConfigured
        ? await SheetsAPI.getAllBottles()
        : SAMPLE_BOTTLES;

      filteredBottles = allBottles;
      populateAdminTypeFilter_();
      renderBottleList_(filteredBottles);
      renderAdminStats_(allBottles);
      showAdminState_(allBottles.length === 0 ? 'empty' : 'table');
    } catch (err) {
      console.error('Erreur de chargement :', err);
      document.getElementById('admin-error-message').textContent = err.message || 'Impossible de charger les bouteilles.';
      showAdminState_('error');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('form-submit-btn');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Enregistrement…';

    try {
      const id     = document.getElementById('form-id').value.trim();
      const bottle = collectFormData_();

      if (id) {
        await SheetsAPI.updateBottle(id, bottle);
        notify_('Bouteille mise à jour avec succès.', 'success');
      } else {
        await SheetsAPI.addBottle(bottle);
        notify_('Bouteille ajoutée avec succès.', 'success');
      }

      hideForm();
      await loadBottles();
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement :', err);
      notify_(`Erreur : ${err.message}`, 'error');
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Enregistrer';
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette bouteille de façon définitive ?')) return;

    try {
      await SheetsAPI.deleteBottle(id);
      notify_('Bouteille supprimée.', 'success');
      await loadBottles();
    } catch (err) {
      console.error('Erreur lors de la suppression :', err);
      notify_(`Erreur : ${err.message}`, 'error');
    }
  }

  // ── Formulaire ────────────────────────────────────────────────────────────

  function showForm(bottle) {
    const modal    = document.getElementById('form-modal');
    const titleEl  = document.getElementById('form-modal-title');
    const submitEl = document.getElementById('form-submit-btn');

    resetForm_();

    if (bottle) {
      titleEl.textContent  = 'Modifier la bouteille';
      submitEl.textContent = 'Enregistrer les modifications';
      populateForm_(bottle);
    } else {
      titleEl.textContent  = 'Ajouter une bouteille';
      submitEl.textContent = 'Ajouter la bouteille';
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('form-panel').focus();
  }

  function hideForm() {
    document.getElementById('form-modal').classList.add('hidden');
    document.body.style.overflow = '';
    resetForm_();
  }

  function resetForm_() {
    document.getElementById('bottle-form').reset();
    document.getElementById('form-id').value = '';
    document.getElementById('off-results').innerHTML = '';
    document.getElementById('off-results').classList.add('hidden');
    document.getElementById('off-search-input').value = '';
    // Valeur par défaut pour la quantité
    document.getElementById('f-quantite').value = '1';
  }

  function populateForm_(bottle) {
    document.getElementById('form-id').value          = bottle.id || '';
    document.getElementById('f-type').value           = bottle.type || '';
    document.getElementById('f-producteur').value     = bottle.producteur || '';
    document.getElementById('f-cuvee').value          = bottle.cuvee || '';
    document.getElementById('f-millesime').value      = bottle.millesime || '';
    document.getElementById('f-appellation').value    = bottle.appellation || '';
    document.getElementById('f-region').value         = bottle.region || '';
    document.getElementById('f-pays').value           = bottle.pays || '';
    document.getElementById('f-cepages').value        = bottle.cepages || '';
    document.getElementById('f-volume').value         = bottle.volume || '';
    document.getElementById('f-degre').value          = bottle.degre_alcool || '';
    document.getElementById('f-code-barres').value    = bottle.code_barres || '';
    document.getElementById('f-photo').value          = bottle.photo_url || '';
    document.getElementById('f-rang').value           = bottle.rang || '';
    document.getElementById('f-colonne').value        = bottle.colonne || '';
    document.getElementById('f-quantite').value       = bottle.quantite !== undefined ? bottle.quantite : '1';
    document.getElementById('f-date-achat').value     = bottle.date_achat || '';
    document.getElementById('f-prix-achat').value     = bottle.prix_achat || '';
    document.getElementById('f-valeur').value         = bottle.valeur_estimee || '';
    document.getElementById('f-notes').value          = bottle.notes_personnelles || '';
  }

  function collectFormData_() {
    const val = id => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };
    return {
      type:               val('f-type'),
      producteur:         val('f-producteur'),
      cuvee:              val('f-cuvee'),
      millesime:          val('f-millesime'),
      appellation:        val('f-appellation'),
      region:             val('f-region'),
      pays:               val('f-pays'),
      cepages:            val('f-cepages'),
      volume:             val('f-volume')     ? Number(val('f-volume'))     : '',
      degre_alcool:       val('f-degre')      ? Number(val('f-degre'))      : '',
      code_barres:        val('f-code-barres'),
      photo_url:          val('f-photo'),
      rang:               val('f-rang')       ? Number(val('f-rang'))       : '',
      colonne:            val('f-colonne')    ? Number(val('f-colonne'))    : '',
      quantite:           val('f-quantite')   ? Number(val('f-quantite'))   : 0,
      date_achat:         val('f-date-achat'),
      prix_achat:         val('f-prix-achat') ? Number(val('f-prix-achat')) : '',
      valeur_estimee:     val('f-valeur')     ? Number(val('f-valeur'))     : '',
      notes_personnelles: val('f-notes'),
    };
  }

  // ── OpenFoodFacts ─────────────────────────────────────────────────────────

  async function lookupOFF() {
    const query     = document.getElementById('off-search-input').value.trim();
    const resultsEl = document.getElementById('off-results');
    const searchBtn = document.getElementById('off-search-btn');

    if (!query) return;

    resultsEl.innerHTML = '';
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = `<div class="off-no-result">Recherche en cours…</div>`;
    searchBtn.disabled  = true;

    try {
      let products = [];

      // Si c'est un code-barres (uniquement des chiffres, 8–14 caractères)
      if (/^\d{8,14}$/.test(query)) {
        const product = await OpenFoodFacts.getByBarcode(query);
        if (product) products = [product];
      } else {
        products = await OpenFoodFacts.search(query);
      }

      if (products.length === 0) {
        resultsEl.innerHTML = `<div class="off-no-result">Aucun résultat trouvé sur OpenFoodFacts.</div>`;
        return;
      }

      resultsEl.innerHTML = '';
      products.slice(0, 6).forEach(p => {
        const item = document.createElement('div');
        item.className   = 'off-result-item';
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');

        const imgSrc = p.image_front_url || p.image_url || '';
        item.innerHTML = `
          ${imgSrc ? `<img src="${escapeHtml_(imgSrc)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div>
            <div class="off-result-item__name">${escapeHtml_(p.product_name || 'Produit sans nom')}</div>
            <div class="off-result-item__brand">${escapeHtml_(p.brands || '')}</div>
          </div>
        `;

        const apply = () => applyOFFData_(p);
        item.addEventListener('click', apply);
        item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(); } });
        resultsEl.appendChild(item);
      });

    } catch (err) {
      console.error('Erreur OpenFoodFacts :', err);
      resultsEl.innerHTML = `<div class="off-no-result">Erreur lors de la recherche. Vérifiez votre connexion.</div>`;
    } finally {
      searchBtn.disabled = false;
    }
  }

  function applyOFFData_(product) {
    const mapped = OpenFoodFacts.mapToBottle(product);

    // Remplir les champs seulement s'ils sont vides
    const fillIfEmpty = (id, value) => {
      if (value === undefined || value === null || value === '') return;
      const el = document.getElementById(id);
      if (el && !el.value.trim()) el.value = value;
    };

    if (mapped.type) document.getElementById('f-type').value = mapped.type;
    fillIfEmpty('f-producteur',  mapped.producteur);
    fillIfEmpty('f-cuvee',       mapped.cuvee);
    fillIfEmpty('f-region',      mapped.region);
    fillIfEmpty('f-pays',        mapped.pays);
    fillIfEmpty('f-volume',      mapped.volume);
    fillIfEmpty('f-degre',       mapped.degre_alcool);
    fillIfEmpty('f-photo',       mapped.photo_url);
    fillIfEmpty('f-code-barres', mapped.code_barres);

    document.getElementById('off-results').classList.add('hidden');
    notify_('Données OpenFoodFacts appliquées. Vérifiez et complétez le formulaire.', 'info');
  }

  // ── Rendu du tableau ──────────────────────────────────────────────────────

  function renderBottleList_(bottles) {
    const tbody = document.getElementById('admin-table-body');
    tbody.innerHTML = '';

    bottles.forEach(b => {
      const qty    = parseInt(b.quantite) || 0;
      const typeLabel = TYPE_LABELS[b.type] || b.type || '–';
      const typeColor = TYPE_COLORS[b.type] || 'var(--c-type-autre)';
      const emplacement = (b.rang && b.colonne) ? `R${b.rang} C${b.colonne}` : '–';
      const prix  = b.prix_achat ? `${Number(b.prix_achat).toFixed(2)} €` : '–';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span class="badge" style="background-color:${typeColor}">${escapeHtml_(typeLabel)}</span>
        </td>
        <td>${escapeHtml_(b.producteur || '–')}</td>
        <td>${escapeHtml_(b.cuvee || '–')}</td>
        <td>${escapeHtml_(String(b.millesime || '–'))}</td>
        <td style="font-weight:700;color:${qty === 0 ? 'var(--c-error)' : 'var(--c-text)'}">${qty}</td>
        <td>${escapeHtml_(emplacement)}</td>
        <td>${escapeHtml_(prix)}</td>
        <td class="td-actions">
          <button
            class="btn btn--ghost btn--sm"
            onclick="AdminApp.showForm(${JSON.stringify(b).replace(/</g, '\\u003c')})"
            aria-label="Modifier ${escapeHtml_(b.cuvee || '')}"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Modifier
          </button>
          <button
            class="btn btn--danger btn--sm"
            onclick="AdminApp.handleDelete('${escapeHtml_(b.id || '')}')"
            aria-label="Supprimer ${escapeHtml_(b.cuvee || '')}"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
            </svg>
            Supprimer
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAdminStats_(bottles) {
    const totalRefs = bottles.length;
    const totalQty  = bottles.reduce((s, b) => s + (parseInt(b.quantite) || 0), 0);
    const valeur    = bottles.reduce((s, b) => {
      const qty = parseInt(b.quantite) || 0;
      const val = parseFloat(b.valeur_estimee) || parseFloat(b.prix_achat) || 0;
      return s + qty * val;
    }, 0);

    document.getElementById('admin-stat-total').textContent  = totalRefs;
    document.getElementById('admin-stat-qty').textContent    = totalQty;
    document.getElementById('admin-stat-valeur').textContent = valeur > 0
      ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(valeur)
      : '–';
  }

  // ── Filtres admin ─────────────────────────────────────────────────────────

  function populateAdminTypeFilter_() {
    const select  = document.getElementById('admin-filter-type');
    const current = select.value;
    while (select.options.length > 1) select.remove(1);
    const types = [...new Set(allBottles.filter(b => b.type).map(b => b.type))].sort();
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value       = t;
      opt.textContent = TYPE_LABELS[t] || t;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  function applyAdminFilters_() {
    const type   = document.getElementById('admin-filter-type').value;
    const search = document.getElementById('admin-search').value.toLowerCase().trim();

    filteredBottles = allBottles.filter(b => {
      if (type && b.type !== type) return false;
      if (search) {
        const hay = [b.producteur, b.cuvee, b.appellation, b.region, b.pays]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    renderBottleList_(filteredBottles);
    showAdminState_(filteredBottles.length === 0 ? 'empty' : 'table');
  }

  function populateTypeSelect_() {
    const select = document.getElementById('f-type');
    BOTTLE_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value       = t;
      opt.textContent = TYPE_LABELS[t] || t;
      select.appendChild(opt);
    });
  }

  // ── Affichage des états ───────────────────────────────────────────────────

  function showAdminState_(state) {
    document.getElementById('admin-loading').classList.toggle('hidden', state !== 'loading');
    document.getElementById('admin-error').classList.toggle('hidden', state !== 'error');
    document.getElementById('admin-empty').classList.toggle('hidden', state !== 'empty');
    document.getElementById('admin-table-wrapper').classList.toggle('hidden', state !== 'table');
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  function notify_(message, type = 'info') {
    const el = document.getElementById('notification');
    el.textContent  = message;
    el.className    = `notification notification--${type}`;
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 4000);
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  function escapeHtml_(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function debounce_(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ── API publique ──────────────────────────────────────────────────────────
  return {
    init,
    logout,
    showForm,
    hideForm,
    handleSubmit,
    handleDelete,
    lookupOFF,
    loadBottles,
  };
})();

// Auto-démarrage
document.addEventListener('DOMContentLoaded', AdminApp.init);
