// HTML overlay on top of the canvas: a name label under every planet (crisp text at any size),
// a lock-on frame around the planet under the crosshair, and the crosshair with its hit marker.

import * as THREE from 'three';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const el = (cls) => {
  const d = document.createElement('div');
  d.className = cls;
  return d;
};

export function createHud(stage, planets) {
  const layer = el('g-labels');
  layer.setAttribute('aria-hidden', 'true');
  for (const p of planets.list) {
    const label = el('g-label');
    label.style.setProperty('--c', p.color);
    label.innerHTML = `<span class="g-label-name">${p.project.released ? '<b class="g-label-live">Live</b>' : ''}${esc(p.project.title)}</span><span class="g-label-hp"></span>`;
    layer.append(label);
    Object.assign(p, { label, hpEl: label.querySelector('.g-label-hp'), labelShown: true, hpShown: -1 });
  }

  const reticle = el('g-reticle');
  reticle.setAttribute('aria-hidden', 'true');
  reticle.innerHTML = '<i></i><i></i><i></i><i></i><span class="g-reticle-tag"></span>';
  const tag = reticle.querySelector('.g-reticle-tag');

  const cross = el('g-crosshair');
  cross.setAttribute('aria-hidden', 'true');
  cross.innerHTML = '<i></i><i></i><i></i><i></i><b></b><span class="g-hit"></span>';
  const hitEl = cross.querySelector('.g-hit');

  stage.append(layer, reticle, cross);

  const v = new THREE.Vector3();
  let lockedShown = null;
  const order = [];
  const taken = [];

  // With 25 planets labels can pile up: the nearest (and the locked) label wins, a label mostly
  // covered by one in front fades out until they drift apart.
  function declutter(locked) {
    order.length = 0;
    for (const p of planets.list) if (p.labelShown && p.rect) order.push(p);
    order.sort((a, b) => (a === locked ? -1 : b === locked ? 1 : a.rect.d - b.rect.d));
    taken.length = 0;
    for (const p of order) {
      const r = p.rect;
      let covered = false;
      for (const t of taken) {
        const ix = Math.min(r.x + r.w, t.x + t.w) - Math.max(r.x, t.x);
        const iy = Math.min(r.y + r.h, t.y + t.h) - Math.max(r.y, t.y);
        if (ix > 0 && iy > 0 && ix * iy > 0.3 * Math.min(r.w * r.h, t.w * t.h)) {
          covered = true;
          break;
        }
      }
      if (!covered) taken.push(r);
      const opacity = covered ? 0.12 : r.opacity;
      if (opacity !== p.opacityShown) {
        p.label.style.opacity = opacity;
        p.opacityShown = opacity;
      }
    }
  }

  function pips(p) {
    let html = '';
    for (let i = 0; i < p.maxHp; i++) html += `<i${i < p.hp ? '' : ' class="off"'}></i>`;
    return html;
  }

  return {
    /** Reads label sizes so the planets can keep their labels on screen. */
    measure() {
      for (const p of planets.list) {
        p.labelW = p.label.offsetWidth || p.labelW;
        p.labelH = p.label.offsetHeight || p.labelH;
      }
    },

    update(camera, w, h, locked, aim, spread, showCross) {
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      for (const p of planets.list) {
        const visible = p.state !== 'dead' && p.state !== 'idle' && p.delay <= 0;
        if (visible !== p.labelShown) {
          p.label.style.visibility = visible ? '' : 'hidden';
          p.labelShown = visible;
        }
        if (!visible) continue;
        const pos = p.group.position;
        v.copy(pos).project(camera);
        const sx = (v.x * 0.5 + 0.5) * w;
        const sy = (-v.y * 0.5 + 0.5) * h;
        const dist = camera.position.z - pos.z;
        const rpx = (p.group.scale.x / (tanHalf * dist)) * (h / 2);
        const s = planets.labelScale(pos.z);
        p.screen = { sx, sy, rpx };
        p.label.style.transform = `translate(${sx.toFixed(1)}px,${(sy + rpx + 6).toFixed(1)}px) translateX(-50%) scale(${s.toFixed(3)})`;
        const depthFade = 0.6 + 0.4 * Math.min(1, Math.max(0, (30 - dist) / 14));
        const lw = p.labelW * s;
        const ly = sy + rpx + 6;
        p.rect = { x: sx - lw / 2, y: ly, w: lw, h: p.labelH * s, d: dist, opacity: +(Math.min(1, p.appear * 1.4) * depthFade).toFixed(2) };
        p.label.style.zIndex = String(1000 - Math.round(dist * 10));
        if (p.hpShown !== p.hp + p.maxHp * 10) {
          p.hpShown = p.hp + p.maxHp * 10;
          p.hpEl.innerHTML = pips(p);
          p.label.classList.toggle('is-discovered', p.discovered);
        }
      }

      declutter(locked);

      if (locked !== lockedShown) {
        lockedShown?.label.classList.remove('is-locked');
        locked?.label.classList.add('is-locked');
        reticle.classList.toggle('is-on', !!locked);
        if (locked) {
          reticle.style.setProperty('--c', locked.color);
          tag.textContent = locked.discovered ? 'Discovered · 1 hit' : `${locked.project.categories.join(' · ')}`;
        }
        lockedShown = locked;
      }
      if (locked?.screen) {
        const size = locked.screen.rpx * 2.5 + 18;
        reticle.style.transform = `translate(${locked.screen.sx.toFixed(1)}px,${locked.screen.sy.toFixed(1)}px)`;
        reticle.style.setProperty('--size', `${size.toFixed(1)}px`);
      }

      cross.style.transform = `translate(${aim.x.toFixed(1)}px,${aim.y.toFixed(1)}px)`;
      cross.style.setProperty('--spread', `${(5 + spread * 12).toFixed(1)}px`);
      cross.classList.toggle('is-on', showCross);
      cross.classList.toggle('is-locked', !!locked);
    },

    hitMarker(kill) {
      hitEl.classList.remove('is-hit', 'is-kill');
      void hitEl.offsetWidth; // restart the animation
      hitEl.classList.add(kill ? 'is-kill' : 'is-hit');
    },

    dispose() {
      layer.remove();
      reticle.remove();
      cross.remove();
    },
  };
}
