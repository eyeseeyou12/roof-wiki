// Planning comparisons are conditional on installation verification, not certifications.
export function shortlist(products, target, ridge = null) {
  return products.filter(p => p.kind === 'ridge' || p.kind === 'static').map(p => {
    const quantity = Math.ceil(target / p.nfa);
    return {...p, quantity, capacity: quantity * p.nfa,
      fits: p.kind !== 'ridge' || ridge === null || quantity <= ridge,
      status: p.kind === 'ridge' && ridge === null ? 'Needs ridge verification' : 'Capacity fits; verify installation'};
  });
}
export function assessInventory(rows, target, {exhaust = false} = {}) {
  if (!rows.length || rows.some(r => r.type === 'unknown')) return {status:'Unable to evaluate', capacity:null, shortfall:null};
  const active = rows.filter(r => r.type !== 'none');
  if (exhaust && new Set(active.map(r => r.type)).size > 1) return {status:'Existing configuration needs review',capacity:null,shortfall:null};
  if (rows.some(r => r.type === 'none') && active.length) return {status:'Conflicting inventory: remove no-vent entry',capacity:null,shortfall:null};
  if (active.some(r => r.type === 'solar' || r.type === 'powered')) return {status:'Manufacturer sizing needed', capacity:null, shortfall:null};
  if (active.some(r => !Number.isFinite(r.quantity) || r.quantity < 0 || !Number.isFinite(r.rating) || r.rating <= 0)) return {status:'Capacity information needed',capacity:null,shortfall:null};
  const capacity = active.reduce((sum,r) => sum + r.quantity*r.rating,0);
  return {capacity,shortfall:Math.max(0,target-capacity),status:capacity>=target?'Rated capacity target met':'Additional capacity needed'};
}
