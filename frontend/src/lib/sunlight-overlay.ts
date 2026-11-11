import {createOverlay,type Overlay,type OverlayPreset} from './video-overlays';
import type {SunlightMotion} from './sunlight-motion';
export const sunlightPreset:OverlayPreset={id:'sunlight',category:'Efekti',name:'Presijavanje sunca',symbol:'☀',value:{kind:'sunlight',text:'Presijavanje sunca',width:100,height:100,x:50,y:50,sunlight:true,animation:'none'}};
/** Upgrade saved clip settings without altering the clips' timing or other effects. */
export function migrateSunlight<T extends SunlightMotion & {id:string;start:number;inPoint:number;outPoint:number;playbackRate?:number;speed?:number}>(clips:T[],overlays:Overlay[]){
 const next=[...overlays];
 const migrated=clips.map(clip=>{
  if(!clip.sunlight)return clip;
  const end=clip.start+Math.max(.1,clip.outPoint-clip.inPoint),start=clip.start+Math.max(0,clip.sunlightDelay||0);
  if(start<end&&!next.some(o=>o.id===`sunlight-${clip.id}`))next.push({...createOverlay(sunlightPreset,start,end),id:`sunlight-${clip.id}`,start,end,sunlightStrength:clip.sunlightStrength??.55,sunlightSpeed:clip.sunlightSpeed??1,sunlightSide:clip.sunlightSide??'left'});
  return {...clip,sunlight:false};
 });
 return {clips:migrated,overlays:next};
}
