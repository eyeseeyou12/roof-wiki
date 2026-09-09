// Manufacturer sources checked 2026-09-09. Capacity is not installation approval.
export const plannerProducts = [
 {id:'rigid3',kind:'ridge',brand:'GAF',name:'Cobra Rigid Vent 3',nfa:18,unit:'linear ft',source:'https://www.gaf.com/en-us/roofing-materials/residential-roofing-materials/attic-vents-other-ventilation/cobra-rigid-vent-3-premium-exhaust-vent-for-roof-ridge'},
 {id:'runner',kind:'ridge',brand:'GAF',name:'Cobra RidgeRunner',nfa:12.5,unit:'linear ft',source:'https://www.gaf.com/en-us/roofing-materials/residential-roofing-materials/attic-vents-other-ventilation/cobra-ridgerunner-exhaust-vent-for-roof-ridge'},
 {id:'750g',kind:'static',brand:'Lomanco',name:'750-G',nfa:50,unit:'vents',source:'https://www.lomanco.com/lmc-gallery/700-series/'},
];
export const solarProduct = {
 name:'GAF Master Flow GreenMachine PRSOLAR2',
 source:'https://www.gaf.com/en-us/document-library/documents/data-sheets/master-flow-greenmachine-high-power-solar-roof-vent-sell-sheet-resmf163.pdf',
 verifiedOn:'2026-09-09',revision:'RESMF163-0724',cfm:750,watts:35,minPitch:2,maxPitch:12,
 // Preserve published rows exactly. Coverage headline and sizing table differ;
 // do not extrapolate a count from watts, CFM, or the 1,070 sq ft headline.
 sizingRows:[{area:800,count:1,intake:360},{area:1600,count:2,intake:720},{area:2400,count:3,intake:1080},{area:3200,count:5,intake:1800}]
};
