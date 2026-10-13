import type {Segment} from '../config/captions/presets';
type ImageClip={id:string;assetId:string;segmentIds?:string[];frameStrength?:number;sceneSlice?:{index:number;count:number};start:number;inPoint:number;outPoint:number};
export function layoutFrameImages<T extends ImageClip>(clips:T[],segments:Segment[],imageIds:Set<string>,counts:Record<string,number>={},only?:string[]):T[]{
 const key=(ids:string[])=>[...ids].sort().join('|');
 const groups=new Map<string,T[]>();
 for(const c of clips){if(!imageIds.has(c.assetId)||!c.segmentIds?.length||only&&key(c.segmentIds)!==key(only))continue;const k=key(c.segmentIds);groups.set(k,[...(groups.get(k)||[]),c]);}
 const updates=new Map<string,T>();
 for(const group of groups.values()){
  const ids=group[0].segmentIds!,targets=segments.filter(s=>ids.includes(s.sourceSceneId||s.id)||ids.includes(s.id));if(!targets.length)continue;
  const start=Math.min(...targets.map(s=>s.start)),end=Math.max(...targets.map(s=>s.end));
  const override=group.find(c=>c.frameStrength!==undefined)?.frameStrength;
  const count=Math.max(group.length,override===undefined?(counts[ids[0]]||1):Math.round(override*ids.length),1);
  group.forEach((c,index)=>updates.set(c.id,{...c,frameStrength:override===undefined?undefined:count/ids.length,sceneSlice:{index,count},start:start+(end-start)*index/count,outPoint:c.inPoint+(end-start)/count}));
 }
 return clips.map(c=>updates.get(c.id)||c);
}
export function frameStrengthValue(clip:ImageClip){return clip.frameStrength??(clip.sceneSlice?.count||1)/Math.max(1,clip.segmentIds?.length||1);}
