// Wires the 3D game together: renderer, camera, lights, aiming and shooting, hit feedback.
// Shots are hitscan, like a gun: the bullet goes where the crosshair points, a tracer shows its
// path and the impact lands on the exact spot of the planet that was hit.
// The page (main.js) decides what happens when a planet is destroyed: it opens the card and
// tells the game to bring the planet back once the card is closed.

import * as THREE from 'three';
import { createLoop } from './loop.js';
import { createInput } from './input.js';
import { createShip } from './ship.js';
import { createPlanets } from './planets.js';
import { createEffects } from './effects.js';
import { createStars } from './stars.js';
import { createHud } from './hud.js';
import { sound } from './audio.js';

const CAM_Z = 12;
const FOV = 55;
const FIRE_INTERVAL = 0.11; // s between shots while the trigger is held
const OPEN_DELAY = 0.6; // s between the explosion and the card, so the blast can be seen
const SHIP_ZONE = 150; // px at the bottom kept free of planets
const KEY_AIM_SPEED = 700; // px/s
const IDLE_INPUT = { x: null, y: null, fire: false, shots: 0, touch: false, active: false, usingKeys: false };

export function createGame({ canvas, stage, projects, discovered, reducedMotion = false, getTopInset, onDestroy, onFirstShot }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
  camera.position.set(0, 0, CAM_Z);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0x8fa4ff, 0x170a24, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(-6, 8, 10);
  const rim = new THREE.DirectionalLight(0xff3d81, 1.8);
  rim.position.set(8, -3, -12);
  const fill = new THREE.DirectionalLight(0x00e5ff, 0.9);
  fill.position.set(6, 2, 4);
  scene.add(key, rim, fill);

  const stars = createStars(scene, { warp: !reducedMotion });
  const planets = createPlanets(scene, projects, { discovered, camZ: CAM_Z, fov: FOV });
  const ship = createShip(camera);
  const fx = createEffects(scene);
  const hud = createHud(stage, planets);
  const input = createInput(canvas, { enabled: () => loop.running });
  const raycaster = new THREE.Raycaster();

  let w = 1;
  let h = 1;
  let shake = 0;
  let hitStop = 0;
  let slowMo = 0;
  let cooldown = 0;
  let spread = 0;
  let fired = false;
  let controls = true; // off while a dialog sits over the running game
  let locked = null;
  const aim = { x: 0, y: 0, ndc: new THREE.Vector2(), target: new THREE.Vector3() };
  const shotNdc = new THREE.Vector2();
  const pending = []; // destroyed planets waiting for their card
  const exhaustPos = new THREE.Vector3();
  const exhaustDir = new THREE.Vector3();
  let time = 0;

  function resize({ draw = true } = {}) {
    const rect = stage.getBoundingClientRect();
    const first = w === 1 && h === 1;
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    hud.measure();
    planets.layout(w, h, getTopInset(), SHIP_ZONE);
    ship.layout();
    if (first) {
      aim.x = w / 2;
      aim.y = h * 0.42;
    }
    aim.x = Math.min(w, aim.x);
    aim.y = Math.min(h, aim.y);
    if (draw) render(); // a paused game still shows a correct frame
  }

  function addShake(amount) {
    if (!reducedMotion) shake = Math.max(shake, amount);
  }

  function updateAim(dt, inp) {
    if (inp.usingKeys) {
      aim.x += ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * KEY_AIM_SPEED * dt;
      aim.y += ((inp.down ? 1 : 0) - (inp.up ? 1 : 0)) * KEY_AIM_SPEED * dt;
    } else if (inp.x != null) {
      aim.x = inp.x;
      aim.y = inp.y;
    }
    aim.x = Math.min(Math.max(aim.x, 0), w);
    aim.y = Math.min(Math.max(aim.y, 0), h);
    aim.ndc.set((aim.x / w) * 2 - 1, -(aim.y / h) * 2 + 1);
  }

  function updateCamera(dt) {
    // The view leans slightly toward the crosshair, which sells the depth; shake on top.
    const k = Math.min(1, dt * 4);
    camera.rotation.y += (-aim.ndc.x * 0.025 - camera.rotation.y) * k;
    camera.rotation.x += (aim.ndc.y * 0.018 - camera.rotation.x) * k;
    // A gentle drift, as if the camera were riding along behind the ship.
    const drift = reducedMotion ? 0 : 1;
    camera.position.set(
      (Math.random() - 0.5) * shake + Math.sin(time * 0.37) * 0.12 * drift,
      (Math.random() - 0.5) * shake + Math.sin(time * 0.53) * 0.08 * drift,
      CAM_Z,
    );
    camera.updateMatrixWorld();
  }

  function shoot() {
    const s = 0.003 + spread * 0.018; // recoil bloom
    shotNdc.set(aim.ndc.x + (Math.random() - 0.5) * s, aim.ndc.y + (Math.random() - 0.5) * s);
    raycaster.setFromCamera(shotNdc, camera);
    const hit = planets.raycast(raycaster);
    const muzzle = ship.fire();
    fx.tracer(muzzle, hit ? hit.point : raycaster.ray.at(90, new THREE.Vector3()));
    spread = Math.min(1, spread + 0.22);
    addShake(0.05);
    sound.play('shoot');
    if (!fired) {
      fired = true;
      onFirstShot?.();
    }
    if (hit) onHit(hit, raycaster.ray.direction);
  }

  function onHit(hit, dir) {
    const p = hit.planet;
    const normal = hit.point.clone().sub(p.group.position).normalize();
    fx.impact(hit.point, normal, p.color);
    if (planets.hit(p, hit.uv, dir) === 'crack') {
      addShake(0.1);
      hud.hitMarker(false);
      sound.play('impact');
      return;
    }
    fx.explode(p.group.position, p.group.scale.x, p.color);
    addShake(0.55);
    hud.hitMarker(true);
    sound.play('explode');
    if (!reducedMotion) {
      hitStop = 0.07;
      slowMo = 0.35;
    }
    pending.push({ project: p.project, wait: OPEN_DELAY });
  }

  function update(realDt) {
    // A kill freezes the world for a few frames, then plays it in slow motion for a moment.
    let dt = realDt;
    if (hitStop > 0) {
      hitStop -= realDt;
      dt = 0;
    } else if (slowMo > 0) {
      slowMo -= realDt;
      dt = realDt * 0.35;
    }

    time += realDt;
    const inp = controls ? input.state : IDLE_INPUT;
    updateAim(realDt, inp);
    updateCamera(realDt);

    cooldown -= realDt;
    spread = Math.max(0, spread - realDt * 2.6);
    if ((inp.shots > 0 || inp.fire) && cooldown <= 0 && ship.ready) {
      cooldown = FIRE_INTERVAL;
      inp.shots = 0;
      shoot();
    }

    stars.update(dt);
    planets.update(dt);
    fx.update(dt);

    raycaster.setFromCamera(aim.ndc, camera);
    const lock = planets.raycast(raycaster);
    locked = lock?.planet ?? null;
    ship.update(realDt, lock ? lock.point : raycaster.ray.at(40, aim.target), aim.ndc.x);
    if (ship.ready) {
      ship.exhaust(exhaustPos, exhaustDir);
      fx.exhaust(exhaustPos, exhaustDir, realDt);
    }
    hud.update(camera, w, h, locked, aim, spread, !!(inp.active || inp.usingKeys));
    shake = Math.max(0, shake - realDt * 2.2);

    if (pending.length) {
      pending[0].wait -= realDt;
      if (pending[0].wait <= 0) onDestroy(pending.shift().project);
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  const loop = createLoop(update, render);
  const resizeObserver = new ResizeObserver(() => resize());
  const onVisibility = () => (document.hidden ? loop.pause('hidden') : loop.resume('hidden'));
  document.addEventListener('visibilitychange', onVisibility);
  // Scrolled down to the rest of the page (or the stage hidden): stop drawing and give the keys back.
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      input.reset();
      loop.resume('offscreen');
    } else loop.pause('offscreen');
  }, { threshold: 0.2 });

  return {
    start() {
      resize({ draw: false });
      resizeObserver.observe(stage);
      visibilityObserver.observe(stage);
      // Compile the shaders off the main thread where the browser supports it, then start; doing
      // it on the first frame would freeze the page for a moment on slow phones.
      const ready = renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve();
      ready.catch(() => {}).then(() => loop.start());
    },
    pause(reason) {
      loop.pause(reason);
    },
    resume(reason) {
      input.reset();
      loop.resume(reason);
    },
    /** Called after a card closes: the planet returns, dimmed, as "discovered". */
    discovered(id) {
      planets.respawn(id);
      sound.play('discover');
    },
    celebrate() {
      fx.celebrate(projects.map((p) => p.color));
      sound.play('celebrate');
    },
    /** Lets the game keep animating behind a dialog without the ship reacting. */
    setControls(on) {
      controls = on;
      input.reset();
    },
    reset() {
      planets.reset();
    },
    relayout: () => resize(),
    destroy() {
      loop.stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      input.dispose();
      hud.dispose();
      renderer.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
