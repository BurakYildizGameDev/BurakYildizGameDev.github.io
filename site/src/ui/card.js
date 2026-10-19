// The project card. The list view, the /projects/ page (prerendered at build time) and the game
// all go through these functions, so a project looks the same everywhere.
// Everything above openCard() is plain string templating and also runs in Node during the build.

import { iconSvg } from './icons.js';

const LINKS = [
  // key in project.links, label, icon, primary?
  ['play', 'Play', 'play', true],
  ['live', 'Open app', 'external', true],
  ['store', 'Asset Store', 'store', true],
  ['googleplay', 'Google Play', 'play', true],
  ['docs', 'Product page', 'book', false],
  ['itch', 'itch.io', 'gamepad', false],
  ['download', 'Download APK', 'download', false],
  ['model', 'Model on Hugging Face', 'cube', false],
  ['github', 'GitHub', 'github', false],
];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const isExternal = (url) => /^https?:\/\//.test(url);

function linkList(p) {
  return LINKS.filter(([key]) => p.links?.[key]).map(([key, label, icon, primary]) => ({
    key,
    label,
    icon,
    primary,
    url: p.links[key],
  }));
}

function anchor(link, className) {
  const ext = isExternal(link.url) ? ' target="_blank" rel="noopener"' : '';
  return `<a class="${className}" href="${esc(link.url)}"${ext}>${iconSvg(link.icon)}<span>${esc(link.label)}</span></a>`;
}

function coverHtml(p, className) {
  const inner = p.image
    ? `<img src="/${esc(p.image)}" alt="" loading="lazy" decoding="async">`
    : `<span class="cover-orb">${iconSvg(p.icon, 'cover-icon')}</span>`;
  return `<div class="${className}" aria-hidden="true">${inner}</div>`;
}

const chips = (items) => `<ul class="chips">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

export function tileHtml(p) {
  const links = linkList(p);
  return `<li class="tile" data-id="${esc(p.id)}" data-cats="${esc(p.categories.join(' '))}" style="--accent:${esc(p.color)}">
  ${coverHtml(p, 'tile-cover')}
  <div class="tile-body">
    <h3 class="tile-title"><button type="button" class="tile-open" data-id="${esc(p.id)}">${esc(p.title)}</button></h3>
    ${p.status ? `<p class="tile-status">${esc(p.status)}</p>` : ''}
    <p class="tile-tagline">${esc(p.tagline)}</p>
    ${chips(p.tech.slice(0, 4))}
    ${links.length ? `<div class="tile-links">${links.map((l) => anchor(l, 'tile-link')).join('')}</div>` : ''}
  </div>
  <span class="tile-badge">${iconSvg('check')}<span>Discovered</span></span>
</li>`;
}

export function detailHtml(p) {
  const links = linkList(p);
  return `<article class="card" style="--accent:${esc(p.color)}">
  ${coverHtml(p, 'card-cover')}
  <div class="card-body">
    <p class="card-kicker">${esc(p.categories.join(' · '))}${p.year ? ` · ${p.year}` : ''}</p>
    <h2 class="card-title" id="card-title" tabindex="-1">${esc(p.title)}</h2>
    <p class="card-tagline">${esc(p.tagline)}</p>
    ${p.status ? `<p class="card-status">${esc(p.status)}</p>` : ''}
    <p class="card-desc">${esc(p.description)}</p>
    ${
      p.highlights?.length
        ? `<h3 class="card-sub">Highlights</h3>
    <ul class="card-highlights">${p.highlights.map((h) => `<li>${iconSvg('check')}<span>${esc(h)}</span></li>`).join('')}</ul>`
        : ''
    }
    <h3 class="card-sub">Built with</h3>
    ${chips(p.tech)}
    ${
      links.length
        ? `<div class="card-links">${links.map((l) => anchor(l, l.primary ? 'btn btn-primary' : 'btn btn-ghost')).join('')}</div>`
        : ''
    }
  </div>
</article>`;
}

// ---- modal (browser only) ----

let dialog = null;
let closeHandler = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.setAttribute('aria-labelledby', 'card-title');
  dialog.innerHTML = `<div class="modal-inner"><div class="modal-content"></div>
    <button type="button" class="modal-close" data-close aria-label="Close">${iconSvg('close')}</button></div>`;
  // A click on the dialog element itself is a click on the backdrop around the card.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('modal-open');
    const fn = closeHandler;
    closeHandler = null;
    fn?.();
  });
  document.body.append(dialog);
  return dialog;
}

/** Opens the card for a project; onClose runs once the card is closed (ESC, ✕ or backdrop). */
export function openCard(project, { onClose } = {}) {
  const d = ensureDialog();
  if (d.open) d.close();
  const returnTo = document.activeElement;
  d.querySelector('.modal-content').innerHTML = detailHtml(project);
  closeHandler = () => {
    if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    onClose?.();
  };
  document.documentElement.classList.add('modal-open');
  d.showModal();
  d.scrollTop = 0;
  // Focus the heading, not a button: a Space still held from the game must not press anything.
  d.querySelector('#card-title').focus({ preventScroll: true });
}
