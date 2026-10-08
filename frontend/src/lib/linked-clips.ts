export type LinkedClip = {id:string;assetId:string;type:'video'|'audio';start:number;inPoint:number;outPoint:number;layer:number;groupId?:string;transition?:{id:string;duration:number}};
export function linkLegacyClips<T extends LinkedClip>(clips:T[]):T[] {
 const result=clips.map(c=>({...c}));
 for(const video of result.filter(c=>c.type==='video'&&!c.groupId)) {
  const audio=result.find(c=>c.type==='audio'&&!c.groupId&&c.assetId===video.assetId&&Math.abs(c.start-video.start)<.001&&Math.abs(c.inPoint-video.inPoint)<.001&&Math.abs(c.outPoint-video.outPoint)<.001);
  if(audio){video.groupId=audio.groupId=crypto.randomUUID();}
 }
 return result;
}
export function linkedTo(a:LinkedClip,b:LinkedClip){return a.id===b.id||Boolean(a.groupId&&a.groupId===b.groupId);}
export function updateLinked<T extends LinkedClip>(clips:T[],id:string,patch:Partial<T>):T[]{
 const selected=clips.find(c=>c.id===id);if(!selected)return clips;
 const timing:Partial<T>={};for(const key of ['start','inPoint','outPoint'] as const)if(patch[key]!==undefined)Object.assign(timing,{[key]:patch[key]});
 return clips.map(c=>c.id===id?{...c,...patch}:linkedTo(c,selected)?{...c,...timing}:c);
}
export function splitLinked<T extends LinkedClip>(clips:T[],selected:T,cuts:number[]):T[]{
 const bounds=[selected.inPoint,...cuts.filter(t=>t>selected.inPoint+.099&&t<selected.outPoint-.099),selected.outPoint];
 const groups=bounds.slice(1).map(()=>crypto.randomUUID());const top=Math.max(0,...clips.map(c=>c.layer));
 return clips.flatMap(c=>!linkedTo(c,selected)?[c]:bounds.slice(0,-1).map((start,i)=>({...c,transition:i===0?c.transition:undefined,id:i===0?c.id:crypto.randomUUID(),groupId:groups[i],inPoint:start,outPoint:bounds[i+1],start:selected.start+start-selected.inPoint,layer:c.type==='video'?(i===0?c.layer:top+i):c.layer})));
}
