// Project planets in 3D: they drift through a volume in front of the camera, bounce off its edges
// and each other, take three hits (each burns a glowing crack where the shot landed) and explode
// on the last one. Only a handful are in play at once; when one is destroyed the next project
// not yet discovered takes its place, so playing on works through every project. Once all are
// discovered they come back dimmed and pop with a single hit.

import * as THREE from 'three';
import { planetTexture, createCrackLayer, glowTexture } from './textures.js';

const Z_NEAR = -1;
const HITS = 3;
const ACTIVE = 16; // planets in play at once (fewer on phones)
const ACTIVE_PHONE = 10;

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const DISCOVERED_TINT = new THREE.Color(0x8b91b0);
const TEXTURE_BUDGET = 6; // ms per frame for painting planet surfaces

export function createPlanets(scene, projects, { discovered, camZ, fov }) {
  // Surfaces are painted a few per frame instead of all at start-up, which would block the page
  // for a moment on slow phones. Until then a planet shows its plain colour.
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  blank.needsUpdate = true;
  // The crack layer is only created on a planet's first hit; until then it doesn't glow at all.
  const noGlow = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  noGlow.needsUpdate = true;
  const sphere = new THREE.SphereGeometry(1, 48, 32);
  const ringGeo = new THREE.RingGeometry(1.45, 2.15, 96);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const view = { w: 1, h: 1, aspect: 1, top: 0, bottom: 0 };
  let zFar = -22; // pushed further back on narrow screens, so the planets have room to spread out
  let placed = false;
  let shown = 0; // activation counter: the discovered planet away longest comes back first

  const list = projects.map((project, index) => {
    const material = new THREE.MeshStandardMaterial({
      map: blank,
      emissiveMap: noGlow,
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
      roughness: 0.82,
      metalness: 0.06,
    });
    const mesh = new THREE.Mesh(sphere, material);
    const tilt = new THREE.Group();
    tilt.rotation.z = (Math.random() - 0.5) * 0.7;
    tilt.add(mesh);

    const flash = new THREE.Mesh(
      sphere,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    flash.scale.setScalar(1.015);
    flash.visible = false;

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: project.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.scale.setScalar(3.6);

    const group = new THREE.Group();
    group.add(glow, tilt, flash);
    const ringed = index % 3 === 1;
    if (ringed) {
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(project.color).lerp(new THREE.Color(0xffffff), 0.35),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        }),
      );
      ring.rotation.set(-Math.PI / 2 + 0.42, 0.25, 0);
      group.add(ring);
    }
    group.visible = false;
    scene.add(group);

    const p = {
      project,
      index,
      color: project.color,
      group,
      ringed,
      mesh,
      flash,
      glow,
      material,
      crack: null,
      r: 1,
      vel: new THREE.Vector3(),
      cruise: 0.4 + Math.random() * 0.45,
      spin: (0.12 + Math.random() * 0.22) * (Math.random() < 0.5 ? -1 : 1),
      spinKick: 0,
      punch: 0,
      flashAmt: 0,
      discovered: discovered.has(project.id),
      hp: 0,
      maxHp: 0,
      state: 'idle', // idle (not in play) | spawning | alive | dead
      appear: 0,
      delay: 0,
      lastShown: 0,
      placed: false,
      textured: false,
      labelW: 140,
      labelH: 24,
    };
    mesh.userData.planet = p;
    setDiscovered(p, p.discovered);
    return p;
  });
  const meshes = list.map((p) => p.mesh);
  const unpainted = [...list];
  const outOfPlay = (p) => p.state === 'idle' || p.state === 'dead';

  function tint(p) {
    p.material.color.set(p.textured ? 0xffffff : p.color);
    if (p.discovered) p.material.color.multiply(DISCOVERED_TINT);
  }

  function paint() {
    const start = performance.now();
    while (performance.now() - start < TEXTURE_BUDGET) {
      const i = unpainted.findIndex((p) => p.state !== 'idle');
      if (i < 0) return;
      const [p] = unpainted.splice(i, 1);
      p.material.map = planetTexture(p.project, p.index);
      p.textured = true;
      tint(p);
    }
  }

  function setDiscovered(p, on) {
    p.discovered = on;
    p.maxHp = on ? 1 : HITS;
    p.hp = p.maxHp;
    tint(p);
  }

  /** Label size relative to its CSS size: smaller with distance. */
  function labelScale(z) {
    return clamp(17 / (camZ - z), 0.55, 1.05) * (view.w < 600 ? 0.78 : 1);
  }

  // Allowed centre positions at depth z, so the planet (with its ring) and its label stay on
  // screen, below the intro text at the top and above the ship at the bottom. The margin leaves
  // room for the camera leaning toward the crosshair.
  function bounds(p, z) {
    const halfH = tanHalf * (camZ - z);
    const halfW = halfH * view.aspect;
    const k = (2 * halfH) / view.h; // world units per CSS pixel at this depth
    const s = labelScale(z);
    const margin = 26 * k;
    const xMax = Math.max(0, halfW - margin - Math.max(p.r * (p.ringed ? 2.2 : 1.15), ((p.labelW * s) / 2 + 6) * k));
    const yMax = halfH - view.top * k - p.r * 1.1;
    const yMin = -halfH + view.bottom * k + p.r + (p.labelH * s + 12) * k;
    return yMin <= yMax ? { xMax, yMin, yMax } : { xMax, yMin: (yMin + yMax) / 2, yMax: (yMin + yMax) / 2 };
  }

  // Screen-space position in units of the half screen height, used to spread planets out visually.
  function screenOf(x, y, z, r) {
    const hh = tanHalf * (camZ - z);
    return [x / hh, y / hh, r / hh];
  }

  function place(p) {
    let best = null;
    let bestGap = -Infinity;
    for (let i = 0; i < 60; i++) {
      const z = zFar + Math.random() * (Z_NEAR - zFar);
      const b = bounds(p, z);
      const x = (Math.random() * 2 - 1) * b.xMax;
      const y = b.yMin + Math.random() * (b.yMax - b.yMin);
      const [sx, sy, sr] = screenOf(x, y, z, p.r);
      let gap = Infinity;
      for (const o of list) {
        if (o === p || !o.placed || outOfPlay(o)) continue;
        const op = o.group.position;
        const [ox, oy, or] = screenOf(op.x, op.y, op.z, o.r);
        gap = Math.min(gap, Math.hypot(sx - ox, sy - oy) - (sr + or) * 1.5);
      }
      if (gap > bestGap) {
        bestGap = gap;
        best = [x, y, z];
      }
      if (gap > 0.35) break;
    }
    p.group.position.set(...best);
    p.placed = true;
  }

  function randomVelocity(p) {
    const a = Math.random() * Math.PI * 2;
    p.vel.set(Math.cos(a), Math.sin(a) * 0.7, (Math.random() - 0.5) * 0.5).normalize().multiplyScalar(p.cruise);
  }

  function activate(p, delay) {
    p.state = 'spawning';
    p.appear = 0;
    p.delay = delay;
    p.lastShown = ++shown;
    place(p);
    randomVelocity(p);
  }

  // Projects not discovered yet come first, in list order; then the discovered planet that has
  // been out of play the longest.
  function nextInLine(fallback) {
    const waiting = list.filter((q) => q.state === 'idle');
    return waiting.find((q) => !q.discovered) ?? waiting.sort((a, b) => a.lastShown - b.lastShown)[0] ?? fallback;
  }

  function layout(w, h, top, bottom) {
    Object.assign(view, { w, h, aspect: w / h, top, bottom });
    zFar = view.aspect < 0.8 ? -32 : -22;
    const size = clamp(view.aspect / 1.1, 0.6, 1);
    for (const p of list) p.r = (p.project.featured ? 1.3 : 1.05) * size;
    if (!placed) {
      const count = Math.min(list.length, w < 600 ? ACTIVE_PHONE : ACTIVE);
      const first = [...list.filter((p) => !p.discovered), ...list.filter((p) => p.discovered)].slice(0, count);
      first.forEach((p, i) => activate(p, 0.25 + i * 0.06));
      placed = true;
    } else {
      for (const p of list) {
        if (outOfPlay(p)) continue;
        const pos = p.group.position;
        const b = bounds(p, pos.z);
        pos.x = clamp(pos.x, -b.xMax, b.xMax);
        pos.y = clamp(pos.y, b.yMin, b.yMax);
      }
    }
  }

  function update(dt) {
    if (unpainted.length) paint();
    for (const p of list) {
      if (outOfPlay(p)) continue;
      if (p.delay > 0) {
        p.delay -= dt;
        p.group.visible = false;
        continue;
      }
      p.group.visible = true;
      if (p.appear < 1) {
        p.appear = Math.min(1, p.appear + dt * 1.7);
        if (p.appear >= 1 && p.state === 'spawning') p.state = 'alive';
      }

      const pos = p.group.position;
      pos.addScaledVector(p.vel, dt);
      // A hit knocks the planet back; it then slows down to its cruising speed again.
      const speed = p.vel.length();
      if (speed > p.cruise) p.vel.multiplyScalar(Math.max(p.cruise / speed, 1 - dt * 1.6));

      if (pos.z > Z_NEAR) (pos.z = Z_NEAR), (p.vel.z = -Math.abs(p.vel.z));
      if (pos.z < zFar) (pos.z = zFar), (p.vel.z = Math.abs(p.vel.z));
      const b = bounds(p, pos.z);
      if (pos.x > b.xMax) (pos.x = b.xMax), (p.vel.x = -Math.abs(p.vel.x));
      if (pos.x < -b.xMax) (pos.x = -b.xMax), (p.vel.x = Math.abs(p.vel.x));
      if (pos.y > b.yMax) (pos.y = b.yMax), (p.vel.y = -Math.abs(p.vel.y));
      if (pos.y < b.yMin) (pos.y = b.yMin), (p.vel.y = Math.abs(p.vel.y));

      p.spinKick *= Math.max(0, 1 - dt * 2.2);
      p.mesh.rotation.y += (p.spin + p.spinKick) * dt;
      p.punch = Math.max(0, p.punch - dt * 5);
      p.flashAmt = Math.max(0, p.flashAmt - dt * 6);

      p.group.scale.setScalar(p.r * Math.max(0.001, easeOutBack(p.appear)) * (1 - p.punch * 0.12));
      p.flash.visible = p.flashAmt > 0.01;
      p.flash.material.opacity = p.flashAmt * 0.85;
      p.glow.material.opacity = (p.discovered ? 0.28 : 0.6) + p.flashAmt * 0.9;
      p.material.emissiveIntensity = 1.5 + p.flashAmt * 3;
    }

    // Keep planets apart: push overlapping pairs away and exchange velocity along the contact normal.
    const n = new THREE.Vector3();
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (outOfPlay(a) || a.delay > 0) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (outOfPlay(b) || b.delay > 0) continue;
        n.subVectors(b.group.position, a.group.position);
        const d = n.length();
        const min = a.r + b.r + 0.6;
        if (d >= min || d === 0) continue;
        n.divideScalar(d);
        const push = (min - d) / 2;
        a.group.position.addScaledVector(n, -push);
        b.group.position.addScaledVector(n, push);
        const va = a.vel.dot(n);
        const vb = b.vel.dot(n);
        if (va - vb > 0) {
          a.vel.addScaledVector(n, vb - va);
          b.vel.addScaledVector(n, va - vb);
        }
      }
    }
  }

  /** First planet along the ray that can be hit: { planet, point, uv } or null. */
  function raycast(raycaster) {
    for (const h of raycaster.intersectObjects(meshes, false)) {
      const p = h.object.userData.planet;
      if (outOfPlay(p) || p.delay > 0 || p.appear < 0.6) continue;
      return { planet: p, point: h.point, uv: h.uv };
    }
    return null;
  }

  /** Applies a hit coming from direction dir; returns 'crack' or 'destroy'. */
  function hit(p, uv, dir) {
    p.hp -= 1;
    p.flashAmt = 1;
    p.punch = 1;
    p.vel.addScaledVector(dir, 1.8);
    p.spinKick += (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2);
    if (p.hp > 0) {
      if (uv) {
        if (!p.crack) {
          p.crack = createCrackLayer();
          p.material.emissiveMap = p.crack.texture;
        }
        p.crack.crack(uv.x, uv.y, 1 + (p.maxHp - p.hp - 1) * 0.4);
      }
      return 'crack';
    }
    p.state = 'dead';
    p.group.visible = false;
    return 'destroy';
  }

  /** After a destroyed planet's card closes: the next planet in line takes its place. */
  function respawn(id) {
    const p = list.find((p) => p.project.id === id);
    if (!p || p.state !== 'dead') return;
    setDiscovered(p, true);
    p.crack?.clear();
    p.state = 'idle';
    p.placed = false;
    activate(nextInLine(p), 0.5);
  }

  function reset() {
    for (const p of list) {
      setDiscovered(p, false);
      p.crack?.clear();
      if (p.state === 'dead') activate(p, 0.3);
    }
  }

  return { list, layout, update, raycast, hit, respawn, reset, labelScale };
}
