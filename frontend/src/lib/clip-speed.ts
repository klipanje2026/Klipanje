// Clip in/out points stay in timeline seconds. Multiply by rate only at the media boundary.
import type {AudioEnvelope} from './audio-envelope';
export type RatedClip={audioEnvelope?:AudioEnvelope;playbackRate?:number;start:number;inPoint:number;outPoint:number};
export function clipRate(clip:Pick<RatedClip,'playbackRate'>){return Number.isFinite(clip.playbackRate)?Math.max(.1,Math.min(2,clip.playbackRate!)):1;}
export function clipSourceTime(clip:RatedClip,time:number){return (clip.inPoint+Math.max(0,time-clip.start))*clipRate(clip);}
export function retimeClip<T extends RatedClip>(clip:T,rate:number):T{
 const next=clipRate({playbackRate:rate}),factor=clipRate(clip)/next;
 const audioEnvelope=clip.audioEnvelope?Object.fromEntries(Object.entries(clip.audioEnvelope).filter(([,ramp])=>!!ramp).map(([key,ramp])=>[key,{...ramp,start:ramp.start*factor,duration:ramp.duration*factor}])) as AudioEnvelope:undefined;
 return {...clip,playbackRate:next,inPoint:clip.inPoint*factor,outPoint:clip.outPoint*factor,...audioEnvelope?{audioEnvelope}:{}};
}
