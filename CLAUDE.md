# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

roof-wiki: a public web reference for identifying roof components, accessories, and penetrations — scoped to penetrations, vents, and intake only (no flashings, valley metal, edge metal). It serves three moments: looking at something on a roof and not knowing what it is; needing to replace something and not knowing what to order; hearing a name and not knowing what it means. It is explicitly **not** an estimating tool — brands, models, and specifications are allowed alongside generic identification and measurement guidance. No pricing or estimate generation.

This repo was split out from a personal monorepo that also held an unrelated legacy project ("Notes on the Wall", a shared message board). Only roof-wiki's own history came along — nothing from that project lives here.

## Commands

- `npm run validate` — parse and validate every seed file in `content/components/*.md`. Reports (does not just error on) missing required fields, orphaned links, cross-component alias collisions, and entries still marked draft. Also validates `content/catalog.json` and its component references when run without a custom seed directory. Exits non-zero on hard seed errors or an invalid catalog.
- `npm run build` — the full pipeline: loads `content/categories.yml` and `content/components/*.md` against `db/schema.sql` in an in-memory SQLite database (via `node:sqlite`, no native dependency), then exports `dist/data/{components,categories,search-index,products}.json`. Run `npm run validate` first if this fails — build aborts loudly on the same errors validate reports, plus unknown category/component/product references.
- `npm run build:site` — runs `build`, then assembles `_site/` (the Cloudflare Pages output dir) from the hand-authored static UI in `site/`, the JSON `build` just produced, and the two isomorphic lib modules (vendoring a plain ESM build of their one dependency, minisearch) so the browser can import them directly.
- `npm run serve` — a small dependency-free static file server for `_site/`, for local testing. Run `node --test tests/*.test.mjs` after building for the search and catalog regression suite. No other dev server or linter is configured.

## Architecture

**Static site, not a web app.** Chosen so name search and browse work with no network signal (component/alias data ships to the client) and so the whole thing stays low-maintenance for a one-person project. The only server-side piece is one Cloudflare Pages Function (`functions/api/log-search.js`) writing to D1 — everything else is a static build.

**Two databases that don't talk to each other:**
- The **content database** (`db/schema.sql`: `component`, `alias`, `category`, `component_category`, `component_link`) is rebuilt from scratch by `scripts/build.mjs` on every build, never persisted between builds. It exists only to get from seed files to constraint-checked JSON in one pass — the schema file is the single source of truth, there is no migration chain for it.
- **`search_miss`** (`db/migrations/0001_search_miss.sql`) is the opposite: it lives in production Cloudflare D1 and accumulates real traffic, so it gets versioned migrations. It references components by `clicked_component_slug` (TEXT, unenforced), not a numeric FK — the content database's ids aren't stable across rebuilds, and the two databases are physically separate, so a real foreign key isn't possible. The supplied September 7 handoff reports that production D1 is provisioned and migrated; verify live status separately before infrastructure changes.

**Content pipeline:** `content/components/*.md` (Markdown + YAML frontmatter) → `scripts/lib/parse-seed.mjs` → `scripts/build.mjs` (loads into the in-memory content DB, validates categories/links exist) → `dist/data/*.json` (gitignored build output) → client-side search via `scripts/lib/query.mjs`, which wraps MiniSearch over the alias/name index and is written with no Node-only APIs so it runs unmodified in the browser (see `site/js/search-page.mjs`).

**Seed file format** (see `content/components/_template.md` for the annotated version): filename *is* the slug, no separate slug field. Only `name` and `confidence` are required; everything else defaults (`type` → component, `status` → draft) or can be left blank — the validator, not the parser, is what flags incompleteness. Prose fields (summary, description, function, replacement_notes, measurement_notes, failure_modes, disambiguation) are `## Heading` sections in the Markdown body. Aliases and links use an inline syntax deliberately mirroring how the source inventory batches were hand-written: `name (dialect)`, `name (dialect — note)`, `link_type: target-slug`. **Only an em/en dash (—/–) delimits a note — never a plain hyphen**, since slugs and notes routinely contain them (`lead-flashing`, `split-boot`). `see_also` and `confused_with` are symmetric: write the link on one side only, `scripts/build.mjs` inserts the reverse automatically (the validator flags a one-way link as informational, not an error, for the same reason).

**Content discipline, load-bearing for everything in `content/`:** seed files are converted or written from real sources only — never invent a fact to fill a field. Where a field has no source, it's left empty and the validator reports it as missing rather than being papered over. This is why every current component is missing `summary`: the source inventory always wrote "what it is" (→ description) but never a separately-registered short-answer register, and duplicating description into summary or paraphrasing it would both count as inventing content. `confidence` (`high`/`medium`/`thin`) and `status` (`draft`/`reviewed`) are both currently draft/unreviewed across the board — `thin` means "don't trust this without review," not "don't ship it."

**Ventilation calculator** (`scripts/lib/ventilation-calculator.mjs`, isomorphic like query.mjs, wired to a real form at `site/calculator.html`): grounded in IRC R806.2 (baseline 1/150 net free area, narrower 1/300 exception, both documented with real caveats in `content/components/attic-ventilation-ratio.md` since the exception's exact conditions genuinely differ between sources checked). Three optional, increasing-precision tiers feed into `atticSquareFootage`: roof segments only (pitch-corrected), roof segments plus eave length and overhang depth (also corrects for the overhang aerial roof reports include but which isn't attic space), or direct manual entry. `calculateForSections()` handles separated attic spaces (a garage attic behind a firewall, an addition not actually open to the main attic — see `content/components/separated-attic-spaces.md`) as independent calculations, never summed. `estimateExhaustOptions`/`estimateIntakeOptions` translate a required NFA into quantities of generic component classes by default (e.g. "~32 linear feet of ridge vent"), or into specific real products when passed `{ brand, products }` — `content/products.yml` is a **separate data layer from the component wiki**, retained for calculator compatibility. `content/catalog.json` holds manufacturer-sourced wiki products and verified Xactimate references. Brands and models are allowed throughout the reference.

## UI

`site/` is a plain HTML/CSS/JS static site — no framework, no SSG (Eleventy or otherwise) — wired directly to the isomorphic `query.mjs`/`ventilation-calculator.mjs` modules above. Pages that import `query.mjs` need an import map for its `minisearch` dependency (`{"imports": {"minisearch": "/lib/vendor/minisearch.js"}}`, a vendored ESM build `build-site.mjs` copies in), since that bare specifier only resolves at build time otherwise.

- Home (`index.html`): the three doors — search a name, browse categories, and a disabled photo-ID placeholder (intentionally not designed for yet, no hooks).
- `search.html`, `browse.html`, `category.html`, `component.html`: search over the full alias index, category browsing, and a summary-first component detail page (falling back to description when summary is blank, which is currently every component — see the content-discipline note above).
- `calculator.html`: the ventilation calculator form — all three `atticSquareFootage` tiers, separated attic sections, the 1/300 exception checkbox, and an optional brand filter against `content/products.yml`.

## Not yet built

Photo-ID identification: no hooks, not designed for. Production search logging is configured per the supplied handoff.

## Measurement upload

The calculator can read PDF/CSV measurements in the browser, review them, and append or replace attic inputs. `scripts/lib/measurement-import.mjs` contains pure parsers and reviewed-row validation; `scripts/lib/measurement-file.mjs` reads files and lazy-loads PDF.js. `site/js/measurement-upload.mjs` owns review UI and passes validated sections to the calculator. No report content is uploaded or logged. PDF.js and its matching worker are pinned and copied by build:site. Native ESX decoding and scanned-PDF OCR are not implemented; show an explicit PDF/CSV/manual-entry fallback. Never guess a missing pitch or apply a predominant pitch to a mixed-pitch total. Keep review and attic exclusions required.
