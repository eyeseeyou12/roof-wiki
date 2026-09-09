# Planner redesign — September 9, 2026

Implements the returned interface specification on top of PR #2. The calculator URL now opens a first-use planner with manual area entry or the existing PDF/CSV import/review flow. The former calculator is retained at calculator-advanced.html for the existing generic calculator/brand-filter workflows. Its formula module and import parser are unchanged.

## Implemented
- Compact header and desktop roof-context sidebar; mobile stacks naturally.
- Sloped roof area plus pitch or direct attic floor area; empty initial data.
- Multiple-pitch and overhang controls behind disclosures.
- Independent attic state, imports, editing, removing, and switching.
- Conditional ridge/static recommendations, sourced product shortlist, installed quantities and supporting intake recalculation when a candidate is selected.
- Actual intake/exhaust inventory, model-backed exhaust ratings or manually entered capacity, unknown versus none, mixed-exhaust warnings, and conditional additions.
- Calculation basis and eligibility links, without treating local code approval as automatic.
- Solar option with sourced GAF PRSOLAR2 specifications and exact published sizing rows. No interpolation where source guidance is inconsistent.

## Deliberate limits
Recommendation suitability is currently capacity/ridge based; roof material, geometry, installation and code requirements still need verification. No numerical brand ranking or unsupported best-product badge. The current shortlist has two GAF ridge products and one Lomanco static product; no unverified OC placeholder. Intake ratings are entered manually; a broader model catalog is still needed. Solar does not yet produce an automatic recommended count. The published solar coverage headline differs from its sizing table, so the UI retains both the limitation and manufacturer source instead of guessing.

PDF/CSV imported rows retain mandatory review, exclusions and attic assignments. Reliable geometric extraction, clickable diagrams, native ESX and scanned-PDF OCR remain unsupported; no pretend diagram is supplied. Shared measurements and inventories persist within the open page, not across reloads.

## Verification
Build, existing regression suite, new planner model tests, JavaScript syntax and static module/element checks. A temporary DOM simulation also passed manual entry, ridge changes, mode switching, imported-section callbacks and attic switching. No browser/visual QA performed in this session. Preview remains separate from production; do not merge without user direction.
