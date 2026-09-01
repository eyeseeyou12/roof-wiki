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

// Three ways to arrive at atticSquareFootage for calculateRequiredNfa,
// in increasing order of precision — all optional, none required:
//   1. Roof segments only (estimateAtticFloorAreaFromRoofSegments):
//      corrects for pitch, nothing else. The system's best-effort
//      default when only a roof report is available.
//   2. Roof segments + eave length + overhang depth (this function):
//      also corrects for the overhang — aerial roof measurements are
//      taken to the outer roofline, which extends past the exterior
//      walls by the overhang depth, and that strip isn't attic space.
//      Both eaveLengthFt and overhangDepthFt are optional; the
//      correction is skipped (not estimated) if either is missing,
//      since guessing an overhang depth would be inventing a number.
//   3. Direct entry: skip both of the above and pass a known/measured
//      atticSquareFootage straight to calculateRequiredNfa — the
//      fallback when there's no roof report at all.
//
// The correction approximates the overhang as a strip of uniform
// depth along the eaves only (not rakes, hips, or valleys, which
// typically carry little or no overhang), using eaveLengthFt *
// overhangDepthFt. That slightly over-subtracts at corners, where the
// strip overlaps itself — a minor effect at typical overhang depths
// relative to typical house dimensions, not corrected for here.
export function estimateAtticFloorArea({ segments, eaveLengthFt = null, overhangDepthFt = null }) {
  const pitchOnlyEstimate = estimateAtticFloorAreaFromRoofSegments(segments);

  if (eaveLengthFt == null || overhangDepthFt == null) {
    return {
      atticSquareFootage: pitchOnlyEstimate,
      method: 'pitch-only',
      overhangCorrectionApplied: false,
    };
  }

  if (!Number.isFinite(eaveLengthFt) || eaveLengthFt <= 0) {
    throw new VentilationCalculatorError('eaveLengthFt must be a positive number');
  }
  if (!Number.isFinite(overhangDepthFt) || overhangDepthFt < 0) {
    throw new VentilationCalculatorError('overhangDepthFt must be a non-negative number');
  }
  if (overhangDepthFt > 10) {
    // Real overhangs run roughly 6 inches to 3 feet. A value this
    // large almost certainly means inches were entered where feet
    // were expected — better to reject than silently produce a
    // wildly wrong (or negative-clamped) estimate.
    throw new VentilationCalculatorError('overhangDepthFt looks too large to be feet — check units (did you mean inches?)');
  }

  const overhangAreaSqFt = eaveLengthFt * overhangDepthFt;
  const corrected = round1(Math.max(pitchOnlyEstimate - overhangAreaSqFt, 0));

  return {
    atticSquareFootage: corrected,
    method: 'pitch-and-overhang',
    overhangCorrectionApplied: true,
    pitchOnlyEstimate,
    overhangAreaSqFt: round1(overhangAreaSqFt),
  };
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

const EXHAUST_COMPONENTS = ['ridge-vent', 'static-roof-vent', 'turbine-vent'];
const INTAKE_COMPONENTS = ['soffit-vent'];

// Translates a required NFA into quantities for a specific brand's
// real products (content/products.yml), rather than the generic
// TYPICAL_NFA reference figures. One entry per matching product, not
// per component — a brand can have more than one product for the
// same component (GAF has two ridge vent lines with meaningfully
// different NFA), and collapsing that down to one number would hide
// exactly the kind of variance this whole feature exists to surface.
//
// Components the brand has no product data for are simply absent
// from the result, never silently backfilled with the generic
// figure — that would mislabel an unverified estimate as the brand's
// own number.
function estimateBrandOptions(componentSlugs, requiredNfaSqIn, brand, products) {
  if (!Array.isArray(products)) {
    throw new VentilationCalculatorError('products must be an array (see content/products.yml)');
  }
  const matches = products.filter(
    (p) => componentSlugs.includes(p.component) && p.brand.toLowerCase() === brand.toLowerCase()
  );
  return matches.map((p) => {
    const perLinearFoot = p.nfaPerLinearFoot != null;
    const perUnit = p.nfaPerUnit ?? p.nfaPerLinearFoot;
    return {
      component: p.component,
      brand: p.brand,
      productName: p.name,
      quantity: Math.ceil(requiredNfaSqIn / perUnit),
      unit: `${perLinearFoot ? 'linear feet' : 'units'}${p.unitLabel ? ` (${p.unitLabel})` : ''}`,
      nfaRating: perUnit,
      sourceNote: p.sourceNote ?? null,
    };
  });
}

// Generic (no brand filter) or brand-specific exhaust/intake options.
// Pass { brand, products } to filter to one brand's real products;
// omit both to get the generic component-class estimate, same as
// before this feature existed. A brand filter with no matching
// products for a given component returns fewer entries, not a
// generic fallback mislabeled as that brand.
export function estimateExhaustOptions(exhaustNfaSqIn, { brand = null, products = null } = {}) {
  if (brand) {
    return estimateBrandOptions(EXHAUST_COMPONENTS, exhaustNfaSqIn, brand, products);
  }
  return [
    estimateOption('ridge-vent', exhaustNfaSqIn, 'perLinearFoot'),
    estimateOption('static-roof-vent', exhaustNfaSqIn, 'perUnit'),
    estimateOption('turbine-vent', exhaustNfaSqIn, 'perUnit'),
  ];
}

export function estimateIntakeOptions(intakeNfaSqIn, { brand = null, products = null } = {}) {
  if (brand) {
    return estimateBrandOptions(INTAKE_COMPONENTS, intakeNfaSqIn, brand, products);
  }
  return [estimateOption('soffit-vent', intakeNfaSqIn, 'perLinearFoot')];
}

// Distinct brand names available in a loaded products list — for a UI
// to populate a brand filter dropdown/chips without hardcoding the
// list (content/products.yml is expected to grow).
export function listAvailableBrands(products) {
  if (!Array.isArray(products)) {
    throw new VentilationCalculatorError('products must be an array (see content/products.yml)');
  }
  return [...new Set(products.map((p) => p.brand))].sort();
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
