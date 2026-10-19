// Generates the favicon, the touch icon and the social preview (OG) image into site/public/images.
// Run with `npm run images` after changing the name, role or colors.

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import site from '../site.config.js';

const out = resolve(import.meta.dirname, '../site/public/images');

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#00e5ff"/><stop offset=".6" stop-color="#6c5bff"/><stop offset="1" stop-color="#ff3d81"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <path d="M32 12 46 46 37 41H27l-9 5z" fill="#050611"/>
  <circle cx="32" cy="30" r="3.5" fill="#ff3d81"/>
</svg>`;

// deterministic pseudo-random so the image doesn't change on every run
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const stars = Array.from({ length: 160 }, () => {
  const r = rand() < 0.15 ? 1.6 : 0.9;
  return `<circle cx="${(rand() * 1200).toFixed(1)}" cy="${(rand() * 630).toFixed(1)}" r="${r}" fill="#fff" opacity="${(0.3 + rand() * 0.6).toFixed(2)}"/>`;
}).join('');

const planets = [
  [880, 170, 62, '#00e5ff'],
  [1060, 300, 44, '#ff3d81'],
  [930, 430, 52, '#ffb020'],
  [1110, 520, 30, '#a78bfa'],
  [760, 330, 34, '#34d399'],
]
  .map(
    ([x, y, r, c], i) => `<defs><radialGradient id="p${i}" cx=".35" cy=".3" r=".8">
      <stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${c}"/><stop offset="1" stop-color="#05060f"/>
    </radialGradient></defs>
    <circle cx="${x}" cy="${y}" r="${r * 1.6}" fill="${c}" opacity=".12"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#p${i})"/>`,
  )
  .join('');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="n1" cx=".1" cy="0" r=".8"><stop offset="0" stop-color="#6e3cff" stop-opacity=".35"/><stop offset="1" stop-color="#6e3cff" stop-opacity="0"/></radialGradient>
    <radialGradient id="n2" cx=".9" cy=".3" r=".6"><stop offset="0" stop-color="#00e5ff" stop-opacity=".22"/><stop offset="1" stop-color="#00e5ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#9df6ff"/><stop offset="1" stop-color="#ff8fbb"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#05060f"/>
  <rect width="1200" height="630" fill="url(#n1)"/>
  <rect width="1200" height="630" fill="url(#n2)"/>
  ${stars}
  ${planets}
  <path d="M300 540 318 582 309 577H291l-9 5z" fill="#0b1530" stroke="#00e5ff" stroke-width="3" stroke-linejoin="round"/>
  <line x1="300" y1="520" x2="300" y2="500" stroke="#e8fdff" stroke-width="4" stroke-linecap="round"/>
  <text x="80" y="250" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="84" font-weight="800" fill="url(#t)">${esc(site.name)}</text>
  <text x="80" y="315" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="36" fill="#c9d3f0">${esc(site.role)}</text>
  <text x="80" y="375" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="28" fill="#8f9bc2">Games · Unity editor tools · AI experiments</text>
  <text x="80" y="450" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="26" font-weight="600" fill="#00e5ff">${esc(site.siteUrl.replace(/^https?:\/\//, ''))}</text>
</svg>`;

await writeFile(resolve(out, 'favicon.svg'), favicon);
await sharp(Buffer.from(favicon)).resize(32, 32).png().toFile(resolve(out, 'favicon-32.png'));
await sharp(Buffer.from(favicon)).resize(180, 180).png().toFile(resolve(out, 'apple-touch-icon.png'));
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(resolve(out, 'og.png'));
console.log('images written to', out);
