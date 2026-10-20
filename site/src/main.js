// Page start-up for every page: navigation, copy buttons, and on the home page the switch between
// the game and the list view. The game code is only downloaded when the game view is shown.

// Self-hosted Inter, so the site doesn't call out to a font service.
import '@fontsource-variable/inter';
import './styles.css';
import { projects } from './data/projects.js';
import { enhanceList } from './ui/list.js';
import { openCard } from './ui/card.js';
import { progress, save } from './storage.js';
import { sound } from './game/audio.js';

initNav();
initCopyButtons();

const page = document.body.dataset.page;
if (page === 'home') initHome();
if (page === 'projects') enhanceList(document.querySelector('#projects'), projects, { discovered: progress.discovered });

function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#site-nav');
  if (!toggle || !nav) return;
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  // A link to a section of the same page (/#about) doesn't reload it, so close the menu ourselves.
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Copied!';
      } catch {
        btn.textContent = 'Copy failed';
      }
      setTimeout(() => (btn.textContent = label), 1800);
    });
  });
}

function initHome() {
  const html = document.documentElement;
  const stage = document.querySelector('#stage');
  const canvas = document.querySelector('#game');
  const hud = stage.querySelector('.hud');
  const hint = stage.querySelector('.hud-hint');
  const countEl = document.querySelector('#discovered-count');
  const soundBtn = document.querySelector('#sound-toggle');
  const celebrateDialog = document.querySelector('#celebrate');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const projectIds = new Set(projects.map((p) => p.id));
  const webgl = supportsWebGL();
  if (!webgl) html.classList.add('no-webgl');
  const list = enhanceList(document.querySelector('#list-view'), projects, { discovered: progress.discovered });
  let game = null;
  let loading = null;

  const total = projectIds.size;
  document.querySelector('#discovered-total').textContent = total;
  document.querySelector('#celebrate-count').textContent = `${total} / ${total}`;
  const discoveredCount = () => [...progress.discovered].filter((id) => projectIds.has(id)).length;
  const updateCounter = () => (countEl.textContent = discoveredCount());
  updateCounter();

  if (matchMedia('(pointer: coarse)').matches) stage.classList.add('is-touch');

  soundBtn.addEventListener('click', () => {
    sound.setEnabled(!sound.enabled);
    soundBtn.setAttribute('aria-pressed', String(sound.enabled));
  });

  function onDestroy(project) {
    // A planet popped in the same burst as the last one: don't stack its card on the finale.
    if (celebrateDialog.open) return game.discovered(project.id);
    game.pause('card');
    progress.add(project.id);
    updateCounter();
    list.refreshDiscovered();
    openCard(project, {
      onClose() {
        game.discovered(project.id);
        game.resume('card');
        if (discoveredCount() === total && !progress.celebrated) {
          progress.celebrated = true;
          celebrate();
        }
      },
    });
  }

  function celebrate() {
    game.celebrate();
    game.setControls(false);
    celebrateDialog.showModal();
    celebrateDialog.querySelector('#celebrate-title').focus({ preventScroll: true });
  }

  celebrateDialog.addEventListener('close', () => game?.setControls(true));
  celebrateDialog.addEventListener('click', (e) => {
    if (e.target === celebrateDialog || e.target.closest('[data-close]')) celebrateDialog.close();
  });
  document.querySelector('#reset-progress').addEventListener('click', () => {
    progress.reset();
    game?.reset();
    updateCounter();
    list.refreshDiscovered();
    celebrateDialog.close();
  });

  function ensureGame() {
    loading ||= import('./game/index.js').then(({ createGame }) => {
      game = createGame({
        canvas,
        stage,
        projects,
        discovered: progress.discovered,
        reducedMotion,
        // Planets stay below the intro text and buttons at the top.
        getTopInset: () => hud.getBoundingClientRect().bottom - stage.getBoundingClientRect().top + 6,
        onDestroy,
        onFirstShot: () => hint.classList.add('is-faded'),
      });
      game.start();
      return game;
    });
    return loading;
  }

  async function setView(view, { persist = true, focus = false } = {}) {
    if (!webgl) view = 'list';
    html.dataset.view = view;
    if (persist) save('bydev.view', view);
    if (view === 'game') {
      try {
        (await ensureGame()).resume('view');
      } catch (err) {
        // WebGL failed after all (blocked, lost context…): the list has everything.
        console.warn('Game unavailable, showing the list view.', err);
        html.classList.add('no-webgl');
        return setView('list', { persist: false, focus });
      }
      if (focus) canvas.focus({ preventScroll: true });
    } else {
      game?.pause('view');
      list.refreshDiscovered();
      if (focus) document.querySelector('#list-title').focus({ preventScroll: true });
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view-toggle]');
    if (!btn) return;
    setView(btn.dataset.viewToggle, { focus: true });
    window.scrollTo({ top: 0 });
  });

  setView(html.dataset.view === 'game' ? 'game' : 'list', { persist: false });
}

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
