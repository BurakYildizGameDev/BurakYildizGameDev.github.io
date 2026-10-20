// The moving backdrop: a 3D starfield streaming toward the camera, speed lines rushing past at the
// edges of the view and slowly turning nebula clouds far behind, so it always feels like flying.
// At the start everything rushes past ("warp") and settles to cruising speed.

import * as THREE from 'three';
import { sparkTexture, glowTexture } from './textures.js';

const COUNT = 1600;
const NEAR = -13;
const FAR = -170;
const CRUISE = 7; // star speed in world units per second

const LINES = 140;
const LINE_SPEED = 38;
const LINE_NEAR = 10;
const LINE_FAR = -70;

const rand = (a, b) => a + Math.random() * (b - a);

export function createStars(scene, { warp = true } = {}) {
  // ---- stars ----
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const tints = [
    [1, 1, 1],
    [0.7, 0.85, 1],
    [1, 0.75, 0.9],
    [0.75, 1, 1],
  ];
  const spawn = (i, z) => {
    pos[i * 3] = (Math.random() - 0.5) * 220;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 140;
    pos[i * 3 + 2] = z;
  };
  for (let i = 0; i < COUNT; i++) {
    spawn(i, FAR + Math.random() * (NEAR - FAR));
    const t = tints[i % tints.length];
    const b = 0.35 + Math.random() * 0.65;
    col[i * 3] = t[0] * b;
    col[i * 3 + 1] = t[1] * b;
    col[i * 3 + 2] = t[2] * b;
  }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.55, map: sparkTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  points.frustumCulled = false;
  scene.add(points);

  // ---- speed lines: streaks flying past around the edges, never across the middle ----
  const lPos = new Float32Array(LINES * 6);
  const lCol = new Float32Array(LINES * 6);
  const lLen = new Float32Array(LINES);
  const spawnLine = (i, z) => {
    let x;
    let y;
    do {
      x = rand(-34, 34);
      y = rand(-20, 20);
    } while (Math.abs(x) < 9 && Math.abs(y) < 6);
    lLen[i] = rand(2.5, 6);
    const k = i * 6;
    lPos[k] = lPos[k + 3] = x;
    lPos[k + 1] = lPos[k + 4] = y;
    lPos[k + 2] = z;
    lPos[k + 5] = z - lLen[i];
    const b = rand(0.25, 0.6);
    const c = Math.random() < 0.5 ? [0.55, 0.95, 1] : [1, 0.55, 0.85];
    // bright head, dark tail: with additive blending the streak fades out behind
    lCol[k] = c[0] * b;
    lCol[k + 1] = c[1] * b;
    lCol[k + 2] = c[2] * b;
    lCol[k + 3] = lCol[k + 4] = lCol[k + 5] = 0;
  };
  for (let i = 0; i < LINES; i++) spawnLine(i, rand(LINE_FAR, LINE_NEAR));
  const lGeo = new THREE.BufferGeometry();
  const lAttr = new THREE.BufferAttribute(lPos, 3).setUsage(THREE.DynamicDrawUsage);
  const lColAttr = new THREE.BufferAttribute(lCol, 3).setUsage(THREE.DynamicDrawUsage);
  lGeo.setAttribute('position', lAttr);
  lGeo.setAttribute('color', lColAttr);
  const lines = new THREE.LineSegments(
    lGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  lines.frustumCulled = false;
  scene.add(lines);

  // ---- nebula clouds, far back, slowly turning and drifting ----
  const nebulae = [
    [0x6c3cff, -60, 25, 0.16],
    [0x00b8d4, 70, -10, 0.12],
    [0xff3d81, 10, -40, 0.1],
    [0x3b82f6, -90, -30, 0.1],
  ].map(([color, x, y, opacity], i) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    s.position.set(x, y, -165);
    s.scale.setScalar(150 + i * 20);
    scene.add(s);
    return { s, x, y, phase: i * 1.7, spin: (i % 2 ? -1 : 1) * 0.02 };
  });

  let t = warp ? 0 : 10;

  return {
    update(dt) {
      t += dt;
      // Warp at the start, easing down to cruising speed over ~1.6 s.
      const boost = 1 + 12 * Math.pow(Math.max(0, 1 - t / 1.6), 2);
      const speed = CRUISE * boost;
      for (let i = 0; i < COUNT; i++) {
        const k = i * 3 + 2;
        pos[k] += speed * dt;
        if (pos[k] > NEAR) spawn(i, pos[k] - (NEAR - FAR));
      }
      attr.needsUpdate = true;

      const lineSpeed = LINE_SPEED * boost;
      const stretch = Math.min(4, boost);
      for (let i = 0; i < LINES; i++) {
        const k = i * 6;
        lPos[k + 2] += lineSpeed * dt;
        lPos[k + 5] = lPos[k + 2] - lLen[i] * stretch;
        if (lPos[k + 5] > LINE_NEAR) spawnLine(i, LINE_FAR + rand(0, 10));
      }
      lAttr.needsUpdate = true;
      lColAttr.needsUpdate = true;

      for (const n of nebulae) {
        n.s.material.rotation += n.spin * dt;
        n.s.position.x = n.x + Math.sin(t * 0.05 + n.phase) * 12;
        n.s.position.y = n.y + Math.cos(t * 0.04 + n.phase) * 8;
      }
    },
  };
}
