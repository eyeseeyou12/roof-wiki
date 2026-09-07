# Development update — 2026-09-07

Based on the uploaded source snapshot of main at da22416. The updates are on branch `codex/import-search-catalog-updates` in [PR #2](https://github.com/eyeseeyou12/roof-wiki/pull/2). GitHub write access is verified. The PR remains unmerged; production deployment is not part of this work. Cloudflare automatically created a branch preview for the imported commit.

## Implemented
- Search combines names, aliases, existing descriptions, purpose, measurements, disambiguation, and new product specifications in one document per component. Exact names receive priority, filler words are ignored, and longer misspellings are tolerated. Model numbers match with or without punctuation and spaces (for example, 750G and 750-G). All remaining query terms must match; there is no AI-generated answer or photo recognition.
- Home-page search and revised search instructions. Product cards and Xactimate reference sections on component pages. Load failures show a visible message.
- Three initial manufacturer-sourced examples in content/catalog.json: GAF Cobra Rigid Vent 3, Lomanco 750-G, Broan-NuTone 634M. Each has specifications, a source URL, and a verification date. Product compatibility is not certified. No product photos were added in this pass.
- Shared catalog validation in `npm run validate` and the build. Impossible calendar dates are rejected, with regression coverage for malformed entries, duplicate IDs, unknown components, source URLs, and specification types. No Xactimate references are populated: a verified source is still needed.
- AGENTS.md and updated brand/deployment guidance in CLAUDE.md. Corrected package repository URL.

## Run
Use a Node version supporting `node:sqlite`; this branch was validated with Node 24.19.0.

    npm ci
    npm run validate
    npm run build:site
    node --test tests/*.test.mjs
    npm run serve

The existing Cloudflare Pages configuration and calculator formulas are preserved. Existing calculator product records still require their separate specification review. Validation and the site build pass, and all 15 search/catalog tests pass. An integration check confirmed that both validation and the site build reject an impossible catalog verification date. The existing 27 draft entries and missing-field notices remain. Browser inspection confirmed the initial branch-preview home page and category list render; local browser access was blocked and screenshot capture timed out, so full visual/mobile QA remains outstanding.

## Next inputs and work
Supply Xactimate screenshots or exports with category, selector, description, unit, and price-list identity; omit customer information. Expand the manufacturer catalog, add appropriately sourced product photos, and review the 27 draft entries. Review PR #2 and complete visual/mobile QA before considering a merge. Do not merge or deploy to production without an explicit request.
