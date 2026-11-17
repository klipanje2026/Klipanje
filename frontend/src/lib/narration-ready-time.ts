type Voice={id:string;type:string;audioRole?:string;muted:boolean;start:number;inPoint:number;outPoint:number;playbackRate?:number};
type Playback={paused:boolean;seeking:boolean;readyState:number;ended?:boolean;currentTime?:number;pending?:boolean};
/** Hold the preview clock at narration boundaries until audio can actually start. */
export function narrationReadyTime(current:number,next:number,clips:Voice[],state:(id:string)=>Playback|undefined){
 if(next<current)return next;
 let limit=next;
 for(const c of clips){if(c.type!=='audio'||c.muted||c.audioRole==='sound'||c.audioRole==='music')continue;
  if(c.start>current&&c.start<=limit){limit=c.start;continue;}
  if(current>=c.start&&current<c.start+c.outPoint-c.inPoint){const media=state(c.id);if(media?.ended)continue;if(!media||media.pending||media.paused||media.seeking||media.readyState<2)return current;
   // paused=false does not mean sound has started: play() can still be pending.
   // Follow decoded audio, not wall time, so cold starts cannot eat the first word.
   if(Number.isFinite(media.currentTime)){const rate=Math.max(.1,c.playbackRate||1);const heard=c.start+media.currentTime!/rate-c.inPoint;limit=Math.min(limit,Math.max(current,heard+.025));}
  }
 }
 return limit;
}
