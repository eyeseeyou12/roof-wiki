roof-wiki — inventory, batch 3: the intake side

Entries 17–22, plus one design question at the end that I think matters more than
any single entry here.

Everything in batches 1 and 2 that exhausts air says "requires intake." This is
what those link to.

----------------------------------------------------------------------

17. Soffit vent

Canonical: soffit vent
Aliases: eave vent (field), under-eave vent (manufacturer), continuous soffit
vent (manufacturer), soffit strip vent (manufacturer), strip vent (field),
Cirk-L-Vent (brand — Lomanco, for the round type), circle vent (field), rectangular
soffit vent (field), vented soffit panel (manufacturer)

What it is: Intake vent in the underside of the roof overhang.

Function: Brings outside air in at the low end so exhaust at the top has
something to pull. Nearly every ventilation complaint traces back here.

Forms you'll encounter:
1. Continuous strip — runs the length of the soffit. Vinyl, aluminum, or
   galvanized. Widths roughly 2"–8", panels up to about 10 feet, joined end to end.
   Best airflow.
2. Individual — rectangular or round vents cut in at intervals with solid
   soffit between.
3. Vented soffit panel — the whole panel is perforated. Also comes in
   center-vented (only the middle strip perforated) and solid, which vents nothing
   and is the source of a lot of confusion: a house can look like it has vented
   soffit and have zero intake.

What varies (go determine):
- Soffit width and depth available.
- Whether the existing soffit is vinyl, aluminum, or wood.
- Whether the vent is actually open behind the panel — this is the thing to check
  and the most common defect. Insulation stuffed into the eave, or a soffit
  installed over solid sheathing that was never cut, means the vent is decorative.

Replacement direction: Match material and width. Continuous is the upgrade from
individual. Nothing about the swap is difficult; the question is almost always
whether there's an open path behind it.

Failure modes: Painted shut. Blocked by blown insulation. Never cut open behind
the panel. Screens clogged with debris, wasps, or overspray.

Confidence: HIGH

----------------------------------------------------------------------

18. Over-fascia vent

Canonical: over-fascia vent
Aliases: fascia vent (field), fascia strip vent (manufacturer), vented fascia
(field), roof edge vent (manufacturer)

What it is: Intake vent that sits at the top of the fascia board, under the
roof edge, instead of in the soffit.

Function: Intake for houses with little or no overhang — where there's no
soffit to vent.

What varies (go determine):
- Fascia dimensions and whether there's clearance to cut the top of the board down
  below the deck.
- Whether a gutter is in the way.
- Net free area per foot, which is low compared to soffit — these are typically
  around a half inch of opening height, and how much air actually moves through
  them is debated in the trade.

Replacement direction: This is the go-to when there's no soffit. Not a
substitute for soffit venting when soffit is available — it's the fallback.

Confidence: MEDIUM-HIGH. The performance skepticism is real and worth
representing as a live disagreement rather than a fact.

----------------------------------------------------------------------

19. Drip edge vent

Canonical: vented drip edge
Aliases: drip edge vent (field), edge vent (manufacturer), starter vent
(manufacturer — Lomanco's SV-10 term), intake edge (field)

What it is: Drip edge with intake slots built into it, doing two jobs at once —
water shedding at the eave and air intake.

Function: Intake on houses with no overhang at all, or as a retrofit where
cutting soffit isn't feasible.

Note worth putting in the entry: Opinions in the trade range from "good
retrofit option" to "last resort." Both positions are common. The app should say
that rather than pick.

What varies (go determine): Roof covering, eave detail, whether there's an
existing drip edge to replace, gutter interference.

Replacement direction: A vented drip edge substitutes for a plain one, but
plain drip edge does not substitute for it if the vented unit was the house's only
intake. That's an asymmetric swap and exactly the kind of thing that needs the
direction field.

Confidence: MEDIUM-HIGH

----------------------------------------------------------------------

20. Gable vent

Canonical: gable vent
Aliases: gable end vent (field), louver vent (field — collides with the box
vent alias, flag it), attic louver (field), triangle vent (field), octagon vent
(field)

ALIAS COLLISION — note for the schema. "Louver vent" is used for both gable
vents and box vents. Two different components, same field term. This is the first
case in the inventory where one alias legitimately points at two components, and
it's a good test of whether the alias table handles ambiguity. It should return
both and ask.

What it is: Vent in the vertical gable wall of the attic, not in the roof plane.

Function: Depends entirely on what else is on the roof. Can act as intake, as
exhaust, or as a short-circuit that ruins a ridge vent system.

What varies (go determine): Rough opening size, shape (rectangular, triangular,
octagonal, half-round), material, whether it's functional or purely decorative.

Replacement direction: Match opening and shape. The harder question is whether
it should be replaced or blocked off — see the concept note below.

Confidence: HIGH on the hardware, and the "should it stay open" question is
genuinely unsettled, which the entry should say.

----------------------------------------------------------------------

21. Shingle-over intake vent

Canonical: shingle-over intake vent
Aliases: smart vent (brand — DCI, partly genericized), roof-top intake vent
(manufacturer), low-profile intake (manufacturer)

What it is: Intake installed in the roof plane a short distance up from the
eave, shingled over so it's nearly invisible.

Function: Intake where soffit, fascia, and drip edge options are all blocked —
closed eaves, cathedral ceilings, additions, complicated eave details.

What varies (go determine): Roof covering, distance from the eave, deck cut
requirements.

Replacement direction: The problem-solver option when nothing else works. More
expensive and more invasive than soffit.

Confidence: MEDIUM. Less common in the field than the others, but the term
comes up.

----------------------------------------------------------------------

22. Baffle

Canonical: insulation baffle
Aliases: rafter vent (manufacturer), vent chute (field), chute (field),
insulation stop (manufacturer), proper vent (brand, genericized), air chute (field)

What it is: Rigid or foam channel stapled between rafters at the eave that
holds an air gap open between the insulation and the roof deck.

Function: Keeps blown insulation from burying the soffit vent. Not visible from
outside, which is why this is the one intake component people never think about.

Why it belongs in the wiki even though it's not on the roof: When someone says
"my soffit vents don't work," the answer is very often a missing or crushed baffle.
The app should be able to get from a soffit vent question to this.

What varies (go determine): Rafter spacing (16" or 24" on center), material
(cardboard, foam, plastic), depth of insulation.

Confidence: HIGH

----------------------------------------------------------------------

The design question this batch raises

Writing these surfaced something the schema doesn't handle, and I'd rather flag it
than quietly work around it.

Several things in this batch aren't components at all. They're rules that govern
components:

- Intake should equal or exceed exhaust. Never the reverse — if exhaust exceeds
  intake, the system pulls air from the conditioned space through can lights and
  attic hatches.
- Don't mix exhaust types on one attic. Ridge vent plus box vents, or ridge vent
  plus a power fan, can short-circuit each other.
- The 1/150 and 1/300 ratios, and the conditions under which the reduced one
  applies.
- Never use an exhaust vent as intake unless it's rated for both.

Every one of those changes the answer to "what can replace this," and none of them
lives on any single component. Right now they'd have to be copy-pasted into a
dozen replacement_notes fields, where they'd drift apart the moment you edit one.

Three options as I see them:

1. Concept entries. Same component table, a type flag distinguishing "thing"
   from "rule." Cheapest change. Concepts get aliases too — someone will search
   "net free area" and "NFA."
2. A separate notes table linked many-to-many to components. Cleaner
   separation, one more table.
3. Leave it in prose per component and accept the duplication for now, on the
   theory that fifty entries will tell you the answer better than we can guess it.

Given that we already simplified once for good reason, option 3 is defensible. But
this is different from the earlier simplification: back then I was inventing
structure for content that didn't exist. Now the content exists and it doesn't fit.
Option 1 is a small change and I'd lean toward it.

Your call. I'd also note the ratio numbers are the one place in this whole
inventory where being wrong has real consequences — someone sizing ventilation off
a bad number fails an inspection. Whatever holds them should be the part you review
hardest.

----------------------------------------------------------------------

Now genuinely uncovered

- Chimney flashing (step, counter, cricket)
- Roof-to-wall, headwall, kickout
- Valley metal
- Drip edge (the plain kind) and rake edge
- Hip and ridge cap, starter strip
- Bird block / vented blocking at the eave
- Dead-air or unvented (hot roof) assemblies, where none of the above applies
