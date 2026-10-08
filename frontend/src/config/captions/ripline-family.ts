// Keep persisted style identities; only group their library presentation.
export const riplineBase='collectionStudioFinishRipline';
export const riplineVariants=[
 {value:riplineBase,label:'Finish'},
 {value:'collectionStudioColorDuotone',label:'Duotone'},
 {value:'collectionStudioColorPigment',label:'Pigment'},
 {value:'collectionStudioColorLuma',label:'Luma'},
] as const;
export const isRiplineStyle=(key:string)=>riplineVariants.some(item=>item.value===key);
