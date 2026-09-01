---
name: Attic ventilation ratio (1/150 and 1/300)
type: rule
confidence: medium
aliases:
  - NFA (field)
  - net free area (manufacturer)
  - NFVA (manufacturer)
links:
  - see_also: intake-must-equal-or-exceed-exhaust
sources: IRC R806.2 (2021 edition text, via up.codes); a municipal (West University Place, TX) attic ventilation worksheet quoting older code text with a worked example; ARMA (asphaltroofing.org); GAF's public ventilation calculator page, used only as a corroborating source — its own framing of 1/300 as the default and 1/150 as an extra some codes require has it backwards relative to the actual code text, and is not what this entry follows
---

## Description
The baseline requirement is 1/150: one square foot of net free ventilating area (NFA, sometimes NFVA) for every 150 square feet of vented attic floor space. A narrower exception permits reducing that to 1/300 when specific conditions are met. Both sources checked for this entry require a vapor-retarder condition together with a vent-placement condition (roughly half the ventilating area positioned in the upper portion of the attic, well above the eave vents) — but the exact wording of the vapor-retarder condition differs between them: the 2021 IRC text found ties it to specific climate zones, while an older code text quoted in a municipal worksheet has no climate-zone restriction at all, just a vapor retarder rated at or below 1 perm (ASTM E96). Whichever ratio applies, the required NFA is split: roughly half positioned high (exhaust side), the balance at the eaves (intake side).

## Function
This is the number a ventilation calculation starts from, and the one most likely to get argued over at inspection. Both conditions of the 1/300 exception have to be met, not just one — but which conditions those actually are depends on which code edition and local amendments are in force, and this entry has now seen two real sources state that differently. Default to 1/150 unless the exception is confirmed against the actual adopted code, not against a manufacturer's calculator default.

## Measurement notes
To size a job: total attic floor square footage (length x width, not roof area), whether a Class I or II vapor retarder is installed on the warm side of the insulation, and which code edition (and any local amendments) the jurisdiction has adopted — that decides whether the 1/300 exception is even available and what it actually requires. The common mistake is defaulting to 1/300 because that's what a manufacturer's calculator defaults to, without checking whether the exception's conditions are actually met.

## Failure modes
A worked example from a municipal source (1200 sq ft attic, 1/150) computed 8 sq ft = 1152 sq in required — confirms the arithmetic here (attic sq ft ÷ ratio × 144 = required sq in NFA), but the same source's example also shows real installed vent counts calculated from real product NFA ratings that vary well outside any single "typical" figure (their ridge vent example used 8 sq in per linear foot; a manufacturer spec page found separately cited 18). Any calculation using a single reference NFA-per-unit figure is an estimate, not a guarantee — verify against the actual product's rated NFA before finalizing a count.
