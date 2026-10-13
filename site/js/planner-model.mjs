// NFA is in square inches; powered airflow is kept in CFM, never converted
// into a passive opening. All quantity decisions use unrounded values.
export function shortlist(products, target, ridge = null) {
  if (!Number.isFinite(target) || target <= 0) return [];
  return products.filter(p => (p.kind === 'ridge' || p.kind === 'static') && Number.isFinite(p.nfa) && p.nfa > 0).map(p => {
    const quantity = Math.ceil(target / p.nfa);
    return {...p, quantity, capacity: quantity * p.nfa,
      fits: p.kind !== 'ridge' || ridge === null || quantity <= ridge,
      status: p.kind === 'ridge' && ridge === null ? 'Needs ridge verification' : 'Capacity fits; verify installation'};
  });
}

export function assessInventory(rows, target, {exhaust = false} = {}) {
  const unknown = status => ({status, capacity:null, shortfall:null});
  if (!Array.isArray(rows) || !rows.length || rows.some(r => !r || typeof r.type !== 'string' || !r.type || r.type === 'unknown')) return unknown('Unable to evaluate');
  const active = rows.filter(r => r.type !== 'none' && r.quantity !== 0);
  if (rows.some(r => r.type === 'none') && active.length) return unknown('Conflicting inventory: remove no-vent entry');
  if (exhaust && new Set(active.map(r => r.type)).size > 1) return unknown('Existing configuration needs review');
  if (active.some(r => r.type === 'solar' || r.type === 'powered')) return unknown('Manufacturer sizing needed');
  if (active.some(r => !Number.isFinite(r.quantity) || r.quantity < 0 ||
    (r.basis !== 'foot' && r.basis !== 'area' && !Number.isInteger(r.quantity)) ||
    !Number.isFinite(r.rating) || r.rating <= 0)) return unknown('Capacity information needed');
  const capacity = active.reduce((sum,r) => sum + r.quantity * r.rating, 0);
  if (!Number.isFinite(capacity)) return unknown('Capacity information needed');
  return {capacity, shortfall:Math.max(0, target-capacity), status:capacity >= target ? 'Rated capacity target met' : 'Additional capacity needed'};
}

// 2021/2024 IRC R806.2 model-code basis. Climate/vapor-retarder and
// upper/lower placement conditions are explicit attestations, not guesses.
export function codeBasis(area, rules = {}) {
  if (!Number.isFinite(area) || area <= 0) throw new Error('Enter a positive attic floor area.');
  const climate = Number(rules.climate);
  const climateKnown = Number.isInteger(climate) && climate >= 1 && climate <= 8;
  const vaporOK = climateKnown && (climate <= 5 || rules.vapor === true);
  const eligible = rules.requested === true && vaporOK && rules.placement === true && rules.local === true;
  const ratio = eligible ? 300 : 150;
  const total = area * (144 / ratio);
  return {ratio, total, target:total / 2, eligible,
    fallback:rules.requested === true && !eligible,
    exhaustMin:total * (eligible ? 0.4 : 0.5)};
}

export function assessSolar(solar, area, intakeCapacity) {
  const invalid = !Number.isFinite(area) || area <= 0 || !solar || !Number.isInteger(solar.quantity) || solar.quantity <= 0 ||
    !Number.isFinite(solar.coverage) || solar.coverage <= 0 ||
    !Number.isFinite(solar.minimumIntake) || solar.minimumIntake <= 0;
  if (invalid || solar.confirmed !== true) return {status:'review', title:'REVIEW · solar sizing needed', reasons:['Enter the manufacturer-confirmed fan count, total coverage and total minimum intake for this configuration.'], intakeTarget:solar?.minimumIntake > 0 ? solar.minimumIntake : null};
  const reasons = [];
  if (solar.coverage < area) reasons.push(`Manufacturer-confirmed coverage is short by ${Math.ceil(area - solar.coverage)} sq ft.`);
  const intakeKnown = Number.isFinite(intakeCapacity) && intakeCapacity >= 0;
  if (intakeKnown && intakeCapacity < solar.minimumIntake) reasons.push(`Add at least ${Math.ceil(solar.minimumIntake - intakeCapacity)} sq in of intake NFA.`);
  if (reasons.length) return {status:'fail', title:'FAIL · solar sizing / intake', reasons, intakeTarget:solar.minimumIntake};
  if (!intakeKnown) return {status:'review', title:'REVIEW · intake capacity unknown', reasons:['Identify the installed intake NFA before approving this fan configuration.'], intakeTarget:solar.minimumIntake};
  return {status:'pass', title:'PASS · manufacturer sizing check', reasons:['Coverage and intake meet the entered manufacturer requirements. This does not establish the IRC passive-opening requirement; confirm the powered-system code path with the authority having jurisdiction.'], intakeTarget:solar.minimumIntake};
}

export function assessSystem(attic, mode, selected) {
  const basis = codeBasis(attic.area, attic.rules);
  const intake = assessInventory(attic.intake, 0);
  const exhaust = mode === 'plan' && selected
    ? selected.kind === 'solar'
      ? {capacity:null, status:'Manufacturer fan sizing; no passive NFA credit'}
      : Number.isFinite(selected.capacity) && selected.capacity > 0
        ? {capacity:selected.capacity, status:'Planned exhaust'}
        : {capacity:null, status:'Planned exhaust capacity is invalid'}
    : assessInventory(attic.exhaust, 0, {exhaust:true});
  const active = attic.exhaust.filter(r => !['none','unknown'].includes(r.type) && r.quantity !== 0);
  const solarMode = mode === 'plan' ? selected?.kind === 'solar' : active.some(r => ['solar','powered'].includes(r.type));
  if (solarMode) {
    if (mode === 'check' && (attic.exhaust.some(r => ['none','unknown'].includes(r.type)) || active.length !== 1)) {
      return {basis, intake, exhaust, status:'review', title:'REVIEW · exhaust configuration', reasons:['Resolve unknown or mixed exhaust types before applying manufacturer fan sizing.'], intakeTarget:null};
    }
    const solar = mode === 'plan' ? attic.solar : {...active[0], quantity:active[0].quantity};
    return {...assessSolar(solar, attic.area, intake.capacity), basis, intake, exhaust, solar:true};
  }
  const intakeTarget = Math.max(basis.target, exhaust.capacity ?? 0);
  const result = {basis, intake, exhaust, intakeTarget, solar:false};
  if (mode === 'plan' && !selected) return {...result,status:'review',title:'REVIEW · select an exhaust plan',reasons:['Select one candidate to check its rounded capacity and supporting intake.']};
  if (mode === 'plan' && selected.kind === 'ridge' && (selected.fits === false || (Number.isFinite(attic.ridge) && selected.quantity > attic.ridge))) return {...result,status:'fail',title:'FAIL · usable ridge too short',reasons:['The required ridge-vent length exceeds the usable ridge serving this attic. Choose another exhaust plan or verify the ridge measurement.']};
  const reasons = [];
  if (exhaust.capacity !== null && exhaust.capacity < basis.exhaustMin) reasons.push(`Add at least ${Math.ceil(basis.exhaustMin - exhaust.capacity)} sq in of exhaust NFA${basis.ratio === 300 ? ' to reach the 40% lower allocation' : ' to meet the balanced planning target'}.`);
  if (intake.capacity !== null && intake.capacity < intakeTarget) reasons.push(`Add at least ${Math.ceil(intakeTarget - intake.capacity)} sq in of intake NFA.`);
  if (intake.capacity !== null && exhaust.capacity !== null && intake.capacity + exhaust.capacity < basis.total) reasons.push(`Combined NFA is short by ${Math.ceil(basis.total - intake.capacity - exhaust.capacity)} sq in.`);
  if (reasons.length) return {...result,status:'fail',title:'FAIL · capacity / balance',reasons};
  if (intake.capacity === null || exhaust.capacity === null) return {...result,status:'review',title:'REVIEW · capacity information needed',reasons:[intake.capacity === null ? 'Intake: ' + intake.status + '. Enter published NFA.' : 'Exhaust: ' + exhaust.status + '. Identify products and resolve mixed types.']};
  // Report the actual split conservatively. R806.2 refers to allocation of
  // required NFA; excess installed NFA is not automatically a code violation.
  // Do not issue a reduced-ratio pass for an unusual allocation without AHJ review.
  const highShare = exhaust.capacity / (intake.capacity + exhaust.capacity);
  if (basis.ratio === 300 && (highShare < 0.4 || highShare > 0.5)) return {...result,highShare,status:'review',title:'REVIEW · 1:300 allocation',reasons:[`Upper exhaust is ${(highShare * 100).toFixed(1)}% of the entered total. Verify the 40–50% allocation of required NFA with the authority having jurisdiction, or check the 1:150 basis. Excess intake alone is not labeled a code violation.`]};
  if (mode === 'plan' && selected.kind === 'ridge' && !Number.isFinite(attic.ridge)) return {...result,highShare,status:'review',title:'REVIEW · usable ridge unknown',reasons:['Capacity and intake fit; measure usable ridge serving this attic before ordering.']};
  return {...result,highShare,status:'pass',title:'PASS · capacity and balance',reasons:['Rated NFA meets this basis and intake is at least the exhaust capacity. Verify unobstructed openings, distribution and product installation requirements.']};
}

export function intakeTakeoff(target, capacity, rating, basis = 'foot') {
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(rating) || rating <= 0) return null;
  const capacityKnown = Number.isFinite(capacity) && capacity >= 0;
  const shortfall = Math.max(0, target - (capacityKnown ? capacity : 0));
  const quantity = Math.ceil(shortfall / rating);
  return {quantity, capacity:quantity * rating, shortfall, existingUnknown:!capacityKnown,
    unit:basis === 'foot' ? 'linear ft' : basis === 'area' ? 'sq ft of vented panel' : 'vents'};
}
