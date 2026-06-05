'use strict';

/**
 * Logique de la page publique (index.html).
 * Charge les bouteilles depuis Google Sheets (ou les données démo),
 * gère les filtres, la recherche et le modal de détail.
 */
const PublicApp = (() => {

  // ── État ──────────────────────────────────────────────────────────────────
  let allBottles      = [];
  let filteredBottles = [];

  // ── SVG bouteille (réutilisé comme placeholder) ───────────────────────────
  const BOTTLE_SVG = `<svg viewBox="0 0 40 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="44" height="110" aria-hidden="true">
    <rect x="17" y="0" width="6" height="4" rx="2"/>
    <rect x="15" y="4" width="10" height="6" rx="1"/>
    <path d="M14 10 C9 22 7 34 7 46 L7 87 Q7 97 20 97 Q33 97 33 87 L33 46 C33 34 31 22 26 10 Z"/>
    <rect x="9" y="52" width="22" height="24" rx="2" opacity="0.2"/>
  </svg>`;

  const BOTTLE_SVG_LG = `<svg viewBox="0 0 40 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="80" height="200" aria-hidden="true">
    <rect x="17" y="0" width="6" height="4" rx="2"/>
    <rect x="15" y="4" width="10" height="6" rx="1"/>
    <path d="M14 10 C9 22 7 34 7 46 L7 87 Q7 97 20 97 Q33 97 33 87 L33 46 C33 34 31 22 26 10 Z"/>
    <rect x="9" y="52" width="22" height="24" rx="2" opacity="0.2"/>
  </svg>`;

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
      } else {
        allBottles = SAMPLE_BOTTLES;
        document.getElementById('demo-banner').classList.remove('hidden');
      }

      filteredBottles = allBottles;

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
    const totalQty  = bottles.reduce((s, b) => s + (parseInt(b.quantite) || 0), 0);
    const typesSet  = new Set(bottles.filter(b => b.type).map(b => b.type));
    const regionsSet = new Set(bottles.filter(b => b.region).map(b => b.region));
    const valeur    = bottles.reduce((s, b) => {
      const qty = parseInt(b.quantite) || 0;
      const val = parseFloat(b.valeur_estimee) || parseFloat(b.prix_achat) || 0;
      return s + qty * val;
    }, 0);

    document.getElementById('stat-total').textContent   = totalQty;
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
    const totalQty = bottles.reduce((s, b) => s + (parseInt(b.quantite) || 0), 0);

    grid.innerHTML = '';
    countEl.textContent = `${bottles.length} référence(s), ${totalQty} bouteille(s)`;

    bottles.forEach(b => grid.appendChild(createCard_(b)));
  }

  function createCard_(bottle) {
    const typeLabel = TYPE_LABELS[bottle.type] || bottle.type || 'Autre';
    const typeColor = TYPE_COLORS[bottle.type] || 'var(--c-type-autre)';
    const qty       = parseInt(bottle.quantite) || 0;

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
        <span class="bottle-card__quantity${qty === 0 ? ' bottle-card__quantity--empty' : ''}"
              aria-label="${qty} bouteille${qty > 1 ? 's' : ''}">${qty}</span>
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
    const qty    = parseInt(bottle.quantite) || 0;
    const typeLabel = TYPE_LABELS[bottle.type] || bottle.type || 'Autre';
    const typeColor = TYPE_COLORS[bottle.type] || 'var(--c-type-autre)';

    const imgHtml = bottle.photo_url
      ? `<img src="${escapeAttr_(bottle.photo_url)}" alt="${escapeAttr_(bottle.cuvee || '')}">`
      : `<div class="modal__image-placeholder">${BOTTLE_SVG_LG}</div>`;

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
          </div>

          <div class="modal__location" aria-label="Emplacement et quantité">
            <div>
              <div style="font-size:var(--text-xs);color:var(--c-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Emplacement</div>
              <div style="font-size:var(--text-sm);font-weight:500">
                ${(bottle.rang && bottle.colonne)
                  ? `Rang ${escapeHtml(String(bottle.rang))}, Colonne ${escapeHtml(String(bottle.colonne))}`
                  : '–'}
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:var(--text-2xl);font-weight:700;color:var(--c-gold);font-family:var(--font-display)">${qty}</div>
              <div style="font-size:var(--text-xs);color:var(--c-text-muted)">bouteille${qty > 1 ? 's' : ''}</div>
            </div>
          </div>

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
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function debounce_(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ── API publique ──────────────────────────────────────────────────────────
  return { init, closeModal };
})();

// Auto-démarrage
document.addEventListener('DOMContentLoaded', PublicApp.init);
