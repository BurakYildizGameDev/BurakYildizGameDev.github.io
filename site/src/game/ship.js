// The gunship. It rides along with the camera at the bottom of the view, turns to face the
// crosshair and fires from two cannons in turn, with a muzzle flash, a light pop and recoil.
// It never sits still: it bobs on its thrust, banks into turns and its engine burns and flickers.

import * as THREE from 'three';
import { flashTexture, glowTexture } from './textures.js';

const DEPTH = 6; // distance in front of the camera

export function createShip(camera) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  camera.add(root);

  const hull = new THREE.MeshStandardMaterial({
    color: 0x1c2756,
    metalness: 0.75,
    roughness: 0.3,
    emissive: 0x041a30,
    side: THREE.DoubleSide,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9 });
  const add = (geo, mat = hull) => {
    const m = new THREE.Mesh(geo, mat);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat));
    body.add(m);
    return m;
  };

  // The nose points along +Z, which is the axis lookAt() turns toward the target.
  const fuselage = new THREE.ConeGeometry(0.2, 1.3, 8);
  fuselage.rotateX(Math.PI / 2);
  add(fuselage);

  const wing = new THREE.Shape();
  wing.moveTo(0.08, 0.3);
  wing.lineTo(0.82, -0.32);
  wing.lineTo(0.8, -0.44);
  wing.lineTo(0.08, -0.46);
  wing.closePath();
  const wingR = new THREE.ExtrudeGeometry(wing, { depth: 0.05, bevelEnabled: false });
  wingR.rotateX(Math.PI / 2);
  wingR.translate(0, 0.025, 0);
  const wingL = wingR.clone();
  wingL.scale(-1, 1, 1);
  add(wingR);
  add(wingL);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 16, 10),
    new THREE.MeshStandardMaterial({ color: 0xff3d81, emissive: 0xff3d81, emissiveIntensity: 0.9, roughness: 0.2 }),
  );
  cockpit.scale.set(1, 0.75, 1.9);
  cockpit.position.set(0, 0.11, 0.08);
  body.add(cockpit);

  const barrel = new THREE.CylinderGeometry(0.035, 0.05, 0.62, 8);
  barrel.rotateX(Math.PI / 2);
  const muzzles = [-0.52, 0.52].map((x) => {
    add(barrel).position.set(x, -0.02, 0.02);
    const node = new THREE.Object3D();
    node.position.set(x, -0.02, 0.38);
    body.add(node);
    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flashTexture(), color: 0xc8fbff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    flash.visible = false;
    node.add(flash);
    return { node, flash, t: 0 };
  });

  const engine = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff3d81, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  engine.position.set(0, 0, -0.75);
  body.add(engine);
  const plume = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0x00e5ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  plume.position.set(0, 0, -1.05);
  body.add(plume);
  const nozzle = new THREE.Object3D();
  nozzle.position.set(0, 0, -0.7);
  body.add(nozzle);

  const light = new THREE.PointLight(0xaef6ff, 0, 10, 2);
  light.position.set(0, 0, 0.6);
  body.add(light);

  let baseY = 0;
  let halfW = 1;
  let enter = 0;
  let recoil = 0;
  let next = 0;
  let t = 0;
  let bank = 0;
  let prevX = 0;
  const out = new THREE.Vector3();

  return {
    get ready() {
      return enter > 0.7;
    },
    layout() {
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * DEPTH;
      halfW = halfH * camera.aspect;
      baseY = -halfH * 0.74;
      root.position.set(root.position.x, baseY, -DEPTH);
      root.scale.setScalar(Math.min(1, Math.max(0.55, camera.aspect)) * 0.85);
    },
    /** target: world point under the crosshair; aimX: crosshair x in NDC (-1…1). */
    update(dt, target, aimX) {
      t += dt;
      enter = Math.min(1, enter + dt * 1.4);
      const e = 1 - Math.pow(1 - enter, 3);
      root.position.x += (aimX * halfW * 0.3 - root.position.x) * Math.min(1, dt * 8);
      // Floating on its thrust: a slow bob plus a little engine shudder.
      root.position.y = baseY - (1 - e) * 2.5 + Math.sin(t * 2.1) * 0.07 + (Math.random() - 0.5) * 0.008;
      const vx = dt > 0 ? (root.position.x - prevX) / dt : 0;
      prevX = root.position.x;
      // Bank into the turn, like an aircraft rolling into it.
      bank += (Math.max(-0.7, Math.min(0.7, -vx * 0.35)) - bank) * Math.min(1, dt * 6);

      body.position.set(0, 0, 0);
      body.lookAt(target);
      body.rotateZ(bank + Math.sin(t * 1.3) * 0.05);
      body.rotateX(Math.sin(t * 1.7) * 0.03);
      body.translateZ(-recoil * 0.35);
      recoil = Math.max(0, recoil - dt * 7);

      for (const m of muzzles) {
        m.t -= dt;
        m.flash.visible = m.t > 0;
        if (m.flash.visible) {
          m.flash.scale.setScalar(0.55 + Math.random() * 0.35);
          m.flash.material.rotation = Math.random() * Math.PI;
        }
      }
      light.intensity = Math.max(0, light.intensity - dt * 160);
      engine.scale.setScalar(0.6 + Math.sin(t * 40) * 0.06 + Math.random() * 0.1);
      plume.scale.set(0.45 + Math.random() * 0.1, 0.45 + Math.random() * 0.1, 1);
      plume.material.opacity = 0.55 + Math.random() * 0.3;
    },
    /** Where the exhaust leaves the ship, and which way the ship is pointing. */
    exhaust(pos, dir) {
      nozzle.getWorldPosition(pos);
      body.getWorldDirection(dir);
    },
    /** Fires the next cannon; returns the muzzle's world position for the tracer. */
    fire() {
      const m = muzzles[next];
      next = 1 - next;
      m.t = 0.05;
      recoil = 1;
      light.intensity = 9;
      return m.node.getWorldPosition(out).clone();
    },
  };
}
