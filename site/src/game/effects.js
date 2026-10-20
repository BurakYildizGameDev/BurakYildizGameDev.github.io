// Shot and explosion effects, all pooled so firing never allocates: tracers, sparks, rock debris,
// flash / glow / shockwave sprites and a light that pops on impacts and explosions.

import * as THREE from 'three';
import { sparkTexture, flashTexture, glowTexture, ringTexture } from './textures.js';

const SPARKS = 1200;
const DEBRIS = 280;
const SPRITES = 40;
const TRACERS = 16;
const TRACER_LIFE = 0.09;
const BOLT_SPEED = 260; // world units per second

const UP = new THREE.Vector3(0, 1, 0);
const WHITE = new THREE.Color(0xffffff);
const HOT = new THREE.Color(1, 0.72, 0.38);
const EXHAUST_A = new THREE.Color(1, 0.3, 0.6);
const EXHAUST_B = new THREE.Color(0.3, 0.9, 1);
const rand = (a, b) => a + Math.random() * (b - a);

function randomUnit(out) {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), r * Math.sin(a), z);
}

export function createEffects(scene) {
  const tmp = new THREE.Vector3();
  const tmpC = new THREE.Color();

  // ---- sparks (one Points cloud, additive, faded by darkening the colour) ----
  const sPos = new Float32Array(SPARKS * 3);
  const sCol = new Float32Array(SPARKS * 3);
  const sVel = new Float32Array(SPARKS * 3);
  const sBase = new Float32Array(SPARKS * 3);
  const sLife = new Float32Array(SPARKS);
  const sMax = new Float32Array(SPARKS).fill(1);
  let sNext = 0;
  const sGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(sCol, 3).setUsage(THREE.DynamicDrawUsage);
  sGeo.setAttribute('position', posAttr);
  sGeo.setAttribute('color', colAttr);
  const sparks = new THREE.Points(
    sGeo,
    new THREE.PointsMaterial({ size: 0.2, map: sparkTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  sparks.frustumCulled = false;
  scene.add(sparks);

  function spark(pos, vel, color, life) {
    const i = sNext;
    sNext = (sNext + 1) % SPARKS;
    const k = i * 3;
    sPos[k] = pos.x;
    sPos[k + 1] = pos.y;
    sPos[k + 2] = pos.z;
    sVel[k] = vel.x;
    sVel[k + 1] = vel.y;
    sVel[k + 2] = vel.z;
    sBase[k] = color.r;
    sBase[k + 1] = color.g;
    sBase[k + 2] = color.b;
    sLife[i] = sMax[i] = life;
  }

  // ---- debris: chunks of rock, one instanced mesh ----
  const debris = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.15, flatShading: true }),
    DEBRIS,
  );
  debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debris.frustumCulled = false;
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const chunks = Array.from({ length: DEBRIS }, (_, i) => {
    debris.setMatrixAt(i, hidden);
    debris.setColorAt(i, WHITE);
    return {
      alive: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      axis: new THREE.Vector3(),
      spin: 0,
      size: 0,
      life: 0,
      max: 1,
      color: new THREE.Color(),
    };
  });
  debris.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(debris);
  let dNext = 0;
  const dummy = new THREE.Object3D();
  const stepQ = new THREE.Quaternion();

  function chunk(pos, vel, size, color, life) {
    const c = chunks[dNext];
    dNext = (dNext + 1) % DEBRIS;
    c.alive = true;
    c.pos.copy(pos);
    c.vel.copy(vel);
    randomUnit(c.axis);
    c.q.setFromAxisAngle(randomUnit(tmp), Math.random() * Math.PI);
    c.spin = rand(3, 12);
    c.size = size;
    c.life = c.max = life;
    c.color.copy(color).multiplyScalar(rand(0.55, 1));
  }

  // ---- sprites: flashes, glow puffs and shockwave rings ----
  const sprites = Array.from({ length: SPRITES }, () => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    s.visible = false;
    scene.add(s);
    return { s, life: 0, max: 1, from: 1, to: 1, alpha: 1 };
  });
  let spNext = 0;

  function sprite(pos, map, color, from, to, life, alpha = 1) {
    const e = sprites[spNext];
    spNext = (spNext + 1) % SPRITES;
    e.s.material.map = map;
    e.s.material.color.set(color);
    e.s.material.rotation = Math.random() * Math.PI * 2;
    e.s.position.copy(pos);
    e.s.visible = true;
    Object.assign(e, { life, max: life, from, to, alpha });
  }

  // ---- tracers: a thin beam that fades plus a bright bolt racing along it ----
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  beamGeo.translate(0, 0.5, 0); // base at the origin, so scale.y is the length
  const tracers = Array.from({ length: TRACERS }, () => {
    const beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ color: 0x8ff3ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const bolt = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ color: 0xf2feff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    for (const m of [beam, bolt]) {
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
    }
    return { beam, bolt, life: 0, from: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0, travel: 0 };
  });
  let tNext = 0;

  // ---- one light for impacts and explosions ----
  const light = new THREE.PointLight(0xffb070, 0, 40, 2);
  scene.add(light);
  let lightDecay = 1;
  function pop(pos, intensity, decay) {
    if (intensity < light.intensity) return;
    light.position.copy(pos);
    light.intensity = intensity;
    lightDecay = decay;
  }

  const queue = []; // delayed bursts for the finale
  let exhaustBudget = 0;

  return {
    tracer(from, to) {
      const t = tracers[tNext];
      tNext = (tNext + 1) % TRACERS;
      t.from.copy(from);
      t.dir.subVectors(to, from);
      t.len = t.dir.length();
      t.dir.divideScalar(t.len || 1);
      t.life = TRACER_LIFE;
      t.travel = 0;
      for (const m of [t.beam, t.bolt]) {
        m.quaternion.setFromUnitVectors(UP, t.dir);
        m.visible = true;
      }
      t.beam.position.copy(from);
      t.beam.scale.set(0.022, t.len, 0.022);
    },

    /** A bullet hitting rock: flash, dust, sparks thrown off the surface and a few chips. */
    impact(point, normal, color) {
      const c = new THREE.Color(color);
      sprite(point, flashTexture(), 0xffffff, 1.1, 0.3, 0.08);
      sprite(tmp.copy(normal).multiplyScalar(0.15).add(point), glowTexture(), c, 0.3, 1.8, 0.4, 0.85);
      const v = new THREE.Vector3();
      for (let i = 0; i < 34; i++) {
        v.copy(normal).add(randomUnit(tmp).multiplyScalar(0.95)).normalize().multiplyScalar(rand(4, 14));
        tmpC.copy(HOT).lerp(c, Math.random() * 0.6);
        spark(point, v, tmpC, rand(0.15, 0.5));
      }
      for (let i = 0; i < 8; i++) {
        v.copy(normal).multiplyScalar(rand(1.5, 4.5)).add(randomUnit(tmp).multiplyScalar(1.6));
        chunk(point, v, rand(0.04, 0.1), c, rand(0.6, 1.1));
      }
      pop(point, 60, 600);
    },

    /** The planet breaks apart: big flash, shockwave, fireball, a cloud of sparks and rock chunks. */
    explode(center, r, color) {
      const c = new THREE.Color(color);
      sprite(center, flashTexture(), 0xffffff, r * 2.5, r * 9, 0.22);
      sprite(center, glowTexture(), c, r * 2, r * 7.5, 0.75, 0.95);
      sprite(center, glowTexture(), HOT, r * 1.5, r * 4, 0.45, 0.9);
      sprite(center, ringTexture(), tmpC.copy(c).lerp(WHITE, 0.45), r * 1.5, r * 11, 0.6);
      sprite(center, ringTexture(), c, r, r * 7, 0.9, 0.6);
      const v = new THREE.Vector3();
      for (let i = 0; i < 220; i++) {
        randomUnit(v).multiplyScalar(rand(4, 22));
        tmpC.copy(Math.random() < 0.5 ? HOT : c).lerp(WHITE, Math.random() * 0.3);
        spark(center, v, tmpC, rand(0.3, 1.1));
      }
      const p = new THREE.Vector3();
      for (let i = 0; i < 60; i++) {
        randomUnit(v);
        p.copy(v).multiplyScalar(r * rand(0.2, 0.85)).add(center);
        v.multiplyScalar(rand(2.5, 9)).add(randomUnit(tmp).multiplyScalar(1.2));
        chunk(p, v, r * rand(0.06, 0.22), c, rand(1.1, 2.1));
      }
      pop(center, 900, 1600);
    },

    /** Engine exhaust: hot particles streaming out behind the ship. */
    exhaust(pos, dir, dt) {
      exhaustBudget += dt * 110;
      const v = new THREE.Vector3();
      while (exhaustBudget >= 1) {
        exhaustBudget -= 1;
        v.copy(dir).multiplyScalar(-rand(4, 8)).add(randomUnit(tmp).multiplyScalar(0.6));
        tmpC.copy(Math.random() < 0.6 ? EXHAUST_A : EXHAUST_B);
        spark(pos, v, tmpC, rand(0.18, 0.42));
      }
    },

    /** Fireworks for the finale. */
    celebrate(colors) {
      for (let i = 0; i < 14; i++) {
        queue.push({
          at: i * 0.16 + Math.random() * 0.1,
          pos: new THREE.Vector3(rand(-9, 9), rand(-1, 6), rand(-16, -6)),
          color: colors[i % colors.length],
        });
      }
    },

    update(dt) {
      // finale bursts
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i];
        q.at -= dt;
        if (q.at > 0) continue;
        queue.splice(i, 1);
        const c = new THREE.Color(q.color);
        sprite(q.pos, flashTexture(), 0xffffff, 1, 4, 0.2);
        sprite(q.pos, ringTexture(), c, 0.5, 7, 0.7);
        const v = new THREE.Vector3();
        for (let k = 0; k < 90; k++) spark(q.pos, randomUnit(v).multiplyScalar(rand(3, 9)), c, rand(0.7, 1.4));
      }

      // sparks
      const drag = Math.max(0, 1 - dt * 2.4);
      for (let i = 0; i < SPARKS; i++) {
        const k = i * 3;
        if (sLife[i] <= 0) {
          if (sCol[k] !== 0 || sCol[k + 1] !== 0 || sCol[k + 2] !== 0) sCol[k] = sCol[k + 1] = sCol[k + 2] = 0;
          continue;
        }
        sLife[i] -= dt;
        sVel[k] *= drag;
        sVel[k + 1] = sVel[k + 1] * drag - dt * 1.5;
        sVel[k + 2] *= drag;
        sPos[k] += sVel[k] * dt;
        sPos[k + 1] += sVel[k + 1] * dt;
        sPos[k + 2] += sVel[k + 2] * dt;
        const f = Math.pow(Math.max(0, sLife[i] / sMax[i]), 1.4) * 1.6;
        sCol[k] = sBase[k] * f;
        sCol[k + 1] = sBase[k + 1] * f;
        sCol[k + 2] = sBase[k + 2] * f;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // debris
      for (let i = 0; i < DEBRIS; i++) {
        const c = chunks[i];
        if (!c.alive) continue;
        c.life -= dt;
        if (c.life <= 0) {
          c.alive = false;
          debris.setMatrixAt(i, hidden);
          continue;
        }
        c.vel.multiplyScalar(Math.max(0, 1 - dt * 0.7));
        c.pos.addScaledVector(c.vel, dt);
        c.q.multiply(stepQ.setFromAxisAngle(c.axis, c.spin * dt));
        dummy.position.copy(c.pos);
        dummy.quaternion.copy(c.q);
        dummy.scale.setScalar(c.size * Math.min(1, c.life / 0.45));
        dummy.updateMatrix();
        debris.setMatrixAt(i, dummy.matrix);
        // Fresh chunks glow hot, then cool to the planet's colour.
        const heat = Math.max(0, (c.life - c.max + 0.5) / 0.5);
        debris.setColorAt(i, tmpC.copy(c.color).lerp(HOT, heat).multiplyScalar(1 + heat * 2));
      }
      debris.instanceMatrix.needsUpdate = true;
      debris.instanceColor.needsUpdate = true;

      // sprites
      for (const e of sprites) {
        if (e.life <= 0) continue;
        e.life -= dt;
        if (e.life <= 0) {
          e.s.visible = false;
          continue;
        }
        const t = 1 - e.life / e.max;
        const ease = 1 - Math.pow(1 - t, 3);
        e.s.scale.setScalar(e.from + (e.to - e.from) * ease);
        e.s.material.opacity = e.alpha * (1 - t);
      }

      // tracers
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) {
          t.beam.visible = t.bolt.visible = false;
          continue;
        }
        const k = t.life / TRACER_LIFE;
        t.beam.material.opacity = k * 0.8;
        t.beam.scale.x = t.beam.scale.z = 0.008 + 0.02 * k;
        t.travel = Math.min(t.len, t.travel + BOLT_SPEED * dt);
        const boltLen = Math.min(2.2, t.len);
        const start = Math.max(0, t.travel - boltLen);
        t.bolt.position.copy(t.from).addScaledVector(t.dir, start);
        t.bolt.scale.set(0.05, Math.max(0.01, t.travel - start), 0.05);
        t.bolt.material.opacity = Math.min(1, k * 1.5);
      }

      light.intensity = Math.max(0, light.intensity - dt * lightDecay);
    },
  };
}
