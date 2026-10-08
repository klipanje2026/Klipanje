// Preserve each renderer and saved style id; group their library presentation.
export const inkMixBase='collectionStudioKineticInk';
export const inkMixVariants=[
 {value:inkMixBase,label:'Ink Ladder · osnovna'},
 {value:'collectionStudioAmplifyFlex',label:'Flexline'},
 {value:'collectionStudioAmplifyRiso',label:'Riso Wave'},
 {value:'collectionStudioAmplifyFold',label:'Fold Signal'},
 {value:'collectionStudioAmplifyGlass',label:'Glass Pulse'},
 {value:'collectionStudioAmplifyPunch',label:'Punchcut'},
 {value:'collectionStudioAmplifyRelay',label:'Paper Relay'},
 {value:'collectionStudioAmplifyDouble',label:'Double Take'},
] as const;
export const isInkMixStyle=(key:string)=>inkMixVariants.some(item=>item.value===key);
