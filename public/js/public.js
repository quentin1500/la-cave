'use strict';

/**
 * Logique de la page publique (index.html).
 * Charge les bouteilles depuis Google Sheets (ou les données démo),
 * gère les filtres, la recherche et le modal de détail.
 */
const PublicApp = (() => {

  // ── État ──────────────────────────────────────────────────────────────────
  let allBottles         = [];
  let filteredBottles    = [];
  let _localisations     = [];
  let _layoutsCache      = {}; // { [localisationId]: slots[] }
  let _lastLoadedAt      = null;
  let _hasSessionData    = false;
  let _initDone          = false;
  let _activeModal       = null;
  let _activeLocalisationId = '';
  // ── SVG bouteille (réutilisé comme placeholder) ───────────────────────────
  const BOTTLE_SVG    = bottleSvg(44, 110);
  const BOTTLE_SVG_LG = bottleSvg(80, 200);

  // ── Initialisation ────────────────────────────────────────────────────────

  async function init() {
    document.getElementById('footer-year').textContent = new Date().getFullYear();
    if (!_initDone) {
      // Fermeture du modal via le fond
      document.getElementById('modal-backdrop').addEventListener('click', closeModal);
      document.getElementById('localisations-backdrop').addEventListener('click', closeModal);
      // Fermeture via Echap
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

      const localisationsButton = document.getElementById('open-localisations');
      if (localisationsButton) {
        localisationsButton.addEventListener('click', openLocalisationsModal_);
      }

      // Filtres et recherche
      ['filter-type', 'filter-region', 'filter-pays', 'filter-millesime', 'filter-note'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
      });
      document.getElementById('search').addEventListener('input', debounce_(applyFilters, 280));

      // Bouton de bascule des filtres (mobile)
      const filterToggle = document.getElementById('filter-toggle');
      const filterPanel  = document.getElementById('filter-panel');
      if (filterToggle && filterPanel) {
        filterToggle.addEventListener('click', () => {
          const isOpen = filterPanel.classList.toggle('controls__filters--open');
          filterToggle.setAttribute('aria-expanded', String(isOpen));
        });
      }

      // État réseau de session
      window.addEventListener('online', onNetworkChange_);
      window.addEventListener('offline', onNetworkChange_);

      _initDone = true;
    }

    await loadBottles();
  }

  async function loadBottles() {
    showState_('loading');

    try {
      if (CONFIG.isConfigured) {
        const loaded = await fetchPublicDataSnapshot_();
        allBottles      = loaded.bottles;
        _localisations  = loaded.localisations;
        _layoutsCache   = loaded.layoutsCache;
        _lastLoadedAt   = new Date();
        _hasSessionData = true;
      } else {
        allBottles      = SAMPLE_BOTTLES.filter(b => !isArchived_(b));
        _localisations  = [];
        _layoutsCache   = {};
        _lastLoadedAt   = new Date();
        _hasSessionData = true;
        document.getElementById('demo-banner').classList.remove('hidden');
      }

      filteredBottles = allBottles;

      renderStats_(allBottles);
      populateFilters_(allBottles);
      renderGrid_(filteredBottles);
      updateSessionStatus_();

      showState_(filteredBottles.length === 0 ? 'empty' : 'grid');

    } catch (error) {
      console.error('Erreur de chargement de la cave :', error);
      if (_hasSessionData) {
        // Repli sur les données déjà chargées en mémoire tant que la page reste ouverte.
        filteredBottles = allBottles;
        renderStats_(allBottles);
        populateFilters_(allBottles);
        renderGrid_(filteredBottles);
        updateSessionStatus_();
        showState_(filteredBottles.length === 0 ? 'empty' : 'grid');
        return;
      }

      document.getElementById('error-message').textContent =
        navigator.onLine
          ? 'Impossible de charger les données publiques. Vérifiez la configuration de la source.'
          : 'Vous êtes hors réseau et aucune donnée n\'a été chargée dans cette session.';
      updateSessionStatus_();
      showState_('error');
    }
    // Le #cave-layout global est désactivé (multi-localisation : chaque bouteille a son propre plan dans le modal)
    document.getElementById('cave-layout').classList.add('hidden');
  }

  async function fetchPublicDataSnapshot_() {
    const [bottlesRaw, localisationsRaw] = await Promise.all([
      SheetsAPI.getAllBottles(),
      SheetsAPI.getLocalisations().catch(err => {
        console.warn('Localisations indisponibles :', err);
        return [];
      }),
    ]);

    const bottles = (Array.isArray(bottlesRaw) ? bottlesRaw : []).filter(b => !isArchived_(b));
    const localisations = Array.isArray(localisationsRaw) ? localisationsRaw : [];
    const layoutsCache = {};

    // Préchargement de tous les layouts pour garder les détails consultables hors réseau.
    await Promise.all(localisations.map(async loc => {
      if (!loc || !loc.id) return;
      try {
        const layout = await SheetsAPI.getLayout(loc.id);
        layoutsCache[loc.id] = (layout && Array.isArray(layout.slots)) ? layout.slots : [];
      } catch (err) {
        console.warn(`Layout indisponible pour la localisation ${loc.id} :`, err);
        layoutsCache[loc.id] = [];
      }
    }));

    return { bottles, localisations, layoutsCache };
  }

  function onNetworkChange_() {
    updateSessionStatus_();
  }

  function updateSessionStatus_() {
    const statusEl = document.getElementById('session-status');
    if (!statusEl) return;

    const hasData = _hasSessionData && allBottles.length >= 0;
    if (!hasData) {
      statusEl.className = 'session-status hidden';
      statusEl.textContent = '';
      return;
    }

    const timestamp = _lastLoadedAt
      ? `${formatDateTime_(_lastLoadedAt)}`
      : 'Données chargées dans cette session.';

    if (!navigator.onLine) {
      statusEl.className = 'session-status session-status--offline';
      statusEl.textContent = `Mode hors réseau [${timestamp}]`;
      return;
    }

    statusEl.className = 'session-status session-status--online hidden';
    statusEl.textContent = `Données publiques en mémoire de session`;
  }

  // ── Affichage des états ───────────────────────────────────────────────────

  function showState_(state) {
    document.getElementById('loading-state').classList.toggle('hidden', state !== 'loading');
    document.getElementById('error-state').classList.toggle('hidden', state !== 'error');
    document.getElementById('empty-state').classList.toggle('hidden', state !== 'empty');
    document.getElementById('bottle-grid').classList.toggle('hidden', state !== 'grid');
  }

  // ── Statistiques ──────────────────────────────────────────────────────────

  function renderStats_(bottles) {
    const typesSet  = new Set(bottles.filter(b => b.type).map(b => b.type));
    const regionsSet = new Set(bottles.filter(b => b.region).map(b => b.region));
    const valeur    = bottles.reduce((s, b) => {
      const val = parseFloat(b.valeur_estimee) || parseFloat(b.prix_achat) || 0;
      return s + val;
    }, 0);

    document.getElementById('stat-total').textContent   = bottles.length;
    document.getElementById('stat-types').textContent   = typesSet.size;
    document.getElementById('stat-regions').textContent = regionsSet.size;
    document.getElementById('stat-valeur').textContent  = valeur > 0 ? formatPrice_(valeur) : '–';
  }

  // ── Filtres ───────────────────────────────────────────────────────────────

  function populateFilters_(bottles) {
    const types     = [...new Set(bottles.filter(b => b.type).map(b => b.type))].sort();
    const regions   = [...new Set(bottles.filter(b => b.region).map(b => b.region))].sort();
    const pays      = [...new Set(bottles.filter(b => b.pays).map(b => b.pays))].sort();
    const millesimes = [...new Set(bottles.filter(b => b.millesime).map(b => String(b.millesime)))].sort().reverse();

    populateSelect_('filter-type',      types,     v => TYPE_LABELS[v] || v);
    populateSelect_('filter-region',    regions);
    populateSelect_('filter-pays',      pays);
    populateSelect_('filter-millesime', millesimes);
  }

  function populateSelect_(id, values, labelFn = v => v) {
    const select  = document.getElementById(id);
    const current = select.value;
    while (select.options.length > 1) select.remove(1);
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value       = v;
      opt.textContent = labelFn(v);
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  function applyFilters() {
    const type      = document.getElementById('filter-type').value;
    const region    = document.getElementById('filter-region').value;
    const pays      = document.getElementById('filter-pays').value;
    const millesime = document.getElementById('filter-millesime').value;
    const note      = document.getElementById('filter-note').value;
    const search    = document.getElementById('search').value.toLowerCase().trim();

    filteredBottles = allBottles.filter(b => {
      if (type      && b.type      !== type)                 return false;
      if (region    && b.region    !== region)               return false;
      if (pays      && b.pays      !== pays)                 return false;
      if (millesime && String(b.millesime) !== millesime)    return false;
      if (note      && String(b.note || '') !== note)        return false;
      if (search) {
        const hay = [b.producteur, b.cuvee, b.appellation, b.region, b.pays, b.cepages]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    renderGrid_(filteredBottles);
    showState_(filteredBottles.length === 0 ? 'empty' : 'grid');
  }

  // ── Grille ────────────────────────────────────────────────────────────────

  function renderGrid_(bottles) {
    const grid     = document.getElementById('bottle-grid');
    const countEl  = document.getElementById('result-count');
    grid.innerHTML = '';
    countEl.textContent = `${bottles.length} référence${bottles.length > 1 ? 's' : ''}`;

    bottles.forEach(b => grid.appendChild(createCard_(b)));
  }

  function getLocalisationsWithPlan_() {
    return _localisations.filter(loc => {
      const slots = _layoutsCache[loc.id];
      return loc && loc.id && Array.isArray(slots) && slots.length > 0;
    });
  }

  function openLocalisationsModal_() {
    const modal = document.getElementById('localisations-modal');
    const panel = document.getElementById('localisations-panel');
    const localisationsAvecPlan = getLocalisationsWithPlan_();

    if (!modal || !panel) return;

    if (localisationsAvecPlan.length === 0) {
      panel.innerHTML = `
        <button class="modal__close" onclick="PublicApp.closeModal()" aria-label="Fermer">✕</button>
        <div class="localisation-modal__empty">
          <h2 id="localisations-modal-title">Localisations</h2>
          <p>Aucun plan de localisation n'est disponible pour le moment.</p>
        </div>
      `;
    } else {
      if (!_activeLocalisationId || !localisationsAvecPlan.some(loc => loc.id === _activeLocalisationId)) {
        _activeLocalisationId = localisationsAvecPlan[0].id;
      }
      renderLocalisationsModal_();
    }

    _activeModal = 'localisations';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    panel.focus();
  }

  function renderLocalisationsModal_() {
    const panel = document.getElementById('localisations-panel');
    const localisationsAvecPlan = getLocalisationsWithPlan_();
    const activeLocalisation = localisationsAvecPlan.find(loc => loc.id === _activeLocalisationId) || localisationsAvecPlan[0];

    if (!panel || !activeLocalisation) return;

    _activeLocalisationId = activeLocalisation.id;

    panel.innerHTML = `
      <button class="modal__close" onclick="PublicApp.closeModal()" aria-label="Fermer">✕</button>
      <div class="localisation-modal__header">
        <div>
          <h2 id="localisations-modal-title">Localisations</h2>
          <p class="localisation-modal__intro">Choisissez une localisation puis cliquez sur un emplacement pour ouvrir la bouteille associee.</p>
        </div>
      </div>
      <div class="localisation-modal__content">
        <aside class="localisation-modal__sidebar" aria-label="Liste des localisations">
          ${localisationsAvecPlan.map(loc => `
            <button
              type="button"
              class="localisation-tab${loc.id === _activeLocalisationId ? ' localisation-tab--active' : ''}"
              data-localisation-id="${escapeAttr_(loc.id)}"
            >
              <span class="localisation-tab__name">${escapeHtml(loc.nom || 'Localisation')}</span>
              ${loc.description ? `<span class="localisation-tab__meta">${escapeHtml(loc.description)}</span>` : ''}
            </button>
          `).join('')}
        </aside>
        <section class="localisation-modal__main" aria-labelledby="localisation-plan-title">
          <div class="localisation-header localisation-header--modal">
            <h3 id="localisation-plan-title" class="localisation-title localisation-title--modal">${escapeHtml(activeLocalisation.nom || 'Localisation')}</h3>
            ${activeLocalisation.description ? `<p class="localisation-description localisation-description--modal">${escapeHtml(activeLocalisation.description)}</p>` : ''}
          </div>
          ${renderLocalisationSummary_(activeLocalisation.id)}
          <div class="plan-wrapper plan-wrapper--modal" id="localisation-plan-host"></div>
        </section>
      </div>
    `;

    const planHost = document.getElementById('localisation-plan-host');
    if (planHost) {
      planHost.appendChild(renderLocalisationPlan_(activeLocalisation));
    }

    panel.querySelectorAll('[data-localisation-id]').forEach(button => {
      button.addEventListener('click', () => {
        _activeLocalisationId = button.getAttribute('data-localisation-id') || '';
        renderLocalisationsModal_();
      });
    });
  }

  function renderLocalisationSummary_(localisationId) {
    const bottles = allBottles.filter(bottle => bottle.localisation === localisationId && bottle.slot_id);
    const count = bottles.length;
    const rated = bottles.filter(bottle => bottle.note).length;

    return `
      <div class="localisation-summary" aria-label="Résumé de la localisation">
        <div class="localisation-summary__item">
          <span class="localisation-summary__value">${count}</span>
          <span class="localisation-summary__label">Emplacements occupes</span>
        </div>
        <div class="localisation-summary__item">
          <span class="localisation-summary__value">${rated}</span>
          <span class="localisation-summary__label">Bouteilles notees</span>
        </div>
      </div>
    `;
  }

  function renderLocalisationPlan_(localisation) {
    const slots = _layoutsCache[localisation.id] || [];
    const wrapper = document.createElement('div');
    wrapper.className = 'plan-surface';

    if (!Array.isArray(slots) || slots.length === 0) {
      wrapper.innerHTML = '<p class="slot-picker__empty">Plan vide.</p>';
      return wrapper;
    }

    const slotsValides = slots
      .map(slot => {
        if (!slot) return null;
        const x = Number(slot.x);
        const y = Number(slot.y);
        const size = Number(slot.size);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) return null;
        return {
          id: slot.id,
          x,
          y,
          size,
        };
      })
      .filter(Boolean);

    if (slotsValides.length === 0) {
      wrapper.innerHTML = '<p class="slot-picker__empty">Plan invalide : aucun slot exploitable.</p>';
      return wrapper;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    slotsValides.forEach(slot => {
      minX = Math.min(minX, slot.x);
      minY = Math.min(minY, slot.y);
      maxX = Math.max(maxX, slot.x + slot.size);
      maxY = Math.max(maxY, slot.y + slot.size);
    });

    const padding = 20;
    const colors = getPlanColors_();
    const viewW = Math.max(80, maxX - minX + (padding * 2));
    const viewH = Math.max(80, maxY - minY + (padding * 2));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'plan-svg');
    svg.setAttribute('viewBox', `${minX - padding} ${minY - padding} ${viewW} ${viewH}`);
    svg.setAttribute('width', String(viewW));
    svg.setAttribute('height', String(viewH));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Plan de la localisation ${escapeHtml(localisation.nom || '')}`);

    slotsValides.forEach(slot => {

      const bottle = allBottles.find(b => b.localisation === localisation.id && b.slot_id === slot.id);
      if (!bottle) {
        const emptySlot = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        emptySlot.setAttribute('x', slot.x);
        emptySlot.setAttribute('y', slot.y);
        emptySlot.setAttribute('width', slot.size);
        emptySlot.setAttribute('height', slot.size);
        emptySlot.setAttribute('fill', colors.background);
        emptySlot.setAttribute('stroke', colors.border);
        emptySlot.setAttribute('stroke-width', '1');
        emptySlot.setAttribute('rx', '4');
        svg.appendChild(emptySlot);
        return;
      }

      renderBottleSlot_(svg, slot, bottle, colors);
    });

    wrapper.appendChild(svg);
    return wrapper;
  }

  function renderBottleSlot_(svg, slot, bottle, colors) {
    const typeColor = TYPE_COLORS[bottle.type] || 'var(--c-type-autre)';
    const fontSize = Math.max(8, Math.min(11, Math.floor(slot.size * 0.17)));
    const noteSize = Math.max(8, fontSize - 1);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', slot.x);
    rect.setAttribute('y', slot.y);
    rect.setAttribute('width', slot.size);
    rect.setAttribute('height', slot.size);
    rect.setAttribute('fill', typeColor);
    rect.setAttribute('stroke', colors.text);
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('rx', '4');
    rect.setAttribute('class', 'bottle-slot');
    rect.setAttribute('role', 'button');
    rect.setAttribute('tabindex', '0');
    rect.setAttribute('aria-label', `${escapeHtml(bottle.producteur || '')} ${escapeHtml(bottle.cuvee || '')}`);

    const open = () => showModal_(bottle);
    rect.addEventListener('click', open);
    rect.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    svg.appendChild(rect);

    const label = formatBottleSlotLabel_(bottle);
    const labelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelEl.setAttribute('x', slot.x + (slot.size / 2));
    labelEl.setAttribute('y', slot.y + (slot.size / 2) - Math.max(5, Math.floor(slot.size * 0.14)));
    labelEl.setAttribute('text-anchor', 'middle');
    labelEl.setAttribute('font-size', String(fontSize));
    labelEl.setAttribute('font-weight', '600');
    labelEl.setAttribute('fill', colors.text);
    labelEl.setAttribute('class', 'bottle-label');
    labelEl.setAttribute('pointer-events', 'none');
    labelEl.textContent = label;
    svg.appendChild(labelEl);

    if (bottle.note) {
      const noteEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      noteEl.setAttribute('x', slot.x + (slot.size / 2));
      noteEl.setAttribute('y', slot.y + (slot.size / 2) + Math.max(7, Math.floor(slot.size * 0.16)));
      noteEl.setAttribute('text-anchor', 'middle');
      noteEl.setAttribute('font-size', String(noteSize));
      noteEl.setAttribute('fill', colors.text);
      noteEl.setAttribute('class', 'bottle-note');
      noteEl.setAttribute('pointer-events', 'none');
      noteEl.textContent = starsText_(Number(bottle.note));
      svg.appendChild(noteEl);
    }
  }

  function getPlanColors_() {
    const root = getComputedStyle(document.documentElement);
    return {
      background: (root.getPropertyValue('--c-bg-raised') || '#221012').trim(),
      border: (root.getPropertyValue('--c-border') || '#3D2025').trim(),
      text: (root.getPropertyValue('--c-text') || '#F0EAE0').trim(),
    };
  }

  function formatBottleSlotLabel_(bottle) {
    const producer = bottle.producteur || '';
    const cuvee = bottle.cuvee || '';
    const label = producer && cuvee
      ? `${producer} · ${cuvee}`
      : producer || cuvee || 'Sans nom';

    if (label.length <= 18) return label;
    return `${label.slice(0, 15)}…`;
  }

  function createCard_(bottle) {
    const typeLabel = TYPE_LABELS[bottle.type] || bottle.type || 'Autre';
    const typeColor = TYPE_COLORS[bottle.type] || 'var(--c-type-autre)';

    const card = document.createElement('article');
    card.className = 'bottle-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${escapeHtml(bottle.producteur || '')} ${escapeHtml(bottle.cuvee || '')}`);

    const imgHtml = bottle.photo_url
      ? `<img src="${escapeAttr_(bottle.photo_url)}" alt="${escapeAttr_(bottle.cuvee || '')}" loading="lazy">`
      : `<div class="bottle-card__placeholder">${BOTTLE_SVG}</div>`;

    card.innerHTML = `
      <div class="bottle-card__image">
        ${imgHtml}
        <span class="bottle-card__type-badge" style="background-color:${typeColor}">${escapeHtml(typeLabel)}</span>
      </div>
      <div class="bottle-card__body">
        <p class="bottle-card__producer">${escapeHtml(bottle.producteur || '–')}</p>
        <h3 class="bottle-card__name">${escapeHtml(bottle.cuvee || 'Sans nom')}</h3>
        <div class="bottle-card__meta">
          ${bottle.millesime ? `<span class="bottle-card__millesime">${escapeHtml(String(bottle.millesime))}</span>` : ''}
          ${bottle.appellation ? `<span class="bottle-card__appellation">${escapeHtml(bottle.appellation)}</span>` : ''}
          ${bottle.region ? `<span class="bottle-card__region">${escapeHtml(bottle.region)}</span>` : ''}
        </div>
        ${bottle.note ? `<div class="bottle-card__stars">${starsHtml_(Number(bottle.note))}</div>` : ''}
      </div>
    `;

    const open = () => showModal_(bottle);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

    return card;
  }

  // ── Modal de détail ───────────────────────────────────────────────────────

  function showModal_(bottle) {
    const localisationsModal = document.getElementById('localisations-modal');
    const modal  = document.getElementById('bottle-modal');
    const panel  = document.getElementById('modal-panel');
    const typeLabel = TYPE_LABELS[bottle.type] || bottle.type || 'Autre';
    const typeColor = TYPE_COLORS[bottle.type] || 'var(--c-type-autre)';

    const imgHtml = bottle.photo_url
      ? `<img src="${escapeAttr_(bottle.photo_url)}" alt="${escapeAttr_(bottle.cuvee || '')}">`
      : `<div class="modal__image-placeholder">${BOTTLE_SVG_LG}</div>`;

    // Section emplacement
    const loc    = bottle.localisation ? _localisations.find(l => l.id === bottle.localisation) : null;
    const locNom = loc ? escapeHtml(loc.nom) : null;
    const hasSlotPlan = !!(bottle.localisation && bottle.slot_id);

    let locationHtml = '';
    if (locNom || bottle.rang || bottle.colonne || hasSlotPlan) {
      const locLine  = locNom ? `<div class="modal-location__loc">${locNom}</div>` : '';
      const rangLine = (bottle.rang && bottle.colonne)
        ? `<div class="modal-location__coords">Rang\u00a0${escapeHtml(String(bottle.rang))}\u00a0\u00b7 Colonne\u00a0${escapeHtml(String(bottle.colonne))}</div>`
        : '';
      const planHolder = hasSlotPlan
        ? `<div id="modal-slot-plan" class="modal-slot-plan">
             <div class="modal-slot-plan__loading">Chargement du plan\u2026</div>
           </div>`
        : '';
      locationHtml = `
        <div class="modal__location">
          <div class="modal-location__label">Emplacement</div>
          ${locLine}${rangLine}${planHolder}
        </div>`;
    }

    panel.innerHTML = `
      <button class="modal__close" onclick="PublicApp.closeModal()" aria-label="Fermer">✕</button>
      <div class="modal__content">
        <div class="modal__image" aria-hidden="true">${imgHtml}</div>
        <div class="modal__info">
          <div class="modal__header">
            <span class="badge" style="background-color:${typeColor}">${escapeHtml(typeLabel)}</span>
            <h2 id="modal-title">${escapeHtml(bottle.cuvee || 'Sans nom')}</h2>
            <p class="modal__producer">${escapeHtml(bottle.producteur || '')}</p>
          </div>

          <div class="modal__details">
            ${detailRow_('Millésime',      bottle.millesime)}
            ${detailRow_('Appellation',    bottle.appellation)}
            ${detailRow_('Région',         bottle.region)}
            ${detailRow_('Pays',           bottle.pays)}
            ${detailRow_('Cépage(s)',      bottle.cepages)}
            ${detailRow_('Volume',         bottle.volume   ? `${bottle.volume} ml`      : '')}
            ${detailRow_('Alcool',         bottle.degre_alcool ? `${bottle.degre_alcool}°` : '')}
            ${detailRow_('Prix d\'achat', bottle.prix_achat ? formatPrice_(Number(bottle.prix_achat)) : '')}
            ${bottle.note ? noteRow_(Number(bottle.note)) : ''}
          </div>

          ${locationHtml}

          ${bottle.notes_personnelles ? `
            <div class="modal__notes">
              <h4>Notes personnelles</h4>
              <p>${escapeHtml(bottle.notes_personnelles)}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Si l'utilisateur ouvre une bouteille depuis la pop-up localisations,
    // masquer cette pop-up pour afficher correctement le détail au premier plan.
    if (localisationsModal) {
      localisationsModal.classList.add('hidden');
    }

  _activeModal = 'bottle';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    panel.focus();

    if (hasSlotPlan) {
      loadAndRenderModalSlotPlan_(bottle.localisation, bottle.slot_id);
    }
  }

  async function loadAndRenderModalSlotPlan_(locId, slotId) {
    let slots;
    if (_layoutsCache[locId]) {
      slots = _layoutsCache[locId];
    } else {
      try {
        const resp = await SheetsAPI.getLayout(locId);
        // SheetsAPI.getLayout retourne le layout parsé : { slots: [...] } ou null
        slots = (resp && resp.slots) ? resp.slots : [];
        _layoutsCache[locId] = slots;
      } catch (err) {
        console.warn('Impossible de charger le layout :', err);
        slots = [];
      }
    }
    renderModalSlotPlan_(slots, slotId);
  }

  function renderModalSlotPlan_(slots, highlightedSlotId) {
    const container = document.getElementById('modal-slot-plan');
    if (!container) return;
    container.innerHTML = '';

    if (!slots || slots.length === 0) {
      container.classList.add('hidden');
      return;
    }

    // Calculer les dimensions du canvas
    let maxRight = 0, maxBottom = 0;
    slots.forEach(s => {
      const size = s.size || 60;
      maxRight   = Math.max(maxRight,  (s.x || 0) + size);
      maxBottom  = Math.max(maxBottom, (s.y || 0) + size);
    });

    // Mise à l'échelle pour s'adapter à la largeur réelle du conteneur
    const MAX_W = container.clientWidth || 380;
    const scale = (maxRight + 16) > MAX_W ? MAX_W / (maxRight + 16) : 1;

    const canvas = document.createElement('div');
    canvas.className      = 'modal-slot-plan__canvas';
    canvas.style.width    = Math.round((maxRight  + 16) * scale) + 'px';
    canvas.style.height   = Math.round((maxBottom + 16) * scale) + 'px';

    slots.forEach((s, idx) => {
      const el = document.createElement('div');
      el.className = 'modal-slot-plan__slot';
      if (s.id === highlightedSlotId) el.classList.add('modal-slot-plan__slot--highlighted');
      el.style.left   = Math.round((s.x || 0) * scale) + 'px';
      el.style.top    = Math.round((s.y || 0) * scale) + 'px';
      el.style.width  = Math.round((s.size || 60) * scale) + 'px';
      el.style.height = Math.round((s.size || 60) * scale) + 'px';
      el.style.fontSize = Math.round(11 * scale) + 'px';
      el.textContent  = s.label || String(idx + 1);
      el.setAttribute('aria-label',
        `${s.id === highlightedSlotId ? '(cette bouteille) ' : ''}Emplacement ${escapeHtml(s.label || String(idx + 1))}`);
      canvas.appendChild(el);
    });

    container.appendChild(canvas);
  }

  function isArchived_(b) {
    if (!b) return false;
    const v = b.archived;
    return v === true || v === 'true' || v === '1' || v === 1;
  }

  function closeModal() {
    document.getElementById('bottle-modal').classList.add('hidden');
    document.getElementById('localisations-modal').classList.add('hidden');
    _activeModal = null;
    document.body.style.overflow = '';
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  function detailRow_(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `
      <div class="detail-row">
        <span class="detail-row__label">${escapeHtml(label)}</span>
        <span class="detail-row__value">${escapeHtml(String(value))}</span>
      </div>`;
  }

  function starsHtml_(note) {
    const n = Math.min(3, Math.max(1, note));
    let html = '<span class="stars" aria-label="Note : ' + n + ' étoile' + (n > 1 ? 's' : '') + ' sur 3">';
    for (let i = 1; i <= 3; i++) {
      html += `<span class="stars__star${i > n ? ' stars__star--empty' : ''}" aria-hidden="true">★</span>`;
    }
    html += '</span>';
    return html;
  }

  function starsText_(note) {
    const n = Math.min(3, Math.max(1, note));
    return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
  }

  function noteRow_(note) {
    const n = Math.min(3, Math.max(1, note));
    return `
      <div class="detail-row">
        <span class="detail-row__label">Note</span>
        <span class="detail-row__value">${starsHtml_(n)}</span>
      </div>`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr_(str) {
    return escapeHtml(str);
  }

  function formatPrice_(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatDateTime_(date) {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function debounce_(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function renderLayout_(layoutResp) {
    const container = document.getElementById('cave-layout');
    if (!layoutResp || !layoutResp.layout) {
      container.classList.add('hidden');
      return;
    }
    const layout = layoutResp.layout || layoutResp; // accept both shapes
    container.innerHTML = '';
    container.classList.remove('hidden');
    container.style.position = 'relative';
    container.style.minHeight = '240px';
    (layout.slots || []).forEach(s => {
      const el = document.createElement('div');
      el.className = 'cave-slot';
      el.style.position = 'absolute';
      el.style.left = (s.x || 10) + 'px';
      el.style.top = (s.y || 10) + 'px';
      el.style.width = (s.size || 60) + 'px';
      el.style.height = (s.size || 60) + 'px';
      el.style.border = '1px solid var(--c-border)';
      el.style.background = '#fff';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '12px';
      el.textContent = s.label || '';
      container.appendChild(el);
      // Si une bouteille se rattache au slot (slot_id), l'afficher
      const bottle = allBottles.find(b => b.slot_id === s.id || b.slot === s.id);
      if (bottle) {
        const img = document.createElement('img');
        img.src = bottle.photo_url || '';
        img.alt = bottle.cuvee || '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        el.innerHTML = '';
        el.appendChild(img);
      }
    });
  }

  // ── API publique ──────────────────────────────────────────────────────────
  return { init, closeModal, starsHtml: starsHtml_, escapeAttr: escapeAttr_, formatPrice: formatPrice_, escapeHtml };
})();

// Auto-démarrage
document.addEventListener('DOMContentLoaded', PublicApp.init);
