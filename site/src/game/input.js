// Mouse, touch and keyboard aiming. The crosshair follows the mouse or a finger; arrow keys / WASD
// move it from the keyboard. Click, a held button, a finger or Space fires.

const KEYS = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};

// Keys only steer while focus isn't on a control, so keyboard users can still use the page.
const focusIsFree = () => {
  const el = document.activeElement;
  return !el || el === document.body || el.tagName === 'CANVAS';
};

// `enabled` says whether the game is on screen and running; while it isn't, keys belong to the page
// (arrows and Space scroll it as usual).
export function createInput(canvas, { enabled = () => true } = {}) {
  const state = {
    x: null, // pointer position in CSS pixels inside the canvas
    y: null,
    fire: false, // trigger held
    shots: 0, // clicks/taps not yet turned into shots, so a quick click never gets lost
    touch: false,
    active: false, // pointer over the canvas or keyboard in use: show the crosshair
    usingKeys: false,
    left: false,
    right: false,
    up: false,
    down: false,
  };

  function onPointerMove(e) {
    const r = canvas.getBoundingClientRect();
    state.x = e.clientX - r.left;
    state.y = e.clientY - r.top;
    state.touch = e.pointerType !== 'mouse';
    state.active = true;
    state.usingKeys = false;
  }

  function onPointerDown(e) {
    if (e.button > 0) return;
    onPointerMove(e);
    state.fire = true;
    state.shots++;
    canvas.setPointerCapture?.(e.pointerId);
    if (state.touch) e.preventDefault();
  }

  function onPointerUp(e) {
    state.fire = false;
    if (e.pointerType !== 'mouse') state.active = false;
  }

  function onPointerLeave(e) {
    if (e.pointerType === 'mouse' && !state.fire) state.active = false;
  }

  function onKeyDown(e) {
    if (!enabled() || !focusIsFree() || e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEYS[e.code];
    if (dir) {
      state[dir] = true;
      state.usingKeys = true;
    } else if (e.code === 'Space') {
      if (!e.repeat) state.shots++;
      state.fire = true;
    } else return;
    state.active = true;
    e.preventDefault();
  }

  function onKeyUp(e) {
    const dir = KEYS[e.code];
    if (dir) state[dir] = false;
    else if (e.code === 'Space') state.fire = false;
  }

  function reset() {
    state.fire = state.left = state.right = state.up = state.down = false;
    state.shots = 0;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', reset);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  return {
    state,
    reset,
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', reset);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    },
  };
}
