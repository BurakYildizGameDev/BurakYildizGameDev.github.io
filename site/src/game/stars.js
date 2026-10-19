// 3D starfield behind the planets. Stars stream toward the camera; at the start they rush past
// ("warp") and settle down to a slow drift.

import * as THREE from 'three';
import { sparkTexture } from './textures.js';

const COUNT = 1600;
const NEAR = -13;
const FAR = -170;

export function createStars(scene, { warp = true } = {}) {
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

  let t = warp ? 0 : 10;

  return {
    update(dt) {
      t += dt;
      // Warp: 60× speed at the start, eased down to a drift over ~1.6 s.
      const speed = 1.5 + 90 * Math.pow(Math.max(0, 1 - t / 1.6), 2);
      for (let i = 0; i < COUNT; i++) {
        const k = i * 3 + 2;
        pos[k] += speed * dt;
        if (pos[k] > NEAR) spawn(i, pos[k] - (NEAR - FAR));
      }
      attr.needsUpdate = true;
    },
  };
}
