// List view: the same cards in a plain grid, with category filters and arrow-key navigation.
// listHtml() runs at build time (the grid is in the HTML even without JavaScript);
// enhanceList() adds the behaviour in the browser.

import { tileHtml, openCard } from './card.js';

export const FILTERS = ['All', 'Live', 'Unity', 'Game', 'Mobile', 'Web', 'AI'];
// "Other projects" shows this many cards until the visitor asks for the rest, so the strongest work
// isn't buried. Without JavaScript every card is shown.
const OTHERS_SHOWN = 6;

export function listHtml(projects) {
  const featured = projects.filter((p) => p.featured);
  // Newest first, so the cards shown before "Show more" are the most recent work.
  const others = projects.filter((p) => !p.featured).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const group = (key, title, items, more = '') => `<section class="tile-group" data-group="${key}" aria-labelledby="group-${key}">
  <h2 class="group-title" id="group-${key}">${title}</h2>
  <ul class="tiles" role="list">${items.map(tileHtml).join('\n')}</ul>${more}
</section>`;
  const more = `\n  <button type="button" class="btn btn-ghost tiles-more js-only" aria-expanded="false" hidden>Show more projects</button>`;
  return `<div class="filters" role="group" aria-label="Filter projects by category">
  ${FILTERS.map(
    (f) => `<button type="button" class="filter" data-filter="${f}" aria-pressed="${f === 'All'}">${f}</button>`,
  ).join('\n  ')}
</div>
${group('featured', 'Featured', featured)}
${group('other', 'Other projects', others, more)}
<p class="tiles-empty" hidden>Nothing in this category yet.</p>`;
}

export function enhanceList(root, projects, { discovered = new Set() } = {}) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const tiles = [...root.querySelectorAll('.tile')];
  const moreBtn = root.querySelector('.tiles-more');
  let filter = 'All';
  let expanded = false;

  function applyFilter(next = filter) {
    filter = next;
    root.querySelectorAll('.filter').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    let others = 0;
    for (const tile of tiles) {
      const match = filter === 'All' || tile.dataset.cats.split(' ').includes(filter);
      const extra = match && !expanded && !!tile.closest('[data-group="other"]') && ++others > OTHERS_SHOWN;
      tile.hidden = !match || extra;
    }
    if (moreBtn) {
      const rest = others - OTHERS_SHOWN;
      moreBtn.hidden = expanded || rest <= 0;
      moreBtn.textContent = `Show ${rest} more project${rest === 1 ? '' : 's'}`;
    }
    let any = false;
    root.querySelectorAll('.tile-group').forEach((g) => {
      const visible = g.querySelector('.tile:not([hidden])');
      g.hidden = !visible;
      any ||= !!visible;
    });
    root.querySelector('.tiles-empty').hidden = any;
  }

  function refreshDiscovered() {
    for (const tile of tiles) tile.classList.toggle('is-discovered', discovered.has(tile.dataset.id));
  }

  function open(id) {
    const p = byId.get(id);
    if (p) openCard(p);
  }

  root.addEventListener('click', (e) => {
    const filterBtn = e.target.closest('.filter');
    if (filterBtn) return applyFilter(filterBtn.dataset.filter);
    if (e.target.closest('.tiles-more')) {
      // Focus the first card that appears, so keyboard users land where the list grew.
      const firstNew = tiles.find((t) => t.hidden && t.closest('[data-group="other"]'));
      expanded = true;
      moreBtn.setAttribute('aria-expanded', 'true');
      applyFilter();
      firstNew?.querySelector('.tile-open').focus();
      return;
    }
    const btn = e.target.closest('.tile-open');
    if (btn) open(btn.dataset.id);
  });

  // Arrow keys move between cards like in a grid; Home/End jump to the first/last visible card.
  root.addEventListener('keydown', (e) => {
    const current = e.target.closest?.('.tile-open');
    if (!current) return;
    const buttons = [...root.querySelectorAll('.tile:not([hidden]) .tile-open')].filter((b) => !b.closest('[hidden]'));
    const i = buttons.indexOf(current);
    let next = null;
    if (e.key === 'ArrowRight') next = buttons[i + 1];
    else if (e.key === 'ArrowLeft') next = buttons[i - 1];
    else if (e.key === 'Home') next = buttons[0];
    else if (e.key === 'End') next = buttons[buttons.length - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') next = verticalNeighbour(buttons, current, e.key === 'ArrowDown');
    else return;
    e.preventDefault();
    next?.focus();
    next?.closest('.tile').scrollIntoView({ block: 'nearest' });
  });

  // Cards tilt in 3D toward the mouse (mouse only, and not when motion is reduced).
  if (matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
    root.addEventListener('pointermove', (e) => {
      const tile = e.pointerType === 'mouse' && e.target.closest('.tile');
      if (!tile) return;
      const r = tile.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      tile.classList.add('is-tilting');
      tile.style.setProperty('--rx', `${((0.5 - y) * 9).toFixed(2)}deg`);
      tile.style.setProperty('--ry', `${((x - 0.5) * 11).toFixed(2)}deg`);
      tile.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      tile.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
    root.addEventListener('pointerout', (e) => {
      const tile = e.target.closest('.tile');
      if (!tile || tile.contains(e.relatedTarget)) return;
      tile.classList.remove('is-tilting');
      for (const v of ['--rx', '--ry', '--mx', '--my']) tile.style.removeProperty(v);
    });
  }

  refreshDiscovered();
  applyFilter();

  // /projects/?filter=Unity starts with that category selected.
  const startFilter = new URLSearchParams(location.search).get('filter');
  if (FILTERS.includes(startFilter)) applyFilter(startFilter);

  // Deep link: /projects/#neon-shorts-engine opens that card.
  const hashId = decodeURIComponent(location.hash.slice(1));
  if (byId.has(hashId)) open(hashId);

  return { refreshDiscovered, applyFilter };
}

function verticalNeighbour(buttons, current, down) {
  const rect = (b) => b.closest('.tile').getBoundingClientRect();
  const c = rect(current);
  const cx = c.left + c.width / 2;
  let best = null;
  let bestScore = Infinity;
  for (const b of buttons) {
    const r = rect(b);
    const dy = down ? r.top - c.top : c.top - r.top;
    if (dy <= 4) continue; // same row or wrong direction
    const score = dy * 4 + Math.abs(r.left + r.width / 2 - cx);
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}
