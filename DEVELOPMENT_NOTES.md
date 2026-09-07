# Development update — 2026-09-07

Based on the uploaded source snapshot of main at da22416. This archive has local changes and has not been pushed or deployed. Git history is not included.

## Implemented
- Search combines names, aliases, existing descriptions, purpose, measurements, disambiguation, and new product specifications in one document per component. Exact names receive priority, filler words are ignored, and longer misspellings are tolerated. All remaining query terms must match; there is no AI-generated answer or photo recognition.
- Home-page search and revised search instructions. Product cards and Xactimate reference sections on component pages. Load failures show a visible message.
- Three initial manufacturer-sourced examples in content/catalog.json: GAF Cobra Rigid Vent 3, Lomanco 750-G, Broan-NuTone 634M. Each has specifications, a source URL, and a verification date. Product compatibility is not certified. No product photos were added in this pass.
- Validated catalog contract for future Xactimate records. None are populated: a verified source is still needed.
- AGENTS.md and updated brand/deployment guidance in CLAUDE.md. Corrected package repository URL.

## Run
Node 22.5+ (or a newer version supporting node:sqlite).

    npm ci
    npm run validate
    npm run build:site
    node --test tests/*.test.mjs
    npm run serve

The existing Cloudflare Pages configuration and calculator formulas are preserved. Existing calculator product records still require their separate specification review. No browser/visual QA was performed in this pass. There is no user-facing local preview in this environment.

## Next inputs and work
Supply Xactimate screenshots or exports with category, selector, description, unit, and price-list identity; omit customer information. Expand the manufacturer catalog, add appropriately sourced product photos, and review the 27 draft entries. GitHub push access has not been established; merge reviewed changes into the original repository using the existing deployment workflow.
