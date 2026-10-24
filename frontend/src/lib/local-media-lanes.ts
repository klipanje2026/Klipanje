import {linkedTo,type LinkedClip} from './linked-clips';
export function localMediaLanes<T extends LinkedClip&{audioRole?:'narration'|'sound'|'music'}>(clips:T[]){
 const images=clips.filter(c=>c.type==='video');
 // Story groups also link narration to images; an explicit role takes priority.
 const isSound=(clip:T)=>clip.audioRole?clip.audioRole==='sound':images.some(v=>linkedTo(v,clip));
 return [{key:'images',label:'Slike',clips:images,audio:false},{key:'narration',label:'Naracija',clips:clips.filter(c=>c.type==='audio'&&c.audioRole!=='music'&&!isSound(c)),audio:true},{key:'sounds',label:'Zvučni efekti',clips:clips.filter(c=>c.type==='audio'&&c.audioRole!=='music'&&isSound(c)),audio:true},{key:'music',label:'Pozadinska muzika',clips:clips.filter(c=>c.type==='audio'&&c.audioRole==='music'),audio:true}];
}
