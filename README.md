# 🌊 PEI Family Adventure Guide

A mobile-friendly trip planner and map for a PEI family trip. No backend, no accounts, no database — everything runs from static files, and "favorites" are saved only in each visitor's own browser (localStorage).

## Try it locally

Just open `index.html` in a browser. No build step, no install.

## Publish to GitHub Pages

1. Create a public GitHub repo (or use an existing one).
2. Copy everything in this folder — `index.html`, `style.css`, `app.js`, `manifest.json`, `data/`, `icons/` — into the repo root.
3. Commit and push.
4. In the repo, go to **Settings → Pages**, set **Source** to your default branch (usually `main`) and folder `/ (root)`, then save.
5. GitHub will publish it at `https://<your-username>.github.io/<repo-name>/`.

## Install it as an app on a phone

Once it's live on GitHub Pages:

- **iPhone (Safari):** open the site → Share button → "Add to Home Screen."
- **Android (Chrome):** open the site → menu (⋮) → "Add to Home screen" / "Install app."

## Editing the content

- **`data/locations.js`** — every pin on the map and every location card. Copy an existing object to add a new spot; nothing else needs to change.
- **`data/routes.js`** — the suggested route cards on the Routes tab. Each route is just an ordered list of location `id`s from `locations.js`.
- Categories, colors, and icons live in the `PEI_CATEGORIES` object at the top of `data/locations.js`.

## About this build

This is the merged version of two draft builds. See `CHANGES.md` for exactly what was fixed and what was combined from each draft.

## Privacy notes baked into the build

- The home base marker only labels the general Alliston area — never a specific address.
- No accounts, no sign-in, no server, no analytics, no uploads.
- "Want to Visit," "Favorite," and "Visited" are stored in the browser's local storage only (`localStorage`), per device — they are not shared or uploaded anywhere.
- Drive times are straight-line estimates adjusted for typical rural PEI roads, meant for rough day planning — always sanity-check the actual route before you drive it.
