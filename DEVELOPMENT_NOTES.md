# Development update — 2026-09-07

Based on the uploaded source snapshot of main at da22416. The updates are on branch `codex/import-search-catalog-updates` in [PR #2](https://github.com/eyeseeyou12/roof-wiki/pull/2). GitHub write access is verified. The PR remains unmerged; production deployment is not part of this work. Cloudflare automatically created a branch preview for the imported commit.

## Implemented
- Search combines names, aliases, existing descriptions, purpose, measurements, disambiguation, and new product specifications in one document per component. Exact names receive priority, filler words are ignored, and longer misspellings are tolerated. Model numbers match with or without punctuation and spaces (for example, 750G and 750-G). All remaining query terms must match; there is no AI-generated answer or photo recognition.
- Home-page search and revised search instructions. Product cards and Xactimate reference sections on component pages. Load failures show a visible message.
- Three initial manufacturer-sourced examples in content/catalog.json: GAF Cobra Rigid Vent 3, Lomanco 750-G, Broan-NuTone 634M. Each has specifications, a source URL, and a verification date. Product compatibility is not certified. No product photos were added in this pass.
- Shared catalog validation in `npm run validate` and the build. Impossible calendar dates are rejected, with regression coverage for malformed entries, duplicate IDs, unknown components, source URLs, and specification types. No Xactimate references are populated: a verified source is still needed.
- Consistent announced loading errors and Reload buttons on search, browse, category, component, and calculator pages. Calculator inputs stay disabled until required data loads; failed loading cannot run an empty calculation. Search retains edits during loading and cancels pending logging when cleared.
- AGENTS.md and updated brand/deployment guidance in CLAUDE.md. Corrected package repository URL.

## Measurement imports
- PDF and CSV are read locally in the browser; file contents are not uploaded, saved, or sent to search logging.
- PDF.js 6.3.289 is pinned and loaded only for PDFs, with its matching worker served from the site. Supports selectable-text pitch/area summary tables and explicit facet/area-unit/pitch rows. Scanned PDFs require manual entry or a CSV export; no OCR is provided.
- CSV supports quoted fields, BOM/CRLF, comma/semicolon/tab delimiters, area units, separate pitch rise/run, and attic assignments. Unknown units and missing pitches must be filled during review. Total/waste rows with recognized labels are omitted.
- Review lets users exclude rows, edit measurements, add/split rows, and assign connected attic groups. Confirmation is required before applying; append is the default, replacement is explicit. The initial untouched blank attic is replaced automatically. Manual entries are otherwise preserved.
- Limits: 20 MB files, 2 MB CSV/extracted PDF text, 100 PDF pages, and 250 reviewed rows. PDF extraction times out after 45 seconds. A recognized total alone never receives the predominant pitch automatically.
- Native ESX decoding is **not supported**. Selecting ESX displays a PDF/CSV export fallback; no geometry is guessed from an unknown format.
- Verified against Roofr's public sample linked from https://roofr.com/measurements: page 6 yields 5,374 sq ft at 8/12 and 968 sq ft at 10/12. The review flags the 6,342 vs 6,341 sq ft rounding difference. The source report is not committed to the repository.
- Tests include actual in-memory PDF bytes through PDF.js, CSV edge cases, units, exclusions, separate attics, missing pitches, duplicated tables, and file limits.

## Run
Use a Node version supporting `node:sqlite`; this branch was validated with Node 24.19.0.

    npm ci
    npm run validate
    npm run build:site
    node --test tests/*.test.mjs
    npm run serve

The existing Cloudflare Pages configuration and calculator formulas are preserved. Existing calculator product records still require their separate specification review. Validation and the site build pass, and all 37 search/catalog/page-loading/import tests pass. An integration check confirmed that both validation and the site build reject an impossible catalog verification date. The existing 27 draft entries and missing-field notices remain. Browser inspection confirmed the branch-preview home page and category list render, and the existing calculator returns 1,200 sq ft from a 1,300 sq ft 5/12 roof segment with 1,152 sq in total NFA at its baseline ratio; local browser access was blocked and screenshot capture timed out, so full visual/mobile QA remains outstanding.

## Next inputs and work
Supply Xactimate screenshots or exports with category, selector, description, unit, and price-list identity; omit customer information. Expand the manufacturer catalog, add appropriately sourced product photos, and review the 27 draft entries. Review PR #2 and complete visual/mobile QA before considering a merge. Do not merge or deploy to production without an explicit request.
