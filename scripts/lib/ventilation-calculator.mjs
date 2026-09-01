// Ventilation sizing calculator. Isomorphic (no Node-only APIs) like
// query.mjs, so it can run in the browser once a UI wires it up.
//
// Grounded in IRC R806.2: baseline 1/150 net free area, with a
// narrower exception down to 1/300 gated on conditions that vary in
// exact wording between code editions (see content/components/
// attic-ventilation-ratio.md for the sourcing and the caveat). This
// module defaults to the conservative 1/150 ratio and only uses 1/300
// when the caller explicitly asserts the exception's conditions are
// met — it never guesses which applies.
//
// Per-unit NFA figures below are typical/reference values pulled from
// manufacturer spec pages and a published worked example during this
// session's research — not a fixed standard. Real products vary more
// than the single reference figure suggests (a real worked example
// cited ridge vent at 8 sq in/ft and soffit at 5 sq in/ft, against
// 18 and 9 from manufacturer spec pages for other products), so each
// figure carries the observed range alongside the reference value
// this module actually computes with. Every quantity this module
// returns is explicitly labeled as an estimate to verify against the
// spec sheet of whatever's actually chosen — describes what to
// determine, not what to buy, same as the rest of this app.

export const SQ_FT_PER_SQ_IN = 1 / 144;

// sq in NFA per reference unit. `reference` is what this module computes
// with; `observedRange` is the spread seen across real products during
// research, included so a UI can show "could need more" rather than
// presenting the reference figure as exact.
export const TYPICAL_NFA = {
  'ridge-vent': { perLinearFoot: 18, observedRangeLow: 8, observedRangeHigh: 20 },
  'static-roof-vent': { perUnit: 113, unitLabel: '12" throat' },
  'turbine-vent': { perUnit: 50, unitLabel: '12" throat' },
  'soffit-vent': { perLinearFoot: 9, unitLabel: 'continuous strip', observedRangeLow: 5, observedRangeHigh: 9 },
};

// Sized by CFM against attic volume, not NFA against floor area — a
// fundamentally different calculation this module doesn't attempt.
// Callers should list these as valid options without a quantity.
export const CFM_SIZED_COMPONENTS = ['powered-attic-ventilator', 'solar-attic-fan'];

export class VentilationCalculatorError extends Error {}

// A sloped roof plane at pitch rise/run covers more surface area than
// the horizontal attic floor beneath it. Roof measurement reports
// (aerial/photogrammetry services, e.g. Roofr, EagleView, Hover) give
// the sloped surface area, not attic floor area — feeding that number
// straight into calculateRequiredNfa overstates what's needed by a
// meaningful margin (about 8% at a 5/12 pitch, more at steeper
// pitches). This converts one roof plane's sloped area to its
// horizontal footprint: floorArea = roofArea * run / sqrt(rise^2 + run^2).
export function roofAreaToFloorArea(roofAreaSqFt, pitchRise, pitchRun = 12) {
  if (!Number.isFinite(roofAreaSqFt) || roofAreaSqFt <= 0) {
    throw new VentilationCalculatorError('roofAreaSqFt must be a positive number');
  }
  if (!Number.isFinite(pitchRise) || pitchRise < 0) {
    throw new VentilationCalculatorError('pitchRise must be a non-negative number');
  }
  const slopeFactor = Math.sqrt(pitchRise * pitchRise + pitchRun * pitchRun) / pitchRun;
  return round1(roofAreaSqFt / slopeFactor);
}

// A roof is often more than one pitch (this module's own test data
// includes a real report with 5/12 and 7/12 sections). Sum each
// segment's converted floor area separately rather than applying one
// pitch to the whole roof.
//
// Important limits on what this estimates, worth surfacing in any UI
// built on this: it assumes the whole roof footprint sits over
// attic space, which often isn't true — garages, cathedral/vaulted
// ceilings, and porches have roof area but no attic beneath them.
// Treat the result as a starting point, the same way the rest of this
// app treats "go measure" — not a substitute for an actual attic
// floor measurement when precision matters.
export function estimateAtticFloorAreaFromRoofSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new VentilationCalculatorError('segments must be a non-empty array of { roofAreaSqFt, pitchRise, pitchRun? }');
  }
  const total = segments.reduce(
    (sum, seg) => sum + roofAreaToFloorArea(seg.roofAreaSqFt, seg.pitchRise, seg.pitchRun ?? 12),
    0
  );
  return round1(total);
}

export function calculateRequiredNfa({ atticSquareFootage, exceptionConditionsConfirmed = false }) {
  if (!Number.isFinite(atticSquareFootage) || atticSquareFootage <= 0) {
    throw new VentilationCalculatorError('atticSquareFootage must be a positive number');
  }

  const ratio = exceptionConditionsConfirmed ? 300 : 150;
  const totalNfaSqIn = (atticSquareFootage / ratio) * 144;
  const exhaustNfaSqIn = totalNfaSqIn / 2;
  const intakeNfaSqIn = totalNfaSqIn / 2;

  return {
    ratioUsed: `1/${ratio}`,
    atticSquareFootage,
    totalNfaSqIn: round1(totalNfaSqIn),
    exhaustNfaSqIn: round1(exhaustNfaSqIn),
    intakeNfaSqIn: round1(intakeNfaSqIn),
  };
}

// Translates a required NFA into quantities per generic component
// class — e.g. "~4 static roof vents" or "~19 linear feet of ridge
// vent" — never a specific brand or SKU. Each option is independent:
// don't mix exhaust types on one attic (see the rule of that name),
// so this shows what it'd take to cover the requirement with ONE
// exhaust type, not a combination.
function estimateOption(component, requiredNfaSqIn, perUnitField) {
  const spec = TYPICAL_NFA[component];
  const perUnit = spec[perUnitField];
  const result = {
    component,
    quantity: Math.ceil(requiredNfaSqIn / perUnit),
    unit: spec.unitLabel ? `${perUnitField === 'perLinearFoot' ? 'linear feet' : 'units'} (${spec.unitLabel})` : perUnitField === 'perLinearFoot' ? 'linear feet' : 'units',
  };
  if (spec.observedRangeLow) {
    // Lower NFA per unit means more units needed — the conservative
    // (safer, never-under-ventilate) end of the observed range.
    result.quantityIfLowerNfaProduct = Math.ceil(requiredNfaSqIn / spec.observedRangeLow);
  }
  return result;
}

export function estimateExhaustOptions(exhaustNfaSqIn) {
  return [
    estimateOption('ridge-vent', exhaustNfaSqIn, 'perLinearFoot'),
    estimateOption('static-roof-vent', exhaustNfaSqIn, 'perUnit'),
    estimateOption('turbine-vent', exhaustNfaSqIn, 'perUnit'),
  ];
}

export function estimateIntakeOptions(intakeNfaSqIn) {
  return [estimateOption('soffit-vent', intakeNfaSqIn, 'perLinearFoot')];
}

// Separated attic spaces (a garage attic cut off by a firewall, an
// addition that isn't actually open to the original attic) each need
// their own ventilation calculation — see the separated-attic-spaces
// rule for how to recognize one. This runs calculateRequiredNfa
// independently per section rather than summing square footage into
// one shared number, which is exactly the mistake that rule warns
// against: a combined total can look adequate while one isolated
// section is still under-ventilated.
export function calculateForSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new VentilationCalculatorError('sections must be a non-empty array of { label, atticSquareFootage, exceptionConditionsConfirmed? }');
  }
  const results = sections.map((section) => ({
    label: section.label ?? null,
    ...calculateRequiredNfa(section),
  }));
  return {
    sections: results,
    // Informational only — sq ft/NFA totaled across sections for a
    // materials-quantity view. Never use this combined total to size
    // or balance any single section's vents.
    combinedTotalNfaSqIn: round1(results.reduce((sum, r) => sum + r.totalNfaSqIn, 0)),
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
