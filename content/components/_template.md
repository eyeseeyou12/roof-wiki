---
# Required: the display name shown in the app.
name: Example Component

# Optional, defaults to component. Rules are things like the 1/150 ratio
# or "don't mix exhaust types" — they govern components but aren't
# physical things themselves.
type: component

# Optional, defaults to draft. Flip to reviewed once you trust it.
status: draft

# Required: high, medium, or thin. THIN means "don't trust this yet" —
# it still builds, but treat it as flagged for review.
confidence: thin

# Optional list of category slugs. Leave empty if you're not sure yet —
# uncategorized entries are still searchable.
categories: []

# Optional. One alias per line. Plain syntax:
#   name (dialect)
#   name (dialect — a note about it)
# dialect is one of: field, manufacturer, code, adjuster, brand, descriptive.
#
# Two components can legitimately share an alias (e.g. "louver vent" is
# both a gable vent and a box vent) — that's handled with a confused_with
# link below, not by picking one here. Write the alias on both entries.
#
# Need a region tag, or more control than the plain syntax gives you? Use
# the long form instead of a plain string:
#   - name: 750
#     dialect: field
#     region: Central Texas
#     notes: Lomanco model number that became a generic name
aliases:
  - example alias one (field)
  - example alias two (manufacturer — a note if it's useful)

# Optional. One per line, "link_type: target-slug", optionally with a
# note after an em dash (—, not a plain hyphen — slugs have hyphens in
# them). link_type is one of:
#   governed_by   - this is governed by a rule, e.g. governed_by: intake-exceeds-exhaust
#   part_of       - this is part of a larger assembly
#   see_also      - related, not confusable
#   confused_with - genuinely gets mixed up with the target. Write this
#                   on only one side; the build script adds the reverse.
links:
  - see_also: some-other-slug

# Optional. Where this came from.
sources: manufacturer catalogs, trade forums
---

## Summary
The short answer someone reads first when they're stumped.

## Description
What it is.

## Function
What job it does on the roof.

## Replacement notes
What can stand in, what has to match, which direction the swap works.
Leave this section out entirely for rule entries — there's nothing to
replace.

## Measurement notes
What to go determine before ordering, and the common mistake.

## Failure modes
How it tends to fail. Optional.

## Disambiguation
Only fill this in if the term itself means more than one thing (see
"split boot", "attic fan", "self-flashing" in the inventory notes for
examples). Lead with "this term is used for more than one thing."
