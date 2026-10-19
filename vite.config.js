import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import site from './site.config.js';
import { projects } from './site/src/data/projects.js';
import { listHtml } from './site/src/ui/list.js';

const root = resolve(import.meta.dirname, 'site');

const pages = {
  home: 'index.html',
  projects: 'projects/index.html',
  projectDoctor: 'project-doctor/index.html',
  support: 'support/index.html',
  contact: 'contact/index.html',
  notFound: '404.html',
};

// Paths listed in sitemap.xml (404 is left out on purpose).
const sitemapPaths = ['/', '/projects/', '/project-doctor/', '/support/', '/contact/'];

const tokens = {
  name: site.name,
  role: site.role,
  siteUrl: site.siteUrl,
  contactEmail: site.contactEmail,
  supportEmail: site.supportEmail,
  github: site.github,
  itch: site.itch,
  huggingface: site.huggingface,
  linkedin: site.linkedin,
  pdVersion: site.projectDoctor.version,
  pdUnity: site.projectDoctor.unity,
  pdStoreUrl: site.projectDoctor.storeUrl,
  year: String(new Date().getFullYear()),
};

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const partial = (name) => readFileSync(resolve(root, 'partials', `${name}.html`), 'utf8');

function metaHtml(attrs) {
  const title = attrs.title ? `${attrs.title} · ${site.name}` : `${site.name} · ${site.role}`;
  const description = attrs.description || '';
  const url = site.siteUrl + (attrs.path || '/');
  const image = `${site.siteUrl}/images/og.png`;
  const e = escapeAttr;
  return `<title>${e(title)}</title>
    <meta name="description" content="${e(description)}">
    <link rel="canonical" href="${e(url)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${e(site.name)}">
    <meta property="og:title" content="${e(title)}">
    <meta property="og:description" content="${e(description)}">
    <meta property="og:url" content="${e(url)}">
    <meta property="og:image" content="${e(image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#05060f">
    <link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/images/favicon-32.png" sizes="32x32" type="image/png">
    <link rel="apple-touch-icon" href="/images/apple-touch-icon.png">`;
}

// Tiny build-time templating so the pages stay plain HTML files:
//   <!--@meta title="…" description="…" path="/x/"-->   head tags (title, description, OG, icons)
//   <!--@header:page--> <!--@footer-->                   shared partials, current page marked
//   <!--@projects-->                                     prerendered project list (works without JS)
//   <!--@if key-->…<!--@else-->…<!--@endif-->            shown only when a token is non-empty
//   {{key}}                                             values from site.config.js
function renderPage(html) {
  html = html.replace(/<!--@meta([^>]*?)-->/g, (_, raw) => {
    const attrs = {};
    for (const [, k, v] of raw.matchAll(/(\w+)="([^"]*)"/g)) attrs[k] = v;
    return metaHtml(attrs);
  });
  html = html.replace(/<!--@header:([\w-]+)-->/g, (_, page) =>
    partial('header').replace(`data-nav="${page}"`, `data-nav="${page}" aria-current="page"`),
  );
  html = html.replace(/<!--@footer-->/g, () => partial('footer'));
  html = html.replace(/<!--@projects-->/g, () => listHtml(projects));
  html = html.replace(/<!--@if (\w+)-->([\s\S]*?)(?:<!--@else-->([\s\S]*?))?<!--@endif-->/g, (_, key, yes, no = '') =>
    tokens[key] ? yes : no,
  );
  html = html.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in tokens ? escapeAttr(tokens[key]) : m));
  return html;
}

function sitePages() {
  return {
    name: 'site-pages',
    buildStart() {
      for (const key of ['contactEmail', 'supportEmail']) {
        if (/example\.com$/.test(site[key])) this.warn(`site.config.js: ${key} is still a placeholder (${site[key]}).`);
      }
    },
    transformIndexHtml: { order: 'pre', handler: renderPage },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const urls = sitemapPaths
        .map((p) => `  <url><loc>${site.siteUrl}${p}</loc><lastmod>${today}</lastmod></url>`)
        .join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}/sitemap.xml\n`,
      });
    },
    handleHotUpdate({ file, server }) {
      // Partials, config and project data are baked into the HTML, so a change needs a full reload.
      if (/[\\/]partials[\\/]|site\.config\.js$|projects\.json$/.test(file)) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

export default defineConfig({
  root,
  base: '/',
  appType: 'mpa',
  plugins: [sitePages()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // The game chunk carries Three.js; it is lazy-loaded, so its size doesn't affect first paint.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pages).map(([k, p]) => [k, resolve(root, p)])),
    },
  },
});
