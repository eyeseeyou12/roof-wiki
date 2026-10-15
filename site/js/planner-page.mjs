import { estimateAtticFloorArea } from '/lib/ventilation-calculator.mjs';
import { initMeasurementUpload } from './measurement-upload.mjs';
import { loadComponents, loadVentilationProducts } from './data.mjs';
import { el, escapeHtml as esc, loadError } from './render.mjs';
import { shortlist, assessInventory, codeBasis, assessSystem, intakeTakeoff } from './planner-model.mjs';

const $=id=>document.getElementById(id);
let attics=[], active=0, mode='plan', editing=null, products=[];
const DRAFT_KEY='roof-wiki-planner-v2';
let inventoryOpen=false;
const current=()=>attics[active];
const number=value=>value===''?NaN:Number(value);
const fmt=value=>Math.ceil(value).toLocaleString();
function fail(message){$('planner-error').textContent=message;$('planner-error').hidden=false;}
function clearError(){$('planner-error').hidden=true;}
function announce(text){$('planner-status').hidden=false;$('planner-status').textContent=text;}
function newAttic(label='Main attic'){return {label,area:0,method:'direct',segments:[],ridge:null,intake:[],exhaust:[],selected:null,rules:{requested:false,climate:'',vapor:false,placement:false,local:false},solar:{},plannedIntake:[],intakeProduct:'oc-inflow',origin:'Entered manually'};}
function appendSegment(segment={}){
 const row=el('div',{class:'segment-fields'});row.innerHTML=`<label>Roof area · sq ft<input class="seg-area" type="number" min="0.01" step="any" value="${esc(segment.roofAreaSqFt??'')}"></label><label>Pitch rise<input class="seg-rise" type="number" min="0" step="any" value="${esc(segment.pitchRise??'')}"></label><label>Pitch run<input class="seg-run" type="number" min="0.01" step="any" value="${esc(segment.pitchRun??12)}"></label><button type="button" class="secondary" aria-label="Remove roof section">×</button>`;row.querySelector('button').onclick=()=>row.remove();$('segment-editor').appendChild(row);
}
function areaMode(){const direct=$('area-mode').value==='direct';$('simple-roof').hidden=direct;$('floor-field').hidden=!direct;$('segments-details').hidden=direct;$('overhang-details').hidden=direct;}
function edit(index=null){editing=index;const a=index===null?newAttic(attics.length?'Separate attic':'Main attic'):attics[index];$('area-name').value=a.label;$('area-mode').value=a.method==='direct'?'direct':'roof';if(index===null)$('area-mode').value='roof';$('floor-area').value=a.area||'';const s=a.segments[0];$('roof-area').value=s?.roofAreaSqFt??'';$('roof-pitch').value=s&&s.pitchRun===12?s.pitchRise:'';$('eave-length').value=a.eave??'';$('overhang-depth').value=a.overhang??'';$('use-segments').checked=a.segments.length>1||Boolean(s&&s.pitchRun!==12);$('segment-editor').replaceChildren();a.segments.forEach(appendSegment);$('segments-details').open=$('use-segments').checked;$('measurement-editor').hidden=false;$('start-panel').hidden=true;$('planner-workspace').hidden=true;$('upload-panel').hidden=true;areaMode();$('area-name').focus();}
$('area-mode').onchange=areaMode;$('segment-add').onclick=()=>appendSegment();
$('area-form').onsubmit=e=>{e.preventDefault();clearError();try{const a=editing===null?newAttic():attics[editing];const name=$('area-name').value.trim();if(!name)throw Error('Name this attic.');let segments=[],estimate;let eave=null,overhang=null;
 if($('area-mode').value==='direct'){const area=number($('floor-area').value);if(!Number.isFinite(area)||area<=0)throw Error('Enter a positive attic floor area.');estimate={atticSquareFootage:area,method:'direct'};}
 else {segments=$('use-segments').checked?[...$('segment-editor').children].map(row=>({roofAreaSqFt:number(row.querySelector('.seg-area').value),pitchRise:number(row.querySelector('.seg-rise').value),pitchRun:number(row.querySelector('.seg-run').value)})):[{roofAreaSqFt:number($('roof-area').value),pitchRise:number($('roof-pitch').value),pitchRun:12}];if(!segments.length||segments.some(s=>!Number.isFinite(s.roofAreaSqFt)||s.roofAreaSqFt<=0||!Number.isFinite(s.pitchRise)||s.pitchRise<0||!Number.isFinite(s.pitchRun)||s.pitchRun<=0))throw Error('Enter a positive roof area and a valid pitch for each section.');eave=$('eave-length').value===''?null:number($('eave-length').value);overhang=$('overhang-depth').value===''?null:number($('overhang-depth').value);if((eave===null)!==(overhang===null))throw Error('Provide both overhang values, or leave both blank.');estimate=estimateAtticFloorArea({segments,eaveLengthFt:eave,overhangDepthFt:overhang});if(estimate.atticSquareFootage<=0)throw Error('Overhang correction leaves no attic area; check measurements.');}
 Object.assign(a,{label:name,area:estimate.atticSquareFootage,method:estimate.method,segments,eave,overhang,selected:null,solar:{},plannedIntake:[],origin:editing===null?'Entered manually':'Edited'});if(editing===null){attics.push(a);active=attics.length-1;}$('measurement-editor').hidden=true;render();announce('Measurements updated.');}catch(err){fail(err.message);}};
$('cancel-editor').onclick=()=>{$('measurement-editor').hidden=true;render();};$('edit-area').onclick=()=>edit(active);$('add-attic').onclick=()=>edit();$('start-manual').onclick=()=>edit();
function openUpload(){$('upload-panel').hidden=false;$('measurement-editor').hidden=true;$('measurement-file').focus();}
$('start-upload').onclick=openUpload;$('replace-report').onclick=openUpload;
$('attic-picker').onchange=()=>{active=+$('attic-picker').value;render();};
$('remove-attic').onclick=()=>{if(!confirm('Remove this attic and its measurements and vent inventory?'))return;attics.splice(active,1);active=Math.max(0,active-1);render();};
for(const m of ['plan','check'])$(m+'-mode').onclick=()=>{mode=m;if(!$('measurement-editor').hidden){$('plan-mode').setAttribute('aria-pressed',m==='plan');$('check-mode').setAttribute('aria-pressed',m==='check');}else render();};

function saveDraft(){
 try{localStorage.setItem(DRAFT_KEY,JSON.stringify({attics,active,mode}));$('draft-status').textContent='Draft saved on this device.';}
 catch{$('draft-status').textContent='This browser cannot save the draft. Keep this tab open.';}
}
function restoreDraft(){
 try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY));if(!d||!Array.isArray(d.attics))return;
 attics=d.attics.filter(a=>Number.isFinite(a.area)&&a.area>0).map(a=>({...newAttic(),...a,label:String(a.label).slice(0,100),segments:Array.isArray(a.segments)?a.segments:[],intake:Array.isArray(a.intake)?a.intake:[],exhaust:Array.isArray(a.exhaust)?a.exhaust:[],plannedIntake:Array.isArray(a.plannedIntake)?a.plannedIntake:[],rules:a.rules||{},solar:a.solar||{}}));
 active=Math.min(Math.max(0,Number(d.active)||0),Math.max(0,attics.length-1));mode=d.mode==='check'?'check':'plan';
 }catch{/* A damaged or unavailable browser draft does not block manual entry. */}
}
function pitchProblem(p,a){return p?.minPitch!==undefined&&a.segments.some(s=>s.pitchRise/s.pitchRun*12<p.minPitch||(p.maxPitch!==undefined&&s.pitchRise/s.pitchRun*12>p.maxPitch));}
function choicesFor(a){return shortlist(products,codeBasis(a.area,a.rules).target,a.ridge).map(p=>({...p,fits:p.fits&&!pitchProblem(p,a),pitchConflict:pitchProblem(p,a)}));}
function selectedFor(a){return choicesFor(a).find(p=>p.id===a.selected&&p.fits)||products.find(p=>p.id===a.selected&&p.kind==='solar');}
function effective(a){return mode==='plan'?{...a,intake:[...a.intake.filter(r=>!a.plannedIntake.length||r.type!=='none'),...a.plannedIntake]}:a;}
function resultFor(a){const result=assessSystem(effective(a),mode,selectedFor(a));const planned=mode==='plan'?[selectedFor(a),...a.plannedIntake.map(r=>products.find(p=>p.id===r.product))]:[...a.intake,...a.exhaust].map(r=>products.find(p=>p.id===r.product));if(planned.some(p=>pitchProblem(p,a)))return {...result,status:'review',title:'REVIEW · product pitch conflict',reasons:['A recorded roof pitch is outside a selected product’s published limits. Check the actual vent location or choose a compatible product.']};return result;}
const sourceLink=p=>`<a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">Manufacturer specifications ↗</a>`;
function productDetails(p){return `<details class="product-details"><summary>Specifications &amp; source</summary><p>${esc(p.notes)}</p>${p.watts?`<p>${p.watts} W${p.cfm?` · up to ${p.cfm.toLocaleString()} CFM`:''}${p.maxCoverage?` · up to ${p.maxCoverage.toLocaleString()} sq ft headline coverage`:''}. Confirm project sizing.</p>`:''}${p.material?`<p>Material: ${esc(p.material)}.</p>`:''}${p.nfa?`<p>Rated NFA: ${p.nfa} sq in per ${p.unit==='linear ft'?'linear foot':'vent'}.</p>`:''}${p.minPitch!==undefined?`<p>Published pitch: ${p.minPitch}/12 minimum${p.maxPitch!==undefined?` · ${p.maxPitch}/12 maximum`:''}.</p>`:''}${p.pieceLength?`<p>Section length: ${p.pieceLength} ft.</p>`:''}<p>${esc(p.availability)} Local stock is not verified.</p>${sourceLink(p)}${p.additionalSources?.map(url=>` · <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Technical reference</a>`).join('')||''}<p class="small">Source checked ${esc(p.verifiedOn)} · <a href="/component.html?slug=${encodeURIComponent(p.component)}">Component reference</a></p></details>`;}
function renderRules(a,basis){
 const box=$('rule-controls');box.innerHTML=`<div class="rule-heading"><strong>IRC R806.2 · 1:${basis.ratio} basis</strong><span class="small">Central Texas planning</span></div><div class="code-conditions"><p class="small">The default is 1:150. This planner uses the 2021/2024 model-code conditions; confirm your jurisdiction's adopted edition and amendments. Climate zone is a code climate zone, not a USDA growing zone.</p><label class="check-label"><input id="rule-requested" type="checkbox" ${a.rules.requested?'checked':''}>Request the 1:300 exception</label><label>Project climate zone<select id="rule-climate"><option value="">Not confirmed</option>${[1,2,3,4,5,6,7,8].map(n=>`<option value="${n}">Zone ${n}</option>`).join('')}</select></label><label class="check-label"><input id="rule-vapor" type="checkbox" ${a.rules.vapor?'checked':''}>For zones 6–8: Class I or II vapor retarder verified on the warm-in-winter side</label><label class="check-label"><input id="rule-placement" type="checkbox" ${a.rules.placement?'checked':''}>Upper vents are within 3 ft below the ridge / highest point, with lower vents in the bottom third; any framing exception is verified</label><label class="check-label"><input id="rule-local" type="checkbox" ${a.rules.local?'checked':''}>I verified that the applicable local code permits this exception</label><p class="small">The exception allocates 40–50% of required NFA to upper vents, with the balance low. The planned design starts at 50/50; quantities round upward.</p></div>${basis.fallback?'<p class="notice">1:300 conditions are incomplete. Calculations remain at 1:150.</p>':''}`;
 $('rule-climate').value=a.rules.climate??'';
 for(const key of ['requested','vapor','placement','local'])$('rule-'+key).onchange=e=>{a.rules[key]=e.target.checked;render();};
 $('rule-climate').onchange=e=>{a.rules.climate=e.target.value;render();};
}
function render(){
 const inventoryDisclosure=$('existing-intake');if(inventoryDisclosure)inventoryOpen=inventoryDisclosure.open;
 clearError();for(const m of ['plan','check'])$(m+'-mode').setAttribute('aria-pressed',mode===m);
 $('start-panel').hidden=attics.length>0;$('planner-workspace').hidden=!attics.length;
 if(!attics.length){saveDraft();return;}
 const a=current();const basis=codeBasis(a.area,a.rules);const choices=choicesFor(a);
 if(a.selected&&!selectedFor(a))a.selected=null;
 if(mode==='plan'&&!a.selected){const fit=choices.filter(p=>p.fits);a.selected=(fit.find(p=>p.kind==='ridge')||fit.find(p=>p.id==='hcd144')||fit[0])?.id??null;}
 $('attic-picker').replaceChildren(...attics.map((s,i)=>el('option',{value:String(i),text:s.label})));$('attic-picker').value=String(active);
 $('roof-summary').innerHTML=`<strong class="area-number">${fmt(a.area)} <span>sq ft</span></strong><span class="small">${esc(a.label)} · ${a.method==='direct'?'floor area':'estimated floor area'}</span>`;
 $('attic-selector').hidden=attics.length<2;$('basis-label').textContent=` · 1:${basis.ratio}${basis.fallback?' (conditions incomplete)':''}`;
 renderRules(a,basis);renderRecommendations(a,basis,choices);const result=resultFor(a);
 $('system-result').innerHTML=`<section class="system-result ${result.status}"><h2>${esc(result.title)}</h2><p>${esc(result.reasons[0])}</p><details><summary>Check details</summary>${result.reasons.slice(1).map(r=>`<p>${esc(r)}</p>`).join('')}<p class="small">${result.solar?'Powered airflow and passive NFA are evaluated separately.':'This checks entered capacity and balance. Verify openings, airflow paths and installation; this is not permit approval.'}</p></details></section>`;
 renderInventory(a,result);renderIntakePlan(a,result);
 $('section-results').innerHTML='<h3>Separate attic checks</h3>'+attics.map((s,i)=>{const r=resultFor(s);return `<button type="button" data-attic="${i}" class="section-result ${r.status}"><span>${esc(s.label)}</span><strong>${r.status.toUpperCase()}</strong></button>`;}).join('');
 $('section-results').querySelectorAll('button').forEach(b=>b.onclick=()=>{active=Number(b.dataset.attic);render();});
 $('calculation-details').innerHTML=`<p>Area: ${a.area.toLocaleString(undefined,{maximumFractionDigits:3})} sq ft · ${a.method==='direct'?'entered directly':a.method==='pitch-and-overhang'?'pitch-corrected, with overhang deduction':'pitch-corrected; no overhang deduction'}.</p><p>For each roof face: floor area = sloped area ÷ √(1 + (rise ÷ run)²). Only faces over this attic count.</p><p>${a.area.toFixed(3)} × 144 ÷ ${basis.ratio} = ${basis.total.toFixed(3)} sq in total required NFA. Half per side = ${basis.target.toFixed(3)} sq in design target. Quantities use unrounded values, then round up.</p><p>${result.intakeTarget!==null?`Supporting intake for this selection: ${fmt(result.intakeTarget)} sq in.`:'Supporting intake needs manufacturer sizing.'} Separate attics never share capacity.</p>`;
 saveDraft();
}
function chooseExhaust(a,id){
 const p=products.find(p=>p.id===id);a.selected=id;mode='plan';
 if(p?.kind==='solar'){
  a.solar={quantity:1,coverage:null,minimumIntake:p.minIntakePerFan??null,confirmed:false};
  const exact=p.sizingRows?.find(r=>r.area===a.area);if(exact)Object.assign(a.solar,{quantity:exact.count,coverage:exact.area,minimumIntake:exact.intake});
 }
 render();
}
function renderRecommendations(a,basis,choices){
 const fitted=choices.filter(p=>p.fits);const lead=fitted.find(p=>p.kind==='ridge')||fitted.find(p=>p.id==='hcd144')||fitted[0];
 const selected=selectedFor(a)||lead;const rec=$('recommendation');
 const groups=[['ridge','Ridge vents'],['static','Dome / box vents'],['solar','Solar fans']];
 const options=groups.map(([kind,label])=>`<optgroup label="${label}">${(kind==='solar'?products.filter(p=>p.kind==='solar'):choices.filter(p=>p.kind===kind)).map(p=>`<option value="${p.id}" ${p.fits===false?'disabled':''}>${esc(p.brand+' '+p.name)}${p.fits===false?' — does not fit':''}</option>`).join('')}</optgroup>`).join('');
 rec.innerHTML=`${mode==='check'?'<details class="improvement-options"><summary>Plan improvements</summary>':''}<section class="approach"><span class="step-label">2 · Exhaust</span><label class="product-select-label">Vent product<select id="exhaust-choice">${options}</select></label><div id="selected-exhaust"></div><div id="solar-sizing"></div>${mode==='check'?'<button type="button" id="use-exhaust-plan">Use this in a new plan</button>':''}</section>${mode==='check'?'</details>':''}`;
 $('exhaust-choice').value=selected?.id??'';$('exhaust-choice').onchange=e=>chooseExhaust(a,e.target.value);
 if($('use-exhaust-plan'))$('use-exhaust-plan').onclick=()=>chooseExhaust(a,selected.id);
 if(!selected){$('selected-exhaust').textContent='No recorded product fits these measurements. Check the area and usable ridge.';return;}
 const p=selected;
 if(p.kind==='solar'){
  $('selected-exhaust').innerHTML=`<p class="small">${p.watts} W${p.cfm?` · up to ${p.cfm.toLocaleString()} CFM`:''}. Confirm manufacturer sizing below.</p>${productDetails(p)}${p.sizingRows?`<details><summary>Published fan sizing table</summary><div class="overflow-x"><table><thead><tr><th>Attic sq ft</th><th>Fans</th><th>Intake sq in</th></tr></thead><tbody>${p.sizingRows.map(r=>`<tr><td>${r.area}</td><td>${r.count}</td><td>${r.intake}</td></tr>`).join('')}</tbody></table></div><p class="small">Exact published rows; no interpolation.</p></details>`:''}`;
  $('solar-sizing').appendChild(solarFields(a.solar,p));
 }else{
  $('selected-exhaust').innerHTML=`<div class="quantity-line"><strong>${p.quantity} <span>${p.unit==='linear ft'?'ft':'vents'}</span></strong><span class="small">${p.capacity.toLocaleString()} sq in NFA</span></div>${p.pieceLength?`<p class="small">${Math.ceil(p.quantity/p.pieceLength)} × ${p.pieceLength}-ft ${p.pieceLength>=20?'rolls':'sections'} to buy; trim to ${p.quantity} ft installed.</p>`:''}${p.kind==='ridge'?`<form class="ridge-question"><label>Usable ridge · ft<input id="usable-ridge" type="number" min="0" step="any" value="${a.ridge??''}" placeholder="Enter to check fit"></label><button type="submit" class="secondary">Check fit</button></form>`:''}${productDetails(p)}`;
 }
 if(p.kind!=='ridge'){
  const adjustment=el('details',{class:'ridge-adjustment'});adjustment.innerHTML=`<summary>Change usable ridge length</summary><form class="ridge-question"><label>Usable ridge · ft<input id="usable-ridge" type="number" min="0" step="any" value="${a.ridge??''}" placeholder="Unknown"></label><button type="submit" class="secondary">Check fit</button></form>`;$('selected-exhaust').appendChild(adjustment);
 }
 const form=rec.querySelector('.ridge-question');if(form)form.onsubmit=e=>{e.preventDefault();const v=$('usable-ridge').value,n=number(v);if(v!==''&&(!Number.isFinite(n)||n<0)){fail('Enter a non-negative ridge length, or leave it unknown.');return;}a.ridge=v===''?null:n;render();};
}
function solarFields(s,p){
 const box=el('div',{class:'solar-fields'});box.innerHTML=`<h3>Solar sizing</h3><p class="small">Use manufacturer-confirmed totals for this attic. CFM does not count as passive NFA.</p>${p?sourceLink(p):''}<div class="field-row"><label>Number of fans<input class="fan-count" type="number" min="1" step="1" value="${Number.isFinite(s.quantity)?s.quantity:''}"></label><label>Total coverage · sq ft<input class="fan-coverage" type="number" min="1" step="any" value="${Number.isFinite(s.coverage)?s.coverage:''}"></label><label>Total minimum intake · sq in NFA<input class="fan-intake" type="number" min="1" step="any" value="${Number.isFinite(s.minimumIntake)?s.minimumIntake:''}"></label></div><label class="check-label"><input class="fan-confirm" type="checkbox" ${s.confirmed?'checked':''}>Manufacturer sizing and installation requirements confirmed</label>`;
 const changes=[['.fan-count','quantity'],['.fan-coverage','coverage'],['.fan-intake','minimumIntake']];
 for(const [selector,key]of changes)box.querySelector(selector).onchange=e=>{s[key]=number(e.target.value);s.confirmed=false;if(key==='quantity'){s.coverage=null;s.minimumIntake=p?.minIntakePerFan&&Number.isInteger(s.quantity)&&s.quantity>0?p.minIntakePerFan*s.quantity:null;}render();};
 box.querySelector('.fan-confirm').onchange=e=>{s.confirmed=e.target.checked;render();};return box;
}
const intakeTypes=[['unknown','Not sure'],['none','No existing intake'],['individual','Individual soffit vents'],['continuous','Continuous soffit vent'],['vented','Vented soffit panels'],['roof','Roof / edge intake'],['other','Other intake']];
const exhaustTypes=[['unknown','Not sure'],['none','No exhaust'],['ridge','Ridge vent'],['static','Box / dome vents'],['turbine','Turbine vents'],['solar','Solar attic fan'],['powered','Powered attic fan'],['other','Other exhaust']];
function renderInventory(a,result){
 const outer=$('inventory-panel');outer.replaceChildren();
 const takeoff=el('div',{id:'intake-plan'});
 let panel=outer;
 if(mode==='plan'){
  outer.appendChild(el('h2',{class:'step-label',text:'3 · Intake'}));outer.appendChild(takeoff);
  const details=el('details',{id:'existing-intake'});details.open=inventoryOpen;
  details.appendChild(el('summary',{text:a.intake.length?'Existing intake · edit credit':'Credit existing intake (optional)'}));
  panel=el('div',{class:'existing-inventory'});details.appendChild(panel);outer.appendChild(details);
  panel.appendChild(el('p',{class:'small',text:'Only enter intake you will keep. Unknown ratings cannot receive credit.'}));
 }else{
  outer.appendChild(el('h2',{class:'step-label',text:'2 · Installed vents'}));
  outer.appendChild(el('p',{class:'small',text:'Choose known products or enter their rated net free area.'}));
 }
 for(const side of mode==='check'?['exhaust','intake']:['intake']){
 panel.appendChild(el('h3',{text:side==='intake'?'Existing intake':'Existing exhaust'}));
 for(const [i,r]of a[side].entries()){
 const fan=['solar','powered'].includes(r.type);const options=products.filter(p=>side==='intake'?p.kind==='intake':p.kind!=='intake');const block=el('div',{class:'inventory-row'});
 block.innerHTML=`<div class="inventory-grid"><label>Vent type<select class="vent-type">${(side==='intake'?intakeTypes:exhaustTypes).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label><label>Exact product<select class="vent-product"><option value="">Other / enter published rating</option>${options.map(p=>`<option value="${p.id}">${esc(p.brand+' '+p.name)}</option>`).join('')}</select></label></div>${fan?'':`<div class="field-row"><label>Capacity basis<select class="basis"><option value="unit">sq in per vent</option><option value="foot">sq in per linear foot</option><option value="area">sq in per sq ft of panel</option></select></label><label>${r.basis==='foot'?'Installed length · ft':r.basis==='area'?'Vented panel area · sq ft':'Number of vents'}<input class="quantity" type="number" min="0" step="${r.basis==='unit'?'1':'any'}" value="${Number.isFinite(r.quantity)?r.quantity:''}"></label><label>Rated NFA<input class="rating" type="number" min="0.01" step="any" value="${Number.isFinite(r.rating)?r.rating:''}"></label></div>`}<div class="row-source"></div><button type="button" class="text-button remove-row">Remove</button>`;
 const type=block.querySelector('.vent-type'),product=block.querySelector('.vent-product');type.value=r.type;product.value=r.product||'';
 const known=products.find(p=>p.id===r.product);if(known)block.querySelector('.row-source').innerHTML=productDetails(known);
 type.onchange=()=>{Object.assign(r,{type:type.value,product:'',rating:null,quantity:null,confirmed:false});render();};
 product.onchange=()=>{const p=products.find(p=>p.id===product.value);Object.assign(r,{product:product.value,rating:p?.nfa??null,confirmed:false,coverage:null,minimumIntake:null});if(p){r.type=p.kind==='intake'?'roof':p.kind;r.basis=p.unit==='linear ft'?'foot':'unit';if(p.kind==='solar'){r.quantity=1;r.minimumIntake=p.minIntakePerFan??null;const exact=p.sizingRows?.find(row=>row.area===a.area);if(exact)Object.assign(r,{quantity:exact.count,coverage:exact.area,minimumIntake:exact.intake});}}render();};
 if(fan)block.querySelector('.row-source').appendChild(solarFields(r,known));else{
 const basis=block.querySelector('.basis'),quantity=block.querySelector('.quantity'),rating=block.querySelector('.rating');basis.value=r.basis||'unit';
 for(const n of [basis,quantity,rating])n.disabled=['none','unknown'].includes(r.type);rating.readOnly=Boolean(r.product);basis.disabled ||= Boolean(r.product);
 basis.onchange=()=>{r.basis=basis.value;r.rating=null;r.product='';render();};quantity.onchange=()=>{r.quantity=number(quantity.value);render();};rating.onchange=()=>{r.rating=number(rating.value);render();};
 }
 block.querySelector('.remove-row').onclick=()=>{a[side].splice(i,1);render();};panel.appendChild(block);
 }
 const add=el('button',{type:'button',class:'text-button',text:`+ Add ${side} entry`});add.dataset.side=side;add.onclick=()=>{a[side].push({type:'unknown',quantity:null,rating:null,basis:'unit'});render();};panel.appendChild(add);
 const capacity=side==='intake'?assessInventory(effective(a).intake,0):assessInventory(a.exhaust,0,{exhaust:true});
 panel.appendChild(el('p',{class:'assessment',text:capacity.capacity===null?capacity.status:`${fmt(capacity.capacity)} sq in ${side} NFA recorded${mode==='plan'&&side==='intake'?' (including planned additions)':''}.`}));
 }
 panel.appendChild(el('p',{class:'small',text:'Use published net free area, not vent dimensions. Verify open paths, insulation baffles, distribution and roof compatibility.'}));
 if(mode==='check')outer.appendChild(takeoff);
}
function renderIntakePlan(a,result){
 const panel=$('intake-plan');if(mode!=='plan'){panel.innerHTML='';return;}
 const p=products.find(p=>p.id===a.intakeProduct&&p.kind==='intake');const target=result.intakeTarget;
 const capacity=assessInventory(effective(a).intake,0).capacity;const rating=p?.nfa??a.customIntakeRating;const basis=p?.unit==='linear ft'?'foot':a.customIntakeBasis||'unit';const takeoff=intakeTakeoff(target,capacity,rating,basis);
 panel.innerHTML=`<p class="small">${target!==null?`${fmt(target)} sq in NFA needed for this exhaust plan.`:'Confirm solar sizing to calculate intake.'}</p><label>Intake product<select id="intake-choice">${products.filter(p=>p.kind==='intake').map(p=>`<option value="${p.id}">${esc(p.brand+' '+p.name)} · ${p.nfa} NFA/ft</option>`).join('')}<option value="custom">Custom soffit / intake</option></select></label>${p?productDetails(p):`<div class="field-row"><label>Capacity basis<select id="custom-intake-basis"><option value="unit">sq in per vent</option><option value="foot">sq in per linear foot</option><option value="area">sq in per sq ft of panel</option></select></label><label>Published NFA<input id="custom-intake-rating" type="number" min="0.01" step="any" value="${Number.isFinite(a.customIntakeRating)?a.customIntakeRating:''}"></label></div>`}${takeoff&&(!a.plannedIntake.length||takeoff.quantity)?`<p class="takeoff-number"><strong>${takeoff.quantity} ${takeoff.unit}</strong> ${takeoff.quantity?'to add':'additional intake needed'}</p><p class="small">${takeoff.quantity?`${takeoff.quantity} × ${rating} = ${takeoff.capacity.toLocaleString()} sq in added NFA.`:'Recorded intake already meets the selected requirement.'}${p?.pieceLength&&takeoff.quantity?` Order at least ${Math.ceil(takeoff.quantity/p.pieceLength)} × ${p.pieceLength}-ft sections, trimmed to the installed length.`:''}</p>${takeoff.existingUnknown?'<p class="notice">No existing intake credit. This amount covers the full requirement.</p>':''}${takeoff.quantity?'<button type="button" id="apply-intake">Use this intake</button>':''}`:takeoff?'<p class="small">Planned intake meets the requirement.</p>':'<p class="small">Enter a rating to calculate quantity.</p>'}<div id="planned-intake-rows"></div>`;
 $('intake-choice').value=a.intakeProduct||'oc-inflow';$('intake-choice').onchange=e=>{a.intakeProduct=e.target.value;render();};
 if(!p){$('custom-intake-basis').value=basis;$('custom-intake-basis').onchange=e=>{a.customIntakeBasis=e.target.value;a.customIntakeRating=null;render();};$('custom-intake-rating').onchange=e=>{a.customIntakeRating=number(e.target.value);render();};}
 if($('apply-intake'))$('apply-intake').onclick=()=>{a.plannedIntake.push({type:'roof',product:p?.id||'',label:p?`${p.brand} ${p.name}`:'Custom intake',quantity:takeoff.quantity,rating,basis});render();};
 for(const [i,r]of a.plannedIntake.entries()){const row=el('div',{class:'planned-row'});row.innerHTML=`<p>${esc(r.label)} · ${r.quantity} ${r.basis==='foot'?'ft':r.basis==='area'?'sq ft':'vents'} · ${(r.quantity*r.rating).toLocaleString()} sq in</p><button type="button" class="text-button">Remove</button>`;row.querySelector('button').onclick=()=>{a.plannedIntake.splice(i,1);render();};$('planned-intake-rows').appendChild(row);}
}
async function init(){
 const [,catalog]=await Promise.all([loadComponents(),loadVentilationProducts()]);products=catalog.products;
 restoreDraft();$('planner-status').hidden=true;$('start-manual').disabled=false;$('start-upload').disabled=false;
 initMeasurementUpload((sections,applyMode)=>{if(applyMode==='replace')attics=[];for(const s of sections){const estimate=estimateAtticFloorArea({segments:s.segments});attics.push({...newAttic(s.label),area:estimate.atticSquareFootage,method:estimate.method,segments:s.segments,origin:'Imported from report'});}active=attics.length-sections.length;$('upload-panel').hidden=true;render();announce('Measurements imported.');});
 render();
}
init().catch(()=>{$('planner-status').replaceChildren(loadError('The planner could not load. Please reload.'));});
