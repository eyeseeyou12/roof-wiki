import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roofAreaToFloorArea, estimateAtticFloorArea, calculateRequiredNfa,
  estimateExhaustOptions, calculateForSections,
} from '../scripts/lib/ventilation-calculator.mjs';
import {
  codeBasis, shortlist, assessInventory, assessSolar, assessSystem, intakeTakeoff,
} from '../site/js/planner-model.mjs';

// Model-code source: ICC 2021 IRC R806.2. Local adoption is an explicit input.
// https://codes.iccsafe.org/s/IRC2021P3/chapter-8-roof-ceiling-construction/IRC2021P3-Pt03-Ch08-SecR806.2
const reducedRules = {requested:true, climate:2, placement:true, local:true};
const inventory = (capacity, type = 'individual') => [{type, quantity:1, rating:capacity}];
const attic = (overrides = {}) => ({area:2000, rules:{}, intake:inventory(960), exhaust:inventory(960, 'static'), ridge:null, ...overrides});
const fan = (overrides = {}) => ({quantity:2, coverage:2400, minimumIntake:1728, confirmed:true, ...overrides});

test('pitched planes are projected separately and overhang is removed after projection', () => {
  assert.equal(roofAreaToFloorArea(1300, 5), 1200);
  assert.equal(roofAreaToFloorArea(1500, 9), 1200);
  const result = estimateAtticFloorArea({
    segments:[{roofAreaSqFt:1300,pitchRise:5},{roofAreaSqFt:1500,pitchRise:9}],
    eaveLengthFt:100, overhangDepthFt:2,
  });
  assert.equal(result.atticSquareFootage, 2200);
  assert.equal(result.pitchOnlyEstimate, 2400);
});

test('area projection keeps precision and rejects missing or invalid pitch', () => {
  assert.ok(roofAreaToFloorArea(1300.01, 5) > 1200);
  for (const rise of [undefined, NaN, -1]) assert.throws(() => roofAreaToFloorArea(1300, rise));
  for (const run of [0, -12, Infinity]) assert.throws(() => roofAreaToFloorArea(1300, 5, run));
});

test('baseline uses floor area / 150 with 144 square inches per square foot', () => {
  const result = codeBasis(2000);
  assert.equal(result.ratio, 150);
  assert.equal(result.total, 1920);
  assert.equal(result.target, 960);
});

test('1:300 requires explicit applicable conditions; a requested checkbox alone does not reduce area', () => {
  assert.equal(codeBasis(2000, reducedRules).total, 960);
  for (const change of [{climate:''}, {climate:9}, {placement:false}, {local:false}]) {
    const result = codeBasis(2000, {...reducedRules,...change});
    assert.equal(result.ratio, 150);
    assert.equal(result.fallback, true);
  }
  assert.equal(codeBasis(2000, {...reducedRules, requested:false}).ratio, 150);
});

test('climate zones 6 through 8 need the vapor-retarder condition', () => {
  for (const climate of [6,7,8]) {
    assert.equal(codeBasis(2000, {...reducedRules,climate}).ratio, 150);
    assert.equal(codeBasis(2000, {...reducedRules,climate,vapor:true}).ratio, 300);
  }
  assert.equal(codeBasis(2000, {...reducedRules,climate:5}).ratio, 300);
});

test('NFA remains unrounded until product quantities are rounded upward', () => {
  const required = calculateRequiredNfa({atticSquareFootage:1800.02});
  assert.ok(required.exhaustNfaSqIn > 864);
  const ridge = estimateExhaustOptions(required.exhaustNfaSqIn).find(p => p.component === 'ridge-vent');
  assert.equal(ridge.quantity, 49);
  assert.equal(shortlist([{kind:'ridge',nfa:18}], required.exhaustNfaSqIn)[0].quantity, 49);
  assert.equal(calculateRequiredNfa({atticSquareFootage:2000,exceptionConditionsConfirmed:'false'}).ratioUsed, '1/150');
});

test('separate attic areas and ventilation inventories never borrow from one another', () => {
  const result = calculateForSections([{atticSquareFootage:1000},{atticSquareFootage:500}]);
  assert.deepEqual(result.sections.map(s => s.totalNfaSqIn), [960,480]);
  assert.equal(assessSystem(attic({area:1000,intake:inventory(2000),exhaust:inventory(2000,'static')}), 'check').status, 'pass');
  assert.equal(assessSystem(attic({area:500,intake:[{type:'none'}],exhaust:[{type:'none'}]}), 'check').status, 'fail');
});

test('baseline capacity pass explicitly checks balance; total area alone cannot pass a deficient side', () => {
  assert.equal(assessSystem(attic(), 'check').status, 'pass');
  const result = assessSystem(attic({intake:inventory(800),exhaust:inventory(1200,'static')}), 'check');
  assert.equal(result.status, 'fail');
  assert.ok(result.reasons.some(reason => /intake/.test(reason)));
});

test('1:300 accepts the allowed 40% upper and 60% lower allocation', () => {
  const result = assessSystem(attic({rules:reducedRules,intake:inventory(576),exhaust:inventory(384,'static')}), 'check');
  assert.equal(result.status, 'pass');
  assert.equal(result.highShare, 0.4);
});

test('insufficient upper area fails; excess lower area is reviewed rather than called a code violation', () => {
  assert.equal(assessSystem(attic({rules:reducedRules,intake:inventory(600),exhaust:inventory(360,'static')}), 'check').status, 'fail');
  const result = assessSystem(attic({rules:reducedRules,intake:inventory(1200),exhaust:inventory(480,'static')}), 'check');
  assert.equal(result.status, 'review');
  assert.match(result.reasons.join(' '), /not labeled a code violation/);
});

test('unknown intake and exhaust capacities cannot receive a pass', () => {
  for (const overrides of [{intake:[]}, {intake:[{type:'unknown'}]}, {exhaust:[{type:'unknown'}]}]) {
    assert.equal(assessSystem(attic(overrides), 'check').status, 'review');
  }
});

test('unknown or conflicting exhaust families are reviewed, including fan-plus-passive configurations', () => {
  const mixedPassive = [{type:'ridge',basis:'foot',quantity:40,rating:18},{type:'static',quantity:5,rating:50}];
  assert.equal(assessSystem(attic({exhaust:mixedPassive}), 'check').status, 'review');
  const mixedSolar = [{type:'solar',...fan()},{type:'static',quantity:4,rating:50}];
  assert.equal(assessSystem(attic({exhaust:mixedSolar}), 'check').status, 'review');
});

test('fractional vent counts are rejected but continuous vent lengths and panel areas are allowed', () => {
  assert.equal(assessInventory([{type:'static',quantity:1.5,rating:144}],200).capacity, null);
  assert.equal(assessInventory([{type:'ridge',basis:'foot',quantity:1.5,rating:20}],20).capacity, 30);
  assert.equal(assessInventory([{type:'panel',basis:'area',quantity:1.5,rating:10}],10).capacity, 15);
});

test('invalid inventory ratings and quantities never become rated capacity', () => {
  for (const change of [{rating:NaN},{rating:Infinity},{rating:0},{quantity:-1},{quantity:NaN},{quantity:Infinity}]) {
    assert.equal(assessInventory([{type:'static',quantity:2,rating:50,...change}],100).capacity, null);
  }
  assert.equal(assessInventory([{type:'static',quantity:2,rating:Number.MAX_VALUE}],100).capacity, null);
});

test('a planned ridge vent cannot pass with insufficient or unknown usable ridge', () => {
  const selected = shortlist([{kind:'ridge',nfa:20}],960,20)[0];
  assert.equal(selected.quantity, 48);
  assert.equal(assessSystem(attic({ridge:20}), 'plan', selected).status, 'fail');
  const unverified = shortlist([{kind:'ridge',nfa:20}],960)[0];
  assert.equal(assessSystem(attic(), 'plan', unverified).status, 'review');
  assert.equal(assessSystem(attic({ridge:48}), 'plan', {...unverified,fits:true}).status, 'pass');
});

test('malformed planned capacity cannot propagate NaN into a pass', () => {
  for (const capacity of [undefined,NaN,Infinity,-100]) {
    assert.equal(assessSystem(attic(), 'plan', {kind:'static',capacity}).status, 'review');
  }
});

test('rounding a static exhaust plan also raises the supporting intake target', () => {
  const selected = shortlist([{kind:'static',nfa:144}],960)[0];
  assert.equal(selected.quantity,7);
  assert.equal(selected.capacity,1008);
  const result = assessSystem(attic(), 'plan', selected);
  assert.equal(result.status,'fail');
  assert.equal(result.intakeTarget,1008);
});

test('solar manufacturer coverage and minimum intake are separate checks from passive NFA', () => {
  assert.equal(assessSolar(fan(),2000,1728).status,'pass');
  assert.match(assessSolar(fan(),2000,1728).reasons[0],/does not establish the IRC/);
  assert.equal(assessSolar(fan(),2500,1728).status,'fail');
  assert.equal(assessSolar(fan(),2000,1700).status,'fail');
  assert.equal(assessSolar(fan({confirmed:false}),2000,1728).status,'review');
});

test('unconfirmed, fractional or incomplete solar sizing cannot pass', () => {
  for (const change of [{quantity:1.5},{quantity:0},{coverage:NaN},{coverage:0},{minimumIntake:undefined},{confirmed:'true'}]) {
    assert.equal(assessSolar(fan(change),2000,3000).status,'review');
  }
  for (const capacity of [null,undefined,NaN,Infinity,-1]) {
    assert.equal(assessSolar(fan(),2000,capacity).status,'review');
  }
});

test('a large CFM rating is never credited as passive exhaust NFA', () => {
  assert.equal(assessInventory([{type:'solar',quantity:1,rating:1825}],960,{exhaust:true}).capacity,null);
  const result = assessSystem(attic({solar:{quantity:1,cfm:1825},intake:inventory(2000)}),'plan',{kind:'solar',cfm:1825});
  assert.equal(result.status,'review');
  assert.equal(result.exhaust.capacity,null);
});

test('intake additions use only the rated shortfall and round upward without inventing credit', () => {
  assert.deepEqual(intakeTakeoff(1008,960,9), {quantity:6,capacity:54,shortfall:48,existingUnknown:false,unit:'linear ft'});
  assert.equal(intakeTakeoff(1008,1100,9).quantity,0);
  const unknown = intakeTakeoff(1008,null,9);
  assert.equal(unknown.quantity,112);
  assert.equal(unknown.existingUnknown,true);
  assert.equal(intakeTakeoff(1008,NaN,9).quantity,112);
  assert.equal(intakeTakeoff(1008,0,NaN),null);
});
