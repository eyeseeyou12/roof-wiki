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

function round1(n) {
  return Math.round(n * 10) / 10;
}
