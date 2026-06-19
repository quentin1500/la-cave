'use strict';

/**
 * Logique de la page publique (index.html).
 * Charge les bouteilles depuis Google Sheets (ou les données démo),
 * gère les filtres, la recherche et le modal de détail.
 */
const PublicApp = (() => {

  // ── État ──────────────────────────────────────────────────────────────────
  let allBottles      = [];
  let filteredBottles = [];  let _localisations  = [];
  let _layoutsCache   = {}; // { [localisationId]: slots[] }
  // ── SVG bouteille (réutilisé comme placeholder) ───────────────────────────
  const BOTTLE_SVG    = bottleSvg(44, 110);
  const BOTTLE_SVG_LG = bottleSvg(80, 200);

  // ── Initialisation ────────────────────────────────────────────────────────

  async function init() {
    document.getElementById('footer-year').textContent = new Date().getFullYear();

    // Fermeture du modal via le fond
    document.getElementById('modal-backdrop').addEventListener('click', closeModal);
    // Fermeture via Echap
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // Filtres et recherche
    ['filter-type', 'filter-region', 'filter-pays', 'filter-millesime'].forEach(id => {
      document.getElementById(id).addEventListener('change', applyFilters);
    });
    document.getElementById('search').addEventListener('input', debounce_(applyFilters, 280));

    await loadBottles();
  }

  async function loadBottles() {
    showState_('loading');

    try {
      if (CONFIG.isConfigured) {
        allBottles = await SheetsAPI.getAllBottles();
        // Ne pas afficher les bouteilles archivées dans l'interface publique
        allBottles = allBottles.filter(b => !isArchived_(b));
      } else {
        allBottles = SAMPLE_BOTTLES;
        document.getElementById('demo-banner').classList.remove('hidden');
      }

      filteredBottles = allBottles;

      // Charger les localisations pour enrichir l'affichage (nom, plan)
      if (CONFIG.isConfigured) {
        try { _localisations = await SheetsAPI.getLocalisations(); } catch (_) { _localisations = []; }
      }

      renderStats_(allBottles);
      populateFilters_(allBottles);
      renderGrid_(filteredBottles);

      showState_(filteredBottles.length === 0 ? 'empty' : 'grid');

    } catch (error) {
      console.error('Erreur de chargement de la cave :', error);
      document.getElementById('error-message').textContent =
        error.message || 'Impossible de charger les données.';
      showState_('error');
    }
    // Le #cave-layout global est désactivé (multi-localisation : chaque bouteille a son propre plan dans le modal)
    document.getElementById('cave-layout').classList.add('hidden');
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
    const search    = document.getElementById('search').value.toLowerCase().trim();

    filteredBottles = allBottles.filter(b => {
      if (type      && b.type      !== type)                 return false;
      if (region    && b.region    !== region)               return false;
      if (pays      && b.pays      !== pays)                 return false;
      if (millesime && String(b.millesime) !== millesime)    return false;
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
      </div>
    `;

    const open = () => showModal_(bottle);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

    return card;
  }

  // ── Modal de détail ───────────────────────────────────────────────────────

  function showModal_(bottle) {
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

    // Mise à l'échelle pour tenir dans le modal (max 380px)
    const MAX_W = 380;
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
  return { init, closeModal };
})();

// Auto-démarrage
document.addEventListener('DOMContentLoaded', PublicApp.init);
