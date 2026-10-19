// Procedural textures, drawn on canvases at start-up so the game needs no image files:
// planet surfaces (with the project icon painted on), the glowing crack layer that grows where a
// shot lands, and the soft sprites used for glows, flashes, sparks and shockwaves.

import * as THREE from 'three';
import { ICONS } from '../ui/icons.js';

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Value noise that wraps horizontally, so the texture has no seam where it meets around the sphere.
function hash(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const a = hash(x0, yi, seed);
  const b = hash(x1, yi, seed);
  const c = hash(x0, yi + 1, seed);
  const d = hash(x1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, period, seed, octaves) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y, period, seed + o * 17) * amp;
    norm += amp;
    x *= 2;
    y *= 2;
    period *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

const iconCache = new Map();
function iconPaths(name) {
  if (!iconCache.has(name)) iconCache.set(name, (ICONS[name] || ICONS.code).map((d) => new Path2D(d)));
  return iconCache.get(name);
}

/** Equirectangular planet surface: gas bands or rocky noise in the project colour, icon on two sides. */
export function planetTexture(project, index) {
  // Noise is computed at half resolution and scaled up; craters and icons are drawn at full size.
  const NW = 160;
  const NH = 80;
  const small = makeCanvas(NW, NH);
  const sg = small.getContext('2d');
  const img = sg.createImageData(NW, NH);
  const data = img.data;
  const [r, g, b] = hexToRgb(project.color);
  const dark = [r * 0.16 + 8, g * 0.16 + 8, b * 0.16 + 14];
  const light = [r + (255 - r) * 0.6, g + (255 - g) * 0.6, b + (255 - b) * 0.6];
  const banded = index % 2 === 0;
  const seed = index * 101 + 7;
  const P = 6;

  for (let y = 0; y < NH; y++) {
    const lat = y / NH;
    for (let x = 0; x < NW; x++) {
      const nx = (x / NW) * P;
      const ny = lat * P * 0.5;
      const n = fbm(nx, ny, P, seed, 4);
      let t = banded ? 0.5 + 0.5 * Math.sin(lat * Math.PI * 10 + n * 6) : Math.min(1, Math.max(0, (n - 0.28) * 1.8));
      t = t * 0.82 + fbm(nx * 5, ny * 5, P * 5, seed + 3, 2) * 0.18;
      let cr, cg, cb;
      if (t < 0.6) {
        const k = t / 0.6;
        cr = dark[0] + (r - dark[0]) * k;
        cg = dark[1] + (g - dark[1]) * k;
        cb = dark[2] + (b - dark[2]) * k;
      } else {
        const k = (t - 0.6) / 0.4;
        cr = r + (light[0] - r) * k;
        cg = g + (light[1] - g) * k;
        cb = b + (light[2] - b) * k;
      }
      const i = (y * NW + x) * 4;
      data[i] = cr;
      data[i + 1] = cg;
      data[i + 2] = cb;
      data[i + 3] = 255;
    }
  }
  sg.putImageData(img, 0, 0);

  const W = 512;
  const H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, W, H);

  if (!banded) {
    // craters: dark bowl with a lit rim
    for (let i = 0; i < 9; i++) {
      const cx = hash(i, 1, seed) * W;
      const cy = H * (0.2 + hash(i, 2, seed) * 0.6);
      const cr = 6 + hash(i, 3, seed) * 18;
      const grad = ctx.createRadialGradient(cx - cr * 0.2, cy - cr * 0.2, cr * 0.1, cx, cy, cr);
      grad.addColorStop(0, 'rgba(0,0,0,0.38)');
      grad.addColorStop(0.75, 'rgba(0,0,0,0.18)');
      grad.addColorStop(0.92, 'rgba(255,255,255,0.18)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The project icon, on opposite sides so it comes round as the planet turns.
  const s = (H * 0.4) / 24;
  for (const cx of [W * 0.25, W * 0.75]) {
    ctx.save();
    ctx.translate(cx - 12 * s, H / 2 - 12 * s);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(5,6,15,0.6)';
    ctx.lineWidth = 4.6;
    for (const p of iconPaths(project.icon)) ctx.stroke(p);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.1;
    for (const p of iconPaths(project.icon)) ctx.stroke(p);
    ctx.restore();
  }

  const tex = toTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/** Black emissive layer; every hit burns a glowing, branching crack into it at the impact point. */
export function createCrackLayer() {
  const W = 512;
  const H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const texture = toTexture(c);

  function clear() {
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    texture.needsUpdate = true;
  }

  function walk(x, y, angle, segs, len, out) {
    const pts = [[x, y]];
    for (let s = 0; s < segs; s++) {
      angle += (Math.random() - 0.5) * 1.1;
      const l = len * (0.6 + Math.random() * 0.8);
      x += Math.cos(angle) * l;
      y += Math.sin(angle) * l;
      pts.push([x, y]);
      if (Math.random() < 0.28 && segs > 2) walk(x, y, angle + (Math.random() - 0.5) * 2, segs - s - 1, len * 0.7, out);
    }
    out.push(pts);
  }

  /** u, v: texture coordinates of the impact; power grows with every hit. */
  function crack(u, v, power = 1) {
    const x0 = u * W;
    const y0 = (1 - v) * H;
    const lines = [];
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      walk(x0, y0, (i / n) * Math.PI * 2 + Math.random() * 0.6, 4 + Math.floor(Math.random() * 3), 9 * power, lines);
    }
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // Drawn three times, shifted by the texture width, so cracks wrap across the seam.
    for (const off of [-W, 0, W]) {
      for (const [style, width] of [
        ['rgba(255,50,10,0.32)', 9 * power],
        ['rgba(255,120,30,0.85)', 3.2 * power],
        ['rgba(255,236,190,1)', 1.2 * power],
      ]) {
        g.strokeStyle = style;
        g.lineWidth = width;
        g.beginPath();
        for (const pts of lines) {
          g.moveTo(pts[0][0] + off, pts[0][1]);
          for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + off, pts[i][1]);
        }
        g.stroke();
      }
      const r = 14 * power;
      const grad = g.createRadialGradient(x0 + off, y0, 0, x0 + off, y0, r);
      grad.addColorStop(0, 'rgba(255,240,200,1)');
      grad.addColorStop(0.35, 'rgba(255,130,40,0.85)');
      grad.addColorStop(1, 'rgba(255,40,0,0)');
      g.fillStyle = grad;
      g.fillRect(x0 + off - r, y0 - r, r * 2, r * 2);
    }
    texture.needsUpdate = true;
  }

  clear();
  return { texture, crack, clear };
}

// ---- small sprite textures, built once ----

const sprites = new Map();
function cached(name, draw, size = 128) {
  if (!sprites.has(name)) {
    const c = makeCanvas(size, size);
    draw(c.getContext('2d'), size);
    sprites.set(name, toTexture(c));
  }
  return sprites.get(name);
}

export const glowTexture = () =>
  cached('glow', (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.22, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });

export const sparkTexture = () =>
  cached(
    'spark',
    (g, s) => {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    },
    32,
  );

/** Muzzle / impact flash: a hot core with a few spikes. */
export const flashTexture = () =>
  cached('flash', (g, s) => {
    const c = s / 2;
    g.translate(c, c);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate((i / 6) * Math.PI * 2 + (i % 2) * 0.3);
      const len = i % 2 ? c * 0.6 : c;
      const grad = g.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -c * 0.09);
      g.lineTo(len, 0);
      g.lineTo(0, c * 0.09);
      g.fill();
      g.restore();
    }
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, c * 0.55);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(-c, -c, s, s);
  });

export const ringTexture = () =>
  cached(
    'ring',
    (g, s) => {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.68, 'rgba(255,255,255,0)');
      grad.addColorStop(0.86, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.93, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    },
    256,
  );
