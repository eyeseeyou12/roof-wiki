# Roof-Wiki Ventilation Planner

## Optimized Interface Specification

## 1. Design Direction

The ventilation calculator should behave like a **guided planning and recommendation application**, not a technical questionnaire.

The interface progressively answers:

1. **What attic are we working with?**
2. **What ventilation approach appears best suited to it?**
3. **Which products are good candidates for that approach?**
4. **Can the available intake support it?**
5. **What should be verified or changed before installation?**

The system should provide useful professional guidance without implying that a calculator can identify the single objectively correct product for every roof.

The design should therefore distinguish between:

- **Recommended approach**
- **Strong product matches**
- **Suitable alternatives**
- **Conditions still requiring verification**

Technical information remains available, but secondary.

There should NOT be separate Beginner and Professional modes.

Instead:

- Primary language is plain English.
- Professional values remain visible where useful.
- Advanced inputs appear only when relevant.
- Detailed calculations, manufacturer data, code basis, assumptions, and sources expand on demand.

---

# 2. Core Recommendation Philosophy

The system should be **confident about calculations where the data supports confidence**, while remaining appropriately non-deterministic about product and system selection.

For example:

Bad:

**The correct product is GAF Cobra Rigid Vent 3.**

Better:

**Continuous ridge ventilation is the preferred approach based on the information provided.**

Then:

### Strong product matches

**GAF Cobra Rigid Vent 3**
Approximately **48 LF**

**Owens Corning VentSure Ridge Vent**
Approximately **XX LF**

**Lomanco OmniRidge Pro**
Approximately **XX LF**

One product may receive:

**Best match based on current information**

but should not be presented as universally superior.

---

# 3. Recommendation Language

Use recommendation strength rather than absolute conclusions.

Preferred status language:

**Strong fit**

**Good fit**

**Suitable option**

**Possible alternative**

**More information needed**

**Not favored with current conditions**

**Unable to evaluate**

Avoid:

**Correct**

**Perfect**

**Optimal product**

**Only option**

unless an actual manufacturer or code requirement makes the conclusion deterministic.

---

# 4. Overall Application Structure

## Header

Keep the workspace header compact.

Left:

**roof-wiki**

**Ventilation Planner**

Right:

**Reference**

Search icon or compact search action

The wiki's large search field should not dominate the calculator workspace.

---

# 5. Page Header

# Ventilation Planner

Supporting text:

**Find ventilation approaches that fit this attic and verify that the intake can support them.**

Below:

**Plan a new system** | **Check existing system**

Use a segmented control.

Switching modes preserves shared measurements.

---

# 6. Desktop Layout

After measurements exist, use two primary areas.

## Left — Roof Context

Approximately 260–290 px.

Compact, optionally sticky.

Contains only the information needed to understand what is currently being evaluated.

## Right — Recommendation Workspace

Contains:

Recommended approach

Product recommendations

Verification requirements

Intake assessment

Suitable alternatives

Detailed calculations and sources

The page should not resemble a dashboard containing equally weighted cards.

There must be an obvious answer hierarchy.

---

# 7. First-Use Experience

Do not open with example recommendations.

Show:

# Start with your roof

**Upload a measurement report or enter the attic size manually.**

Two actions:

### Upload roof report

**Use measurements from a supported roof measurement report.**

**Choose report**

### Enter measurements

**Enter roof area or known attic floor area yourself.**

**Enter area**

Do not initially expose:

Roof segments

Pitch-run inputs

CSV instructions

Ventilation ratios

NFA calculations

Overhang corrections

Products

Solar settings

---

# 8. Manual Measurement Entry

Question:

### What area do you know?

Options:

**Sloped roof area**

Use roof surface measurements from a measurement report or measuring tool.

**Attic floor area**

Use this when the actual attic floor area is already known.

---

## Sloped Roof Area

Show:

**Roof area**

[ 2,000 ] sq ft

**Roof pitch**

[ 6/12 ▼ ]

Then optionally:

**Multiple pitches?**

This reveals advanced segment controls only when needed.

Primary action:

**Use measurements**

---

## Attic Floor Area

Show:

**Attic floor area**

[ 1,790 ] sq ft

No pitch field.

Primary action:

**Use measurements**

---

# 9. Roof Summary

Once entered, collapse the editor.

### Main attic

# 1,790 sq ft

Attic floor area

**Calculated from 2,000 sq ft sloped roof area · 6/12**

Actions:

**Edit**

**Use roof report instead**

If imported:

**Imported from roof report**

If manually overridden:

**Edited**

---

# 10. Progressive Roof Questions

Only request measurements when they can materially affect the recommendation.

Example:

### One more measurement would improve this recommendation

**How much usable ridge serves this attic?**

[ 52 ] ft

**I don't know**

If unknown, the system should continue where reasonable.

It might show:

**Ridge ventilation appears promising, but available ridge length still needs verification.**

The user should not have to complete a comprehensive roof inspection questionnaire before receiving value.

---

# 11. Primary Recommendation

The primary result should be the largest visual section.

### Recommended approach

# Continuous ridge ventilation

**Strong fit**

**Based on the attic size and roof information provided, a balanced ridge-and-intake system appears well suited to this roof.**

Then show the major sizing result:

**Approximate exhaust requirement**

# 860 sq in NFA

and:

**Supporting intake target**

# 860 sq in NFA

Where applicable.

---

# 12. Why This Approach Is Recommended

Directly beneath the recommendation:

### Why we're suggesting this

Example:

- Adequate ridge appears available.
- The system can provide distributed high-level exhaust.
- The roof geometry appears compatible with continuous ridge exhaust.
- Passive exhaust avoids introducing powered depressurization into the attic.

Only show reasons actually supported by the inputs and recommendation logic.

Do not produce generic reasons that appear for every roof.

---

# 13. What Could Change the Recommendation?

Provide a small disclosure:

**What could change this recommendation?**

Potential items include:

Usable ridge length

Disconnected attic spaces

Available intake

Blocked soffit pathways

Roof geometry

Manufacturer installation requirements

Local code requirements

Existing exhaust configuration

Solar exposure for solar-powered options

This reinforces that the tool is providing informed planning guidance rather than declaring an absolute engineering conclusion.

---

# 14. Product Recommendations

Product selection should be presented as a shortlist rather than a single mandatory answer.

Heading:

# Product recommendations

Supporting text:

**These products appear suitable for the recommended approach based on the available specifications.**

Prefer approximately 2–4 candidates when sufficient verified product data exists.

---

## Primary Product Match

A product may lead when it has a meaningful advantage for the current project.

Example:

### Best match based on current information

**GAF**

# Cobra Rigid Vent 3

18 sq in NFA / linear ft

**Approx. 48 linear ft**

Why it ranks highly:

**Provides the required exhaust capacity within the currently entered usable ridge length.**

Actions:

**Product details**

**Manufacturer source**

---

## Additional Suitable Products

### Owens Corning

**VentSure Ridge Vent**

**Approx. XX linear ft**

**Good fit**

Reason:

**Comparable continuous ridge solution and especially relevant when using an Owens Corning roofing system.**

---

### Lomanco

**OmniRidge Pro**

**Approx. XX linear ft**

**Good fit**

Reason:

**Meets the required capacity with an appropriate installed length based on published product data.**

---

# 15. Product Ranking

Product ranking should consider applicable information rather than merely comparing maximum airflow or NFA.

Potential ranking factors:

Required installed length

Available usable ridge

Manufacturer compatibility

Roofing-system compatibility

Product application limitations

Installation method

Verified capacity data

Availability of manufacturer documentation

Required intake

Packaging / practical installation quantities

Known roof geometry

Product-specific conditions

The interface does not need to expose a numerical ranking algorithm.

Instead explain the most relevant reason.

Example:

**Best match because it meets the calculated requirement using 46 ft of the available 52 ft ridge.**

---

# 16. Avoid Fake Precision

Do not display recommendation percentages such as:

**92% match**

unless a meaningful, validated scoring methodology exists.

Use descriptive statuses instead.

For example:

**Strong fit**

**Good fit**

**Conditionally suitable**

**Needs verification**

These are easier to understand and do not imply unsupported precision.

---

# 17. Product Quantities

Calculated quantities may be precise even when the recommendation itself is not absolute.

For example:

**Calculated minimum: 47.7 LF**

**Recommended installed amount: 48 LF**

or:

**Purchase quantity: 5 × 10-ft sections**

when packaging data is verified.

Clearly distinguish:

Calculation

Installed recommendation

Purchase quantity

---

# 18. Intake Verification

Directly beneath the recommendation:

# Intake

Initial status:

**Not checked**

Supporting text:

**The recommended exhaust approach requires approximately 864 sq in of supporting intake capacity.**

Action:

**Check existing intake**

---

# 19. Intake Editor

Question:

### What intake is currently installed?

Options:

**Vented soffit**

**Individual soffit vents**

**Continuous soffit vent**

**Roof intake vent**

**Other**

**No intake**

**Not sure**

"No intake" and "Not sure" must remain different.

The next field changes with the selected type.

Examples:

Individual vents:

**Number of vents**

Continuous product:

**Installed length**

Known product:

**Manufacturer / model**

Optional:

**Known rated net free area**

---

# 20. Intake Result

Example:

### Intake capacity

**620 sq in available**

**864 sq in target**

### Additional intake needed

# Approx. 244 sq in

Where product information supports conversion:

**Equivalent to approximately 14 additional linear ft of the selected intake product.**

Then:

**Rated capacity is only one part of intake performance. Verify that the intake openings, baffles, and airflow pathway are clear.**

---

If the numerical target is achieved:

### Rated intake target met

**912 sq in available**

**864 sq in target**

Supporting text:

**The published capacity meets the calculated target. Installation, distribution, and airflow pathways still require field verification.**

Do not simply declare:

**Ventilation is adequate.**

---

# 21. Alternative Ventilation Approaches

Below the primary recommendation:

# Other suitable approaches

Collapsed initially.

Alternatives should not receive equal prominence unless the recommendation engine cannot meaningfully distinguish between them.

Example:

### Solar-powered exhaust

**Suitable alternative**

**May be useful where ridge exhaust cannot be established or where powered ventilation is otherwise preferred. Adequate intake and suitable solar exposure must be confirmed.**

**Explore solar option**

---

### Static box vents

**Possible alternative**

**Can provide adequate passive exhaust, but may require more roof penetrations than a continuous ridge system.**

---

# 22. Cases With Multiple Equally Good Approaches

The system should not artificially choose a winner.

Example:

### Two approaches fit this roof well

**Continuous ridge ventilation**

Strong fit

and

**Static roof exhaust**

Strong fit

Then explain the tradeoff.

Example:

**Ridge ventilation provides more distributed exhaust. Static vents may be preferable if usable ridge length is limited or ridge construction prevents continuous vent installation.**

This is preferable to pretending one system is definitively superior.

---

# 23. Solar Fan Recommendations

Solar products participate in the same recommendation process.

The initial form should NOT ask:

Passive

Powered

Solar

The calculator evaluates them.

If solar is strongly supported:

### Recommended approach

# Solar-powered attic exhaust

**Strong fit**

Then:

### Product recommendations

**Solar Royal 35W**

Approx. **2 units**

or other verified models.

The quantity must follow the manufacturer's actual sizing methodology.

Show where relevant:

Published airflow

Attic coverage

Required intake

Fan count

Control behavior

Solar exposure requirements

Backup power information

Installation limitations

Manufacturer source

---

# 24. Solar Recommendation Language

Avoid:

**You need two Solar Royal fans.**

Prefer:

**Based on the manufacturer's published sizing guidance, two units appear appropriate for the attic area entered. Verify available intake and solar exposure before finalizing the system.**

If conditions are incomplete:

### Solar remains an option

**Additional information is needed before a specific fan quantity can be recommended.**

Then show the missing information.

---

# 25. Existing-System Assessment

Roof measurement entry stays consistent with new-system planning.

Then ask:

# What's installed now?

## Exhaust

**Add exhaust**

Fields:

Type

Quantity or length

Optional manufacturer/model

Optional rated capacity

Action:

**+ Add another exhaust type**

Then:

## Intake

Use the same inventory component.

Action:

**+ Add another intake type**

---

# 26. Existing-System Assessment Result

The assessment should distinguish calculations from recommendations.

Example:

### Exhaust capacity

**Below calculated target**

560 sq in available

864 sq in target

### Intake capacity

**Rated target met**

920 sq in available

864 sq in target

### Assessment

# Exhaust appears to be the limiting side of the system.

Then:

### Recommended improvement

**Continuous ridge ventilation appears to be a strong replacement approach based on the current roof information.**

Follow with several appropriate product recommendations rather than one mandatory product.

---

# 27. Mixed Existing Exhaust Types

If the user enters multiple exhaust types, do not automatically imply that they should operate together.

Example:

### Existing configuration needs review

**This attic contains both ridge ventilation and powered exhaust.**

Supporting text:

**These systems can interact with each other. Review the configuration before assuming their published capacities can simply be combined.**

The recommendation engine may suggest simplifying or modifying the setup where appropriate.

---

# 28. Separate Attic Spaces

Default:

**One attic**

Secondary action:

**+ Add separate attic space**

Help text:

**Use this when areas are physically separated and attic air cannot move freely between them.**

Once created:

**Main attic**

**Garage attic**

**Rear addition**

Each receives independent:

Area

Geometry

Existing exhaust

Existing intake

Recommended approach

Product recommendations

Intake assessment

No capacity may be transferred between disconnected spaces.

---

# 29. Roof Report Import

Sequence:

### Upload

Choose supported file.

### Processing

**Reading roof measurements…**

### Review

Show primary extracted information.

Example:

### Measurements found

**Roof area**
3,428 sq ft

**Predominant pitch**
7/12

**Ridge**
64 ft

**Eaves**
186 ft

**Imported from Roofr report**

Actions:

**Use measurements**

**Review details**

Do not expose file-format documentation during normal operation.

---

# 30. Imported Measurement Review

Advanced information is placed behind:

**Review roof sections**

Possible contents:

Individual facets

Multiple pitches

Ridge segments

Eaves

Excluded areas

Imported geometry

Do not require approval of every facet unless necessary for attic assignment.

---

# 31. Attic Assignment From Diagram

If trustworthy report geometry exists:

# Which roof areas serve this attic?

Select roof sections.

Current assignment:

**Main attic · 1,820 sq ft assigned**

Actions:

**Assign selected**

**Create separate attic**

**Exclude from attic**

States:

**MAIN ATTIC**

**REAR ATTIC**

**EXCLUDED**

**UNASSIGNED**

Do not rely on color alone.

Ask:

### Are these roof areas connected inside the attic?

**Yes**

**No**

**Not sure**

A roof face is not automatically an independent attic.

---

# 32. Diagram Fallback

If reliable geometry does not exist:

### We found roof measurements, but individual roof areas couldn't be identified reliably.

Options:

**Use the full roof area**

**Enter attic area manually**

**Create separate attic areas manually**

A report image may still be shown as a visual reference.

Do not pretend manually drawn annotations constitute precise measurement extraction.

---

# 33. Why We're Suggesting This

Every major recommendation should have a concise explanation available.

Examples:

**Why ridge ventilation?**

**Why this product?**

**Why isn't solar ranked first?**

**Why is more intake needed?**

Answers should be generated from the actual reasoning used.

This is especially useful for professional users explaining a recommendation to a homeowner.

---

# 34. Technical Calculation Disclosure

Near the bottom:

**How this was calculated**

Collapsed by default.

Expanded example:

Roof surface area
2,000 sq ft

Pitch
6/12

Estimated attic floor area
1,789 sq ft

Ventilation basis
1:150

Total ventilation target
1,718 sq in NFA

Target intake
859 sq in NFA

Target exhaust
859 sq in NFA

Product capacity
18 sq in NFA / LF

Calculated product amount
47.7 LF

Suggested installed amount
48 LF

Then:

**Assumptions**

**Eligibility conditions**

**Manufacturer data**

**Code/source basis**

---

# 35. Professional Layer

Professional users should be able to quickly identify:

**1,790 sq ft attic**

**1:150 basis**

**859 sq in target exhaust**

**864 sq in selected product capacity**

**18 sq in NFA/LF**

**48 LF**

without forcing less experienced users to interpret those numbers.

These values can sit under or beside the plain-English recommendation.

---

# 36. Always Visible

Current attic

Area

Plan/check mode

Recommended approach

Recommendation strength

Key reason

Product shortlist

Approximate installed quantities

Required supporting intake

Current intake status

Unresolved critical condition

Primary next action

---

# 37. Reveal on Demand

Detailed roof facets

Multiple pitch calculations

Manual roof segments

Overhang corrections

Alternative systems

Full product specifications

Packaging detail

Manufacturer sources

Code basis

Calculation formulas

NFA derivation

Solar operating details

Installation-condition checklist

Advanced assumptions

---

# 38. Important Empty and Error States

### No measurements

# Start with your roof

Upload a report or enter an area manually.

---

### Unknown ridge

**Ridge ventilation may be suitable, but available ridge length hasn't been confirmed.**

**Enter ridge length**

**I don't know**

---

### Insufficient ridge

**There isn't enough usable ridge for the calculated amount of this product.**

**View other suitable approaches**

---

### Unknown intake

**Existing intake hasn't been evaluated yet.**

**Check intake**

---

### No intake

**No intake ventilation is currently installed.**

**The suggested exhaust approaches require supporting intake.**

**View intake options**

---

### Unsupported report

**We can't reliably read this file format yet.**

**Try another report**

**Enter measurements manually**

---

### Product data incomplete

**This product may be suitable, but its capacity data hasn't been verified sufficiently for exact sizing.**

---

### Recommendation changed

**The roof information changed, so the recommendations have been updated.**

---

# 39. Stale-State Rules

Changing attic area:

Recalculate ventilation targets.

Recalculate product quantities.

Recalculate intake comparison.

Re-rank products when applicable.

Changing pitch:

Recalculate floor-area estimate and all dependent calculations.

Changing usable ridge:

Re-evaluate ridge system suitability.

Re-rank ridge products.

Potentially change the recommended approach.

Changing attic assignment:

Invalidate affected attic recommendations.

Changing exhaust product:

Recalculate installed quantity and intake requirement.

Changing intake product:

Recalculate available intake.

Changing generic product information to an exact model:

Replace estimated capacity with manufacturer-verified data where available.

Do not silently retain obsolete results.

---

# 40. Mobile Layout

Single column.

Order:

Header

Mode selector

Roof summary

Recommended approach

Why it fits

Product recommendations

Required intake

Intake status

Other suitable approaches

Calculation details

Roof summary:

### Main attic

**1,790 sq ft · 6/12**

**Edit**

Product cards stack vertically.

Do not squeeze product model and quantity into narrow side-by-side columns.

---

# 41. Visual Style

The application should feel like clean technical software.

Use:

Neutral background

Light surfaces

Dark readable typography

One restrained accent color

Quiet borders

Minimal shadows

10–12 px radii

16 px body typography

14 px secondary typography

Large recommendation headings

Large quantities

Generous spacing

Avoid:

Large decorative hero areas

Excessive cards

Nested borders

Huge input boxes

Long instructions above controls

Dashboard statistics

Marketing-style graphics

---

# 42. Final Product Decisions

Treat these as established:

The interface is recommendation-first.

The tool recommends; it does not pretend to make an absolute product decision.

One ventilation approach may lead when the evidence meaningfully favors it.

Several equally strong approaches may be shown when appropriate.

Product recommendations are a shortlist.

A product may be labeled **Best match based on current information**.

Products receive concise reasons for their ranking.

New-system users do not select exhaust type before receiving recommendations.

Manual measurements and report upload are both prominent.

Sloped roof area and attic floor area remain distinct.

Pitch is requested only where required.

Segments remain an advanced fallback.

Intake and exhaust are evaluated together.

Separate attics remain independent.

Existing-system mode evaluates actual exhaust and actual intake.

Solar products participate in recommendations.

Solar quantities use manufacturer-specific methodology.

CFM and passive NFA remain separate.

Unknown information results in verification requests rather than invented certainty.

Technical reasoning remains accessible.

---

# 43. Still Open

Do not hard-code these solely from the design:

Exact recommendation weighting

How products are ranked when several qualify

Applicable local code interpretation

1:150 versus 1:300 eligibility

Final product database

Generic capacity assumptions

Current supported import formats

Native ESX support

Reliable ridge extraction capability

Exact solar manufacturer logic

Persistence between sessions

Saved projects

PDF/export functionality

Final accent color

These require implementation review, verified technical sources, or further product decisions.

---

# 44. Acceptance Test

A user opens the planner.

Selects:

**Plan a new system**

Chooses:

**Enter measurements**

Enters:

**2,000 sq ft**

Selects:

**6/12**

The application calculates the appropriate working attic area.

Where necessary it asks for one meaningful additional condition, such as usable ridge.

Then it displays:

### Recommended approach

**Continuous ridge ventilation**

**Strong fit**

Followed by:

### Product recommendations

**GAF Cobra Rigid Vent 3**
Approx. 48 LF
**Best match based on current information**

**Owens Corning VentSure Ridge Vent**
Approx. XX LF
**Good fit**

**Lomanco OmniRidge Pro**
Approx. XX LF
**Good fit**

The user can see why each was recommended.

The user selects:

**Check intake**

Enters existing intake information.

The calculator displays:

**Rated intake target met**

or

**Additional intake needed**

and provides an actionable quantity when supported.

The user can then expand:

**Other suitable approaches**

**Why we're suggesting this**

**What could change this recommendation?**

**How this was calculated**

At no point must the ordinary user interact with roof-facet tables, rise/run fields, NFA formulas, CSV schemas, product-database fields, or code paragraphs unless they intentionally request those details.

The result should feel like a knowledgeable roofing professional saying:

**“Based on what we know about this roof, this is the approach I would consider first, and these are the products that appear to fit it best.”**

—not:

**“The calculator has determined that this is the only correct answer.”**