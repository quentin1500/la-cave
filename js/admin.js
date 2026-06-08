'use strict';

/**
 * Logique de l'interface d'administration (admin.html).
 * Gère l'authentification, le CRUD des bouteilles et l'intégration OpenFoodFacts.
 */
const AdminApp = (() => {

  // ── État ──────────────────────────────────────────────────────────────────
  let allBottles      = [];
  let filteredBottles = [];
  let archivedBottles = [];

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
      // Calcul du hash du mot de passe saisi
      const hash = await Auth.hashPassword(password);
      if (hash === CONFIG.ADMIN_PASSWORD_HASH) {
        // Le hash lui-même est utilisé comme token d'API — plus de secret distinct
        Auth.login(hash);
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

      // Séparer les bouteilles actives et archivées
      archivedBottles = allBottles.filter(isArchived_);
      const activeBottles = allBottles.filter(b => !isArchived_(b));

      filteredBottles = activeBottles;
      populateAdminTypeFilter_(activeBottles);
      renderBottleList_(filteredBottles);
      renderArchivedList_(archivedBottles);
      renderAdminStats_(activeBottles);
      showAdminState_(activeBottles.length === 0 ? 'empty' : 'table');
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
    // Demande de confirmation + commentaire d'archivage
    if (!confirm('Archiver cette bouteille (elle sera retirée de l\'interface publique) ?')) return;
    const comment = prompt('Commentaire d\'archivage (facultatif) :', '');

    try {
      await SheetsAPI.deleteBottle(id, comment || '');
      notify_('Bouteille archivée.', 'success');
      await loadBottles();
    } catch (err) {
      console.error('Erreur lors de l\'archivage :', err);
      notify_(`Erreur : ${err.message}`, 'error');
    }
  }

  // ── Éditeur de layout (plan de la cave) ─────────────────────────────────
  let _layout = null;
  function openLayoutEditor() {
    // Créer modal si nécessaire
    let modal = document.getElementById('layout-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'layout-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal__backdrop" id="layout-backdrop"></div>
        <div class="modal__panel" id="layout-panel" style="width:90vw;max-width:1000px;">
          <button class="modal__close" id="layout-close">✕</button>
          <h2>Éditeur du plan de la cave</h2>
          <div style="display:flex;gap:1rem;margin-top:0.5rem;">
            <button id="layout-add-slot" class="btn btn--secondary">Ajouter un emplacement</button>
            <button id="layout-save" class="btn btn--primary">Enregistrer</button>
            <button id="layout-close-btn" class="btn btn--ghost">Fermer</button>
          </div>
          <div id="layout-canvas" style="position:relative;margin-top:1rem;height:520px;border:1px solid var(--c-border);background:#f8f8f8;overflow:auto"></div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('layout-close').addEventListener('click', closeLayoutEditor);
      document.getElementById('layout-close-btn').addEventListener('click', closeLayoutEditor);
      document.getElementById('layout-add-slot').addEventListener('click', () => { addSlot_(); });
      document.getElementById('layout-save').addEventListener('click', () => saveLayout_());
      document.getElementById('layout-backdrop').addEventListener('click', closeLayoutEditor);
    }

    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    loadLayout_();
  }

  function closeLayoutEditor() {
    const modal = document.getElementById('layout-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  async function loadLayout_() {
    try {
      const layout = CONFIG.isConfigured ? await SheetsAPI.getLayout() : null;
      _layout = layout || { slots: [] };
      renderLayout_();
    } catch (err) {
      console.error('Erreur chargement layout :', err);
      _layout = { slots: [] };
      renderLayout_();
    }
  }

  function renderLayout_() {
    const canvas = document.getElementById('layout-canvas');
    canvas.innerHTML = '';
    canvas.style.position = 'relative';
    _layout.slots = _layout.slots || [];
    _layout.slots.forEach(s => {
      const el = document.createElement('div');
      el.className = 'layout-slot';
      el.style.position = 'absolute';
      el.style.left = (s.x || 10) + 'px';
      el.style.top  = (s.y || 10) + 'px';
      el.style.width = (s.size || 60) + 'px';
      el.style.height = (s.size || 60) + 'px';
      el.style.background = 'white';
      el.style.border = '2px solid var(--c-border)';
      el.style.cursor = 'grab';
      el.dataset.id = s.id || crypto.randomUUID();
      el.textContent = s.label || '';
      canvas.appendChild(el);
      enableDrag_(el);
    });
  }

  function addSlot_() {
    const canvas = document.getElementById('layout-canvas');
    const id = crypto.randomUUID();
    const newSlot = { id, x: 10, y: 10, size: 60, label: '' };
    _layout.slots.push(newSlot);
    renderLayout_();
  }

  function enableDrag_(el) {
    let startX, startY, origX, origY, dragging = false;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      origX = parseInt(el.style.left, 10) || 0;
      origY = parseInt(el.style.top, 10) || 0;
      el.style.cursor = 'grabbing';
      dragging = true;
    });
    document.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = (origX + dx) + 'px';
      el.style.top  = (origY + dy) + 'px';
    });
    document.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = 'grab';
      // update model
      const id = el.dataset.id;
      const slot = _layout.slots.find(s => s.id === id);
      if (slot) {
        slot.x = parseInt(el.style.left, 10) || 0;
        slot.y = parseInt(el.style.top, 10) || 0;
      }
    });
  }

  async function saveLayout_() {
    try {
      await SheetsAPI.saveLayout(_layout);
      notify_('Plan de cave enregistré.', 'success');
    } catch (err) {
      console.error('Erreur sauvegarde layout :', err);
      notify_('Erreur lors de l\'enregistrement du plan.', 'error');
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

  // ── Archivage ─────────────────────────────────────────────────────────────

  /** Détermine si une bouteille est archivée (robuste aux types Google Sheets). */
  function isArchived_(b) {
    return b.archived === true || b.archived === 'TRUE' || b.archived === 'true'
        || b.archived === 1   || b.archived === '1';
  }

  function renderArchivedList_(bottles) {
    const countEl = document.getElementById('admin-archived-count');
    const tbody   = document.getElementById('admin-archived-body');
    countEl.textContent = bottles.length;
    tbody.innerHTML     = '';

    bottles.forEach(b => {
      const typeLabel  = TYPE_LABELS[b.type] || b.type || '–';
      const typeColor  = TYPE_COLORS[b.type] || 'var(--c-type-autre)';
      const archivedAt = b.archived_at
        ? new Date(b.archived_at).toLocaleDateString('fr-FR')
        : '–';

      const tr = document.createElement('tr');
      tr.className = 'archived-row archived-row--clickable';
      tr.setAttribute('role', 'button');
      tr.setAttribute('tabindex', '0');
      tr.setAttribute('aria-label', `Voir les détails de ${b.cuvee || b.producteur || 'cette bouteille'}`);
      tr.innerHTML = `
        <td>
          <span class="badge" style="background-color:${typeColor};opacity:.65">${escapeHtml_(typeLabel)}</span>
        </td>
        <td class="archived-cell">${escapeHtml_(b.producteur || '–')}</td>
        <td class="archived-cell">${escapeHtml_(b.cuvee || '–')}</td>
        <td class="archived-cell">${escapeHtml_(String(b.millesime || '–'))}</td>
        <td class="archived-cell" style="white-space:nowrap">${escapeHtml_(archivedAt)}</td>
        <td class="archived-cell archived-cell--comment">${escapeHtml_(b.archive_comment || '')}</td>
        <td class="td-actions">
          <button
            class="btn btn--ghost btn--sm"
            onclick="event.stopPropagation(); AdminApp.handleUnarchive('${escapeHtml_(b.id || '')}')"
            aria-label="Désarchiver ${escapeHtml_(b.cuvee || '')}"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="1,4 1,10 7,10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
            </svg>
            Désarchiver
          </button>
        </td>
      `;

      const open = () => showArchivedDetail_(b);
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

      tbody.appendChild(tr);
    });
  }

  function showArchivedDetail_(bottle) {
    let modal = document.getElementById('archived-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id        = 'archived-detail-modal';
      modal.className = 'modal hidden';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'archived-detail-title');
      document.body.appendChild(modal);
    }

    const typeLabel  = TYPE_LABELS[bottle.type] || bottle.type || 'Autre';
    const typeColor  = TYPE_COLORS[bottle.type] || 'var(--c-type-autre)';
    const archivedAt = bottle.archived_at
      ? new Date(bottle.archived_at).toLocaleString('fr-FR')
      : '–';

    const detailRow = (label, value) => value
      ? `<div class="detail-row">
           <span class="detail-row__label">${escapeHtml_(label)}</span>
           <span class="detail-row__value">${escapeHtml_(String(value))}</span>
         </div>`
      : '';

    modal.innerHTML = `
      <div class="modal__backdrop" id="archived-detail-backdrop"></div>
      <div class="modal__panel" tabindex="-1" style="max-width:680px" id="archived-detail-panel">
        <button class="modal__close" onclick="AdminApp.closeArchivedDetail()" aria-label="Fermer">✕</button>
        <div style="padding:var(--sp-8)">
          <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-5);padding-bottom:var(--sp-5);border-bottom:1px solid var(--c-border)">
            <span class="badge" style="background-color:${typeColor}">${escapeHtml_(typeLabel)}</span>
            <div>
              <h2 id="archived-detail-title" style="font-size:var(--text-xl);margin-bottom:2px">${escapeHtml_(bottle.cuvee || 'Sans nom')}</h2>
              <p style="font-size:var(--text-sm);color:var(--c-gold);text-transform:uppercase;letter-spacing:.07em">${escapeHtml_(bottle.producteur || '')}</p>
            </div>
          </div>

          <div class="modal__details" style="margin-bottom:var(--sp-5)">
            ${detailRow('Millésime',   bottle.millesime)}
            ${detailRow('Appellation', bottle.appellation)}
            ${detailRow('Région',      bottle.region)}
            ${detailRow('Pays',         bottle.pays)}
            ${detailRow('Cépage(s)',   bottle.cepages)}
            ${detailRow('Volume',       bottle.volume ? `${bottle.volume} ml` : '')}
            ${detailRow('Alcool',       bottle.degre_alcool ? `${bottle.degre_alcool}°` : '')}
            ${detailRow('Date d\u2019achat', bottle.date_achat)}
            ${detailRow('Prix d\u2019achat', bottle.prix_achat ? `${Number(bottle.prix_achat).toFixed(2)}\u00a0€` : '')}
            ${detailRow('Valeur estimée', bottle.valeur_estimee ? `${Number(bottle.valeur_estimee).toFixed(2)}\u00a0€` : '')}
          </div>

          ${bottle.notes_personnelles ? `
            <div class="modal__notes" style="margin-bottom:var(--sp-5)">
              <h4>Notes personnelles</h4>
              <p>${escapeHtml_(bottle.notes_personnelles)}</p>
            </div>` : ''}

          <div class="archived-detail-meta">
            <div class="archived-detail-meta__header">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Archivage
            </div>
            <div class="archived-detail-meta__body">
              ${detailRow('Archivée le', archivedAt)}
              ${bottle.archive_comment
                ? `<div class="detail-row" style="margin-top:var(--sp-3)">
                     <span class="detail-row__label">Commentaire</span>
                     <span class="detail-row__value" style="font-style:italic;color:var(--c-text-muted)">${escapeHtml_(bottle.archive_comment)}</span>
                   </div>`
                : '<p style="font-size:var(--text-sm);color:var(--c-text-subtle);font-style:italic">Aucun commentaire d’archivage.</p>'}
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:var(--sp-3);margin-top:var(--sp-6);padding-top:var(--sp-4);border-top:1px solid var(--c-border)">
            <button class="btn btn--ghost" onclick="AdminApp.closeArchivedDetail()">Fermer</button>
            <button class="btn btn--secondary" onclick="AdminApp.closeArchivedDetail(); AdminApp.handleUnarchive('${escapeHtml_(bottle.id || '')}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="1,4 1,10 7,10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
              Désarchiver
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('archived-detail-backdrop').addEventListener('click', closeArchivedDetail);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('archived-detail-panel').focus();
  }

  function closeArchivedDetail() {
    const modal = document.getElementById('archived-detail-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  async function handleUnarchive(id) {
    if (!confirm('Restaurer cette bouteille dans la cave active ?')) return;

    try {
      await SheetsAPI.updateBottle(id, { archived: false, archived_at: '', archive_comment: '' });
      notify_('Bouteille restaurée avec succès.', 'success');
      await loadBottles();
    } catch (err) {
      console.error('Erreur lors de la restauration :', err);
      notify_(`Erreur : ${err.message}`, 'error');
    }
  }

  // ── Rendu du tableau ──────────────────────────────────────────────────────

  function renderBottleList_(bottles) {
    const tbody = document.getElementById('admin-table-body');
    tbody.innerHTML = '';

    bottles.forEach(b => {
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
        <td>${escapeHtml_(emplacement)}</td>
        <td>${escapeHtml_(prix)}</td>
        <td class="td-actions">
          <button
            class="btn btn--ghost btn--sm"
            data-action="edit"
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
      tr.querySelector('[data-action="edit"]').addEventListener('click', () => showForm(b));
      tbody.appendChild(tr);
    });
  }

  function renderAdminStats_(bottles) {
    const totalRefs = bottles.length;
    const valeur    = bottles.reduce((s, b) => {
      const val = parseFloat(b.valeur_estimee) || parseFloat(b.prix_achat) || 0;
      return s + val;
    }, 0);

    document.getElementById('admin-stat-total').textContent  = totalRefs;
    document.getElementById('admin-stat-valeur').textContent = valeur > 0
      ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(valeur)
      : '–';
  }

  // ── Filtres admin ─────────────────────────────────────────────────────────

  function populateAdminTypeFilter_(bottles) {
    const select  = document.getElementById('admin-filter-type');
    const current = select.value;
    while (select.options.length > 1) select.remove(1);
    const activeList = bottles || allBottles.filter(b => !isArchived_(b));
    const types = [...new Set(activeList.filter(b => b.type).map(b => b.type))].sort();
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

    const activeBottles = allBottles.filter(b => !isArchived_(b));
    filteredBottles = activeBottles.filter(b => {
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
    // La section archives est visible dès qu'il y a des bouteilles archivées (hors chargement/erreur)
    const showArchived = archivedBottles.length > 0 && state !== 'loading' && state !== 'error';
    document.getElementById('admin-archived-section').classList.toggle('hidden', !showArchived);
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
    handleUnarchive,
    closeArchivedDetail,
    lookupOFF,
    loadBottles,
    openLayoutEditor,
  };
})();

// Auto-démarrage
document.addEventListener('DOMContentLoaded', AdminApp.init);
