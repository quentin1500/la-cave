'use strict';

/**
 * Logique de l'interface d'administration (admin.html).
 * Gère l'authentification, le CRUD des bouteilles et l'intégration OpenFoodFacts.
 */
const AdminApp = (() => {

  // ── État ──────────────────────────────────────────────────────────────────
  let allBottles          = [];
  let filteredBottles     = [];
  let archivedBottles     = [];
  let _archivePendingId   = null;
  let _localisations      = [];
  let _editingLocalisationId = null;
  let _layoutsCache       = {}; // { [localisationId]: slots[] }

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
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        hideForm();
        closeArchiveModal();
      }
    });

    // Recherche et filtre admin
    document.getElementById('admin-search').addEventListener('input', debounce_(applyAdminFilters_, 280));
    document.getElementById('admin-filter-type').addEventListener('change', applyAdminFilters_);

    // Slot dynamique selon la localisation choisie
    document.getElementById('f-localisation').addEventListener('change', () => {
      loadSlotsForLocalisation_(document.getElementById('f-localisation').value);
    });

    // Remplir le select de types dans le formulaire
    populateTypeSelect_();

    // Initialiser le sélecteur d'étoiles
    initStarPicker_();
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
    loadLocalisations_().then(() => {
      populateLocalisationSelect_();
    });
    loadBottles();
  }

  // ── CRUD Bouteilles ───────────────────────────────────────────────────────

  async function loadBottles() {
    showAdminState_('loading');

    try {
      allBottles = CONFIG.isConfigured
        ? await SheetsAPI.getAllBottles()
        : SAMPLE_BOTTLES;

      // S'assurer que les localisations sont chargées pour l'affichage
      if (CONFIG.isConfigured && _localisations.length === 0) {
        await loadLocalisations_();
        populateLocalisationSelect_();
      }

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

  function handleDelete(id) {
    const bottle = allBottles.find(b => b.id === id);
    _archivePendingId = id;
    openArchiveModal_(bottle);
  }

  function openArchiveModal_(bottle) {
    const modal  = document.getElementById('archive-modal');
    const nameEl = document.getElementById('archive-modal-bottle-name');
    document.getElementById('archive-comment').value = '';

    if (bottle) {
      const parts = [bottle.cuvee || bottle.producteur, bottle.millesime].filter(Boolean);
      nameEl.textContent = parts.join(' — ') || 'Cette bouteille';
    } else {
      nameEl.textContent = '';
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('archive-panel').focus();

    document.getElementById('archive-backdrop').onclick = closeArchiveModal;
  }

  function closeArchiveModal() {
    document.getElementById('archive-modal').classList.add('hidden');
    document.body.style.overflow = '';
    _archivePendingId = null;
  }

  async function confirmArchive() {
    if (!_archivePendingId) return;

    const id      = _archivePendingId;
    const comment = document.getElementById('archive-comment').value.trim();
    const btn     = document.getElementById('archive-confirm-btn');

    btn.disabled    = true;
    btn.textContent = 'Archivage…';

    try {
      await SheetsAPI.deleteBottle(id, comment);
      closeArchiveModal();
      notify_('Bouteille archivée.', 'success');
      await loadBottles();
    } catch (err) {
      console.error('Erreur lors de l\'archivage :', err);
      notify_(`Erreur : ${err.message}`, 'error');
    } finally {
      btn.disabled    = false;
      btn.innerHTML   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Archiver`;
    }
  }

  // ── Gestion des localisations ────────────────────────────────────────────

  async function loadLocalisations_() {
    if (!CONFIG.isConfigured) {
      _localisations = [];
      return;
    }
    try {
      _localisations = await SheetsAPI.getLocalisations();
    } catch (err) {
      console.error('Erreur chargement localisations :', err);
      _localisations = [];
    }
  }

  function populateLocalisationSelect_() {
    const select = document.getElementById('f-localisation');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);
    _localisations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value       = loc.id;
      opt.textContent = loc.nom;
      select.appendChild(opt);
    });
  }

  function openLocalisationsManager() {
    let modal = document.getElementById('localisations-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'localisations-modal';
      modal.className = 'modal hidden';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'localisations-modal-title');
      modal.innerHTML = `
        <div class="modal__backdrop" id="localisations-backdrop"></div>
        <div class="modal__panel" tabindex="-1" style="width:90vw;max-width:700px;" id="localisations-panel">
          <button class="modal__close" id="localisations-close" aria-label="Fermer">✕</button>
          <div style="padding:var(--sp-8)">
            <h2 id="localisations-modal-title">Localisations</h2>
            <p style="font-size:var(--text-sm);color:var(--c-text-muted);margin-bottom:var(--sp-5)">
              Gérez vos espaces de stockage. Chaque localisation dispose d'un plan de cave éditable indépendant.
            </p>
            <div id="localisations-list"></div>
            <div style="margin-top:var(--sp-6);padding-top:var(--sp-5);border-top:1px solid var(--c-border)">
              <h3 id="loc-form-title" style="font-size:var(--text-base);margin-bottom:var(--sp-4)">Ajouter une localisation</h3>
              <div class="form-group">
                <label for="loc-nom">Nom <span class="required" aria-label="obligatoire">*</span></label>
                <input type="text" id="loc-nom" class="form-control" placeholder="ex: Cave principale, Armoire à vins">
              </div>
              <div class="form-group">
                <label for="loc-description">Description</label>
                <input type="text" id="loc-description" class="form-control" placeholder="ex: Cave sous-sol, 14 °C constant">
              </div>
              <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-4)">
                <button type="button" id="loc-cancel-btn" class="btn btn--ghost" style="display:none">Annuler</button>
                <button type="button" id="loc-save-btn" class="btn btn--primary">Ajouter</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('localisations-close').addEventListener('click', closeLocalisationsManager);
      document.getElementById('localisations-backdrop').addEventListener('click', closeLocalisationsManager);
      document.getElementById('loc-save-btn').addEventListener('click', saveLocalisation_);
      document.getElementById('loc-cancel-btn').addEventListener('click', cancelLocalisationEdit_);
    }

    _editingLocalisationId = null;
    document.body.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    renderLocalisationsList_();
    document.getElementById('localisations-panel').focus();
  }

  function closeLocalisationsManager() {
    const modal = document.getElementById('localisations-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    _editingLocalisationId = null;
  }

  function renderLocalisationsList_() {
    const list = document.getElementById('localisations-list');
    if (!list) return;

    if (_localisations.length === 0) {
      list.innerHTML = `<p style="font-size:var(--text-sm);color:var(--c-text-subtle);font-style:italic">Aucune localisation créée.</p>`;
      return;
    }

    list.innerHTML = '';
    _localisations.forEach(loc => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) 0;border-bottom:1px solid var(--c-border)';
      item.innerHTML = `
        <div style="flex:1;min-width:0">
          <div style="font-weight:500">${escapeHtml_(loc.nom)}</div>
          ${loc.description ? `<div style="font-size:var(--text-sm);color:var(--c-text-muted)">${escapeHtml_(loc.description)}</div>` : ''}
        </div>
        <button class="btn btn--ghost btn--sm" data-action="plan" data-id="${escapeHtml_(loc.id)}" data-nom="${escapeHtml_(loc.nom)}" aria-label="Éditer le plan de ${escapeHtml_(loc.nom)}">Plan</button>
        <button class="btn btn--ghost btn--sm" data-action="edit" data-id="${escapeHtml_(loc.id)}" aria-label="Modifier ${escapeHtml_(loc.nom)}">Modifier</button>
        <button class="btn btn--danger btn--sm" data-action="delete" data-id="${escapeHtml_(loc.id)}" aria-label="Supprimer ${escapeHtml_(loc.nom)}">Supprimer</button>
      `;

      item.querySelector('[data-action="plan"]').addEventListener('click', e => {
        const id  = e.currentTarget.dataset.id;
        const nom = e.currentTarget.dataset.nom;
        closeLocalisationsManager();
        openLayoutEditor(id, nom);
      });
      item.querySelector('[data-action="edit"]').addEventListener('click', e => {
        editLocalisation_(e.currentTarget.dataset.id);
      });
      item.querySelector('[data-action="delete"]').addEventListener('click', e => {
        removeLocalisation_(e.currentTarget.dataset.id);
      });

      list.appendChild(item);
    });
  }

  function editLocalisation_(id) {
    const loc = _localisations.find(l => l.id === id);
    if (!loc) return;
    _editingLocalisationId = id;
    document.getElementById('loc-form-title').textContent = 'Modifier la localisation';
    document.getElementById('loc-nom').value = loc.nom || '';
    document.getElementById('loc-description').value = loc.description || '';
    document.getElementById('loc-save-btn').textContent = 'Enregistrer';
    document.getElementById('loc-cancel-btn').style.display = '';
    document.getElementById('loc-nom').focus();
  }

  function cancelLocalisationEdit_() {
    _editingLocalisationId = null;
    document.getElementById('loc-form-title').textContent = 'Ajouter une localisation';
    document.getElementById('loc-nom').value = '';
    document.getElementById('loc-description').value = '';
    document.getElementById('loc-save-btn').textContent = 'Ajouter';
    document.getElementById('loc-cancel-btn').style.display = 'none';
  }

  async function saveLocalisation_() {
    const nom = (document.getElementById('loc-nom').value || '').trim();
    if (!nom) {
      document.getElementById('loc-nom').focus();
      return;
    }
    const description = (document.getElementById('loc-description').value || '').trim();
    const saveBtn = document.getElementById('loc-save-btn');
    saveBtn.disabled = true;

    try {
      if (_editingLocalisationId) {
        await SheetsAPI.updateLocalisation(_editingLocalisationId, { nom, description });
        notify_('Localisation mise à jour.', 'success');
      } else {
        await SheetsAPI.addLocalisation({ nom, description });
        notify_('Localisation ajoutée.', 'success');
      }
      await loadLocalisations_();
      cancelLocalisationEdit_();
      renderLocalisationsList_();
      populateLocalisationSelect_();
    } catch (err) {
      console.error('Erreur sauvegarde localisation :', err);
      notify_(`Erreur : ${err.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function removeLocalisation_(id) {
    const loc = _localisations.find(l => l.id === id);
    const nom = loc ? loc.nom : 'cette localisation';
    if (!confirm(`Supprimer "${escapeHtml_(nom)}" ?\nLe plan associé sera également supprimé.\nLes bouteilles référençant cette localisation ne seront pas modifiées.`)) return;

    try {
      await SheetsAPI.deleteLocalisation(id);
      notify_('Localisation supprimée.', 'success');
      await loadLocalisations_();
      renderLocalisationsList_();
      populateLocalisationSelect_();
    } catch (err) {
      console.error('Erreur suppression localisation :', err);
      notify_(`Erreur : ${err.message}`, 'error');
    }
  }

  // ── Éditeur de layout (plan par localisation) ────────────────────────────
  let _layout = null;
  let _layoutLocalisationId = null;

  function openLayoutEditor(localisationId, localisationNom) {
    _layoutLocalisationId = localisationId || null;
    const title = localisationNom
      ? `Éditeur du plan — ${localisationNom}`
      : 'Éditeur du plan de la cave';

    let modal = document.getElementById('layout-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'layout-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal__backdrop" id="layout-backdrop"></div>
        <div class="modal__panel" id="layout-panel" style="width:90vw;max-width:1000px;">
          <button class="modal__close" id="layout-close">✕</button>
          <h2 id="layout-modal-title"></h2>
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

    const titleEl = document.getElementById('layout-modal-title');
    if (titleEl) titleEl.textContent = title;

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
      const layout = CONFIG.isConfigured ? await SheetsAPI.getLayout(_layoutLocalisationId || '') : null;
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
      await SheetsAPI.saveLayout(_layoutLocalisationId || '', _layout);
      // Invalider le cache pour cette localisation afin d'être synchronisé
      if (_layoutLocalisationId) delete _layoutsCache[_layoutLocalisationId];
      notify_('Plan enregistré.', 'success');
    } catch (err) {
      console.error('Erreur sauvegarde layout :', err);
      notify_('Erreur lors de l\'enregistrement du plan.', 'error');
    }
  }

  // ── Sélection d'emplacement (slot) ────────────────────────────────────────

  /**
   * Charge les slots du plan d'une localisation (avec cache), puis affiche le plan visuel.
   * @param {string} locId - Id de la localisation, ou chaîne vide
   * @param {string} [currentSlotId] - Slot à pré-sélectionner
   */
  async function loadSlotsForLocalisation_(locId, currentSlotId) {
    const slotGroup  = document.getElementById('f-slot-group');
    const slotHidden = document.getElementById('f-slot');
    if (!slotGroup) return;

    if (!locId) {
      slotGroup.classList.add('hidden');
      if (slotHidden) slotHidden.value = '';
      const picker = document.getElementById('f-slot-picker');
      if (picker) picker.innerHTML = '';
      return;
    }

    let slots = [];
    if (_layoutsCache[locId]) {
      slots = _layoutsCache[locId];
    } else if (CONFIG.isConfigured) {
      try {
        const layout = await SheetsAPI.getLayout(locId);
        slots = (layout && layout.slots) ? layout.slots : [];
        _layoutsCache[locId] = slots;
      } catch (err) {
        console.error('Erreur chargement slots :', err);
        slots = [];
      }
    }

    renderSlotPicker_(slots, currentSlotId);
    slotGroup.classList.remove('hidden');
  }

  /**
   * Affiche le plan de cave (slots positionnels) dans le sélecteur visuel.
   * Un clic sur un slot le sélectionne (re-clic = désélection).
   * @param {Array}  slots           - Liste de slots {id, x, y, size, label}
   * @param {string} [currentSlotId] - Slot pré-sélectionné
   */
  function renderSlotPicker_(slots, currentSlotId) {
    const picker = document.getElementById('f-slot-picker');
    const hidden = document.getElementById('f-slot');
    if (!picker || !hidden) return;

    picker.innerHTML = '';
    hidden.value = currentSlotId || '';

    if (!slots || slots.length === 0) {
      picker.innerHTML = '<p class="slot-picker__empty">Aucun emplacement défini dans le plan. Éditez le plan depuis « Gérer les localisations » pour en ajouter.</p>';
      return;
    }

    // Calculer les dimensions du canvas nécessaire
    let maxRight = 0, maxBottom = 0;
    slots.forEach(s => {
      const size = s.size || 60;
      maxRight   = Math.max(maxRight,  (s.x || 0) + size);
      maxBottom  = Math.max(maxBottom, (s.y || 0) + size);
    });

    const canvas = document.createElement('div');
    canvas.className      = 'slot-picker__canvas';
    canvas.style.width    = (maxRight  + 16) + 'px';
    canvas.style.height   = (maxBottom + 16) + 'px';
    canvas.style.minWidth = '100%';

    slots.forEach((s, idx) => {
      const el = document.createElement('div');
      el.className = 'slot-picker__slot';
      if (s.id === (currentSlotId || '')) el.classList.add('slot-picker__slot--selected');
      el.style.left   = (s.x || 0) + 'px';
      el.style.top    = (s.y || 0) + 'px';
      el.style.width  = (s.size || 60) + 'px';
      el.style.height = (s.size || 60) + 'px';
      el.dataset.slotId = s.id;
      el.textContent    = s.label || String(idx + 1);
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-pressed', String(s.id === (currentSlotId || '')));
      el.setAttribute('aria-label', `Emplacement ${escapeHtml_(s.label || String(idx + 1))}`);

      const toggle = () => {
        const alreadySelected = hidden.value === s.id;
        picker.querySelectorAll('.slot-picker__slot').forEach(n => {
          n.classList.remove('slot-picker__slot--selected');
          n.setAttribute('aria-pressed', 'false');
        });
        if (alreadySelected) {
          hidden.value = '';
        } else {
          el.classList.add('slot-picker__slot--selected');
          el.setAttribute('aria-pressed', 'true');
          hidden.value = s.id;
        }
      };

      el.addEventListener('click', toggle);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });

      canvas.appendChild(el);
    });

    picker.appendChild(canvas);
  }

  // ── Formulaire ────────────────────────────────────────────────────────────

  function showForm(bottle) {
    const modal    = document.getElementById('form-modal');
    const titleEl  = document.getElementById('form-modal-title');
    const submitEl = document.getElementById('form-submit-btn');

    resetForm_();
    populateLocalisationSelect_();

    if (bottle) {
      titleEl.textContent  = 'Modifier la bouteille';
      submitEl.textContent = 'Enregistrer les modifications';
      populateForm_(bottle);
      // Charger les slots pour la localisation de la bouteille, puis pré-sélectionner le slot
      if (bottle.localisation) {
        loadSlotsForLocalisation_(bottle.localisation, bottle.slot_id);
      }
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
    // Masquer le groupe slot et réinitialiser
    const slotGroup  = document.getElementById('f-slot-group');
    if (slotGroup) slotGroup.classList.add('hidden');
    const slotHidden = document.getElementById('f-slot');
    if (slotHidden) slotHidden.value = '';
    const slotPicker = document.getElementById('f-slot-picker');
    if (slotPicker) slotPicker.innerHTML = '';
    setStarPicker_(0);
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
    document.getElementById('f-localisation').value   = bottle.localisation || '';
    // f-slot sera défini après le chargement asynchrone des slots
    document.getElementById('f-date-achat').value     = bottle.date_achat || '';
    document.getElementById('f-prix-achat').value     = bottle.prix_achat || '';
    document.getElementById('f-valeur').value         = bottle.valeur_estimee || '';
    document.getElementById('f-notes').value          = bottle.notes_personnelles || '';
    setStarPicker_(bottle.note ? Number(bottle.note) : 0);
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
      localisation:       val('f-localisation'),
      slot_id:            val('f-slot'),
      date_achat:         val('f-date-achat'),
      prix_achat:         val('f-prix-achat') ? Number(val('f-prix-achat')) : '',
      valeur_estimee:     val('f-valeur')     ? Number(val('f-valeur'))     : '',
      note:               val('f-note')       ? Number(val('f-note'))       : '',
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
            ${bottle.note ? `<div class="detail-row"><span class="detail-row__label">Note</span><span class="detail-row__value">${starsHtml_(Number(bottle.note))}</span></div>` : ''}
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
      const loc       = b.localisation ? _localisations.find(l => l.id === b.localisation) : null;
      const locNom    = loc ? loc.nom : null;
      let slotLabel   = null;
      if (b.slot_id && loc && _layoutsCache[b.localisation]) {
        const slot = _layoutsCache[b.localisation].find(s => s.id === b.slot_id);
        if (slot) slotLabel = slot.label || null;
      }
      const rangCol   = (b.rang && b.colonne) ? `R${b.rang} C${b.colonne}` : null;
      const parts     = [locNom, slotLabel, rangCol].filter(Boolean);
      const emplacement = parts.join(' · ') || '–';
      const prix  = b.prix_achat ? `${Number(b.prix_achat).toFixed(2)} €` : '–';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span class="badge" style="background-color:${typeColor}">${escapeHtml_(typeLabel)}</span>
        </td>
        <td>${escapeHtml_(b.producteur || '–')}</td>
        <td>${escapeHtml_(b.cuvee || '–')}</td>
        <td>${escapeHtml_(String(b.millesime || '–'))}</td>
        <td>${b.note ? starsHtml_(Number(b.note)) : '–'}</td>
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
            aria-label="Archiver ${escapeHtml_(b.cuvee || '')}"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
            </svg>
            Archiver
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

  // ── Notation en étoiles ───────────────────────────────────────────────────

  function initStarPicker_() {
    const picker = document.getElementById('f-note-picker');
    if (!picker) return;
    picker.querySelectorAll('.star-picker__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.dataset.value);
        const current = Number(document.getElementById('f-note').value);
        setStarPicker_(current === val ? 0 : val);
      });
    });
    document.getElementById('f-note-clear').addEventListener('click', () => setStarPicker_(0));
  }

  function setStarPicker_(value) {
    const hidden = document.getElementById('f-note');
    if (!hidden) return;
    hidden.value = value || '';
    const picker = document.getElementById('f-note-picker');
    if (!picker) return;
    picker.querySelectorAll('.star-picker__btn').forEach(btn => {
      const active = Number(btn.dataset.value) <= value;
      btn.classList.toggle('star-picker__btn--active', active);
    });
  }

  function starsHtml_(note) {
    const n = Math.min(3, Math.max(1, note));
    let html = '<span class="stars" aria-label="' + n + ' étoile' + (n > 1 ? 's' : '') + ' sur 3">';
    for (let i = 1; i <= 3; i++) {
      html += '<span class="stars__star' + (i > n ? ' stars__star--empty' : '') + '" aria-hidden="true">★</span>';
    }
    html += '</span>';
    return html;
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
    closeArchiveModal,
    confirmArchive,
    handleUnarchive,
    closeArchivedDetail,
    lookupOFF,
    loadBottles,
    openLocalisationsManager,
    closeLocalisationsManager,
    openLayoutEditor,
  };
})();

// Auto-démarrage
document.addEventListener('DOMContentLoaded', AdminApp.init);
