import {linkedTo,type LinkedClip} from './linked-clips';
export function localMediaLanes<T extends LinkedClip&{audioRole?:'narration'|'sound'}>(clips:T[]){
 const images=clips.filter(c=>c.type==='video');
 const isSound=(clip:T)=>clip.audioRole==='sound'||images.some(v=>linkedTo(v,clip));
 return [{key:'images',label:'Slike',clips:images,audio:false},{key:'narration',label:'Naracija',clips:clips.filter(c=>c.type==='audio'&&!isSound(c)),audio:true},{key:'sounds',label:'Dodatni zvukovi',clips:clips.filter(c=>c.type==='audio'&&isSound(c)),audio:true}];
}
