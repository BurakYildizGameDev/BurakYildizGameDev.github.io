# burakyildizgamedev.github.io

Personal site with a playable portfolio: a 3D space shooter (Three.js) where every planet is a
project. Aim with the crosshair and shoot a planet three times: each hit burns a glowing crack where
it lands, the last one blows it apart and its card opens. Up to 16 planets (10 on phones) are in
play at once; each destroyed planet makes room for the next project not yet discovered. A **List view** with the same cards is always one
click away, and it is the default when the visitor prefers reduced motion.

Below the game (and the list) the home page has a short About section and links to projects by
area; the full story (education, timeline, skills) is on `/about/`. The counts come from
`projects.json` at build time. The game
pauses and hands the arrow keys and Space back to the page while it is scrolled out of view.

Plain JavaScript + Vite + Three.js, no framework. Three.js is only downloaded when the game is shown.
The font (Inter) is self-hosted through `@fontsource-variable/inter`.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # → dist/
npm run preview   # serve dist/
npm run images    # regenerate favicon, touch icon and og.png
```

## Where things are

| What | File |
|---|---|
| Name, e-mails, social links, CV, education, Project Doctor version / Asset Store URL | `site.config.js` |
| Projects (every project is a planet; `"featured": true` ones are bigger and listed first) | `site/src/data/projects.json` |
| Pages | `site/index.html`, `site/about/`, `site/projects/`, `site/project-doctor/`, `site/support/`, `site/contact/`, `site/404.html` |
| Shared header / footer | `site/partials/` |
| Game | `site/src/game/` (index: renderer and shooting, planets, ship, effects, hud, stars, textures, input, audio) |
| Card and list view (shared by the game and the list) | `site/src/ui/card.js`, `site/src/ui/list.js` |
| Styles | `site/src/styles.css` |

The HTML pages use a few build-time placeholders, handled in `vite.config.js`:
`{{key}}` for values from `site.config.js` (plus `{{projectCount}}`, `{{liveCount}}` and per-category
counts computed from the project data), `<!--@meta …-->` for title/description/OG tags,
`<!--@header:page-->` / `<!--@footer-->`, `<!--@projects-->` for the prerendered project grid
and `<!--@if key-->…<!--@endif-->` for optional parts (e.g. LinkedIn).

### Adding a project

Add an entry to `projects.json`. `icon` is one of the names in `site/src/ui/icons.js`; `links` can
hold `play`, `live`, `store`, `docs`, `itch`, `download`, `model` and `github`. For a screenshot,
put it in `site/public/images/projects/` (16:9 WebP) and set `"image": "images/projects/name.webp"`.
`highlights` (a few bullet points) and `status` (e.g. "Live on Google Play") show on the card.
`/projects/?filter=Unity` opens the list with a category selected. The list shows every featured
project and the six newest of the others; "Show N more" reveals the rest (the game keeps them all).
For a CV button on the About page, put the PDF in `site/public/` and set `cv: '/cv.pdf'`. Set `"released": true` for projects people can use, play or download today: they get a **Live**
badge, appear under the Live filter and are listed first.

## Deploy (GitHub Pages)

1. Create the public repo `BurakYildizGameDev/BurakYildizGameDev.github.io` and push this folder to `main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

A custom domain later: add `site/public/CNAME` with the domain and set `siteUrl` in `site.config.js`.

## Asset Store publisher profile

- Website → `https://burakyildizgamedev.github.io/`
- Customer support → `https://burakyildizgamedev.github.io/support/` + the support e-mail
- When Project Doctor is live, set `projectDoctor.storeUrl` in `site.config.js`: the product page
  button and the project card pick it up.
