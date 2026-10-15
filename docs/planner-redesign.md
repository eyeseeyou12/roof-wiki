# Ventilation planner — private review, October 2026

The existing Cloudflare Pages project now builds a password-protected review deployment from the feature branch. Production/main is not changed. The calculator stays at `/calculator` and retains manual floor or pitched-roof entry, independently sized attic spaces, optional overhang correction, and reviewed PDF/CSV import.

## Simplified interface

The main flow is one column: attic area, exhaust product, then intake quantity. A fitting passive candidate is selected as a starting point; it does not automatically add intake or earn a pass. A single grouped dropdown exposes the full exhaust catalog. Existing-intake credit, separate-attic management, product specifications and code settings are collapsed until needed. Existing-system mode always exposes installed inventory and keeps proposed additions excluded. Ridge length remains editable after a short ridge triggers a static-vent candidate. Eleven controller interaction scenarios verify the simplified flow.

## Product records

`content/ventilation-products.json` is the structured calculation catalog. Build validates the record types, exact model IDs, component references, units, dates, source URLs and positive numeric specifications, then exports `/data/ventilation-products.json`. The controller loads that file; it has no hardcoded product ratings. Corresponding sourced records in `content/catalog.json` flow through the existing SQLite content build into component details and search. Update both records when a manufacturer's specification changes; catalog tests ensure the calculation products remain represented in the wiki.

The first 12 records cover Owens Corning and GAF ridge vents, Lomanco box vents, the GAF HCD144 metal dome, OC InFlow and GAF IntakePro roof intake, Lomanco SV-10 soffit/drip-edge intake, and Attic Breeze, Solar Royal and GAF solar fans. Central Texas relevance includes Texas manufacturers and established supply networks; local stock is not assumed. Exact specifications, material where sourced, installation notes, source dates and manufacturer links are accessible from the calculator. Custom soffit/intake and exhaust ratings remain available.

## Calculation behavior

- Each roof face projects separately: floor area = roof area / sqrt(1 + (rise/run)^2). Optional eave length × overhang depth is deducted afterward. Values retain precision through takeoff.
- Baseline required NFA is floor area × 144 / 150. Equal intake/exhaust targets are a balanced planning method, not an extra baseline IRC requirement.
- The reduced 1:300 basis requires explicit climate-zone, vapor-retarder where applicable, upper/lower placement and local-code confirmations. The exception uses 40–50% upper allocation. Unusual excess-NFA allocations request review instead of declaring a code violation.
- Passive quantities round up. Supporting intake is at least the selected rounded exhaust capacity. Unknown inventory is not silently credited; mixed exhaust requires review.
- Installed inventory and proposed intake additions are separate. Checking an existing system never credits planned additions. Browser-local draft storage retains all attic plans; imported documents themselves are not stored or uploaded.
- PASS/FAIL reports rated capacity and balance, not a field inspection or permit approval. Known product pitch conflicts remain REVIEW. Unknown geometry, roof material, opening detail, baffles and airflow paths require installation verification.
- Solar fan CFM is never converted to passive NFA. The separate manufacturer check needs confirmed count, total coverage and minimum intake. GAF's exact sizing table is preserved without interpolation; headline coverage never automatically becomes a verified design. Changing fan count clears the coverage confirmation.

## Private Cloudflare deployment

`build:site` embeds the completed app assets into the advanced-mode Pages `_worker.js` and leaves only an inert lock page in static storage. This also protects app contents if a Pages Functions quota is configured to fail open. The Worker requires HTTPS Basic authentication on every route, including data, modules, PDFs and the existing D1 search logging endpoint. Only the SHA-256 digest of a generated high-entropy review password is committed. Responses use private/no-store and noindex headers. No access password is committed, embedded in a URL, or written into generated assets.

The credential is shared review access, not separate user accounts. Existing old deployments are unaffected. Do not merge to main or publish publicly without the owner's explicit approval. A future public launch must deliberately remove/change the review protection.

## Validation

Run `npm run validate`, `npm run build:site`, and `node --test tests/*.test.mjs`. Tests cover the original search/import behavior, model-code eligibility, boundary rounding, independent attics, actual vs proposed capacity, unknowns/mixed systems, exact catalog variants and solar rows, and generated Worker authorization/asset handling. The final review additionally exercises actual planner DOM events with a browser-like DOM and checks the live deployment with and without credentials. A rendered mobile browser visual review is still separate from these functional checks.

Native ESX, scanned-PDF OCR, automatic geometry extraction and live retailer stock are outside this first usable version.
