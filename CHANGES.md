# Merge notes — combining the two drafts

This build merges two independently-built drafts of the PEI trip app
("Claude" draft and "Gemini" draft) into one. Summary of what happened:

## Base chosen
The "Claude" draft was used as the base — it had a 5-tab-worth-of-fields
smart planner with an actual scoring/ranking algorithm (vs. exact-match
filtering that could easily return zero results), a location detail
sheet, drive-time/audience/free-only filters on the map, 15 categories
with per-category colors and icons, and roughly 800 lines of CSS vs. the
other draft's 260.

## Bugs fixed
- **Broken script paths (would have failed to load on any real
  deployment).** The base draft's `index.html` pointed to
  `data/locations.js` and `data/routes.js`, but the actual files shipped
  at the project root with no `data/` folder — a silent 404 in the
  browser console and an app with no pins, no cards, and no routes.
  Fixed by moving the data files into `data/`, matching what the
  `index.html` and README already expected.
- **Missing PWA icons.** The base draft's `manifest.json` and
  `index.html` referenced nine icon sizes (72–512px) and an
  apple-touch-icon, but no `icons/` folder shipped at all — "Add to Home
  Screen" would have shown a blank/default icon. The other draft had a
  512px source icon; the full icon set (72, 96, 128, 144, 152, 180, 192,
  384, 512) was regenerated from it and added.

## Content merged in from the other draft
The other draft had a much smaller location list (8 spots) and mostly
overlapped with the base draft's 18 (its Basin Head, Panmure, and
Montague entries were the same real places, just re-described — those
duplicates were skipped). Five genuinely new spots were carried over
and rewritten to match the base draft's data schema (categories,
ratings, `bestFor`, facilities, etc.) so they work with the existing
filters and planner:

- **Point Prim Lighthouse** — new `lighthouse` entry
- **Buffaloland Provincial Park** — new `nature` entry, ~10 min from
  home base
- **Roma at Three Rivers National Historic Site** — new location, and a
  new `history` category was added for it
- **Souris Beach Provincial Park** — new `beach` entry, distinct from
  the existing Souris *town* card
- **PEI Regiment Museum & Heritage Places** — new `history`/`rainy`
  entry in Charlottetown

Drive times for the five new spots were estimated from home base using
the same straight-line-distance-to-minutes ratio implied by the base
draft's existing entries (~1.25 min/km on rural PEI roads), so they sit
consistently alongside the originals.

## Routes
Kept all five of the base draft's routes as-is. Added **Point Prim** as
a stop on the way into the Charlottetown Capital Day route (it's
geographically on that corridor), added **Souris Beach** as a stop on
the Basin Head Adventure route, and added one new route — **Three
Rivers Heritage Loop** — built around Buffaloland and Roma at Three
Rivers, both a short drive from home base.

## Not carried over
- The other draft's home-base coordinates (46.0461, -62.6186 vs. the
  base draft's 46.0584, -62.6067) — a few km apart, both in the general
  Alliston area. Kept the base draft's, since every existing drive-time
  label in that draft was estimated from it; switching would have
  quietly made all of them wrong.
- The other draft's simpler exact-match planner logic, flat CSS, and
  duplicate location entries.
