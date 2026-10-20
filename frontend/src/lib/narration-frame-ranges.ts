import type {CaptionWord} from '../config/captions/presets';
/** Only cut audio; never create or rewrite script frames. */
export function narrationFrameRanges(texts:string[],words:CaptionWord[],duration:number){
 const weights=texts.map(t=>Math.max(1,t.replace(/\[[^\]]+\]/g,'').trim().split(/\s+/).length)),total=weights.reduce((a,b)=>a+b,0);
 let used=0,from=0;
 return weights.map((weight,i)=>{used+=weight;const index=Math.round(words.length*used/total);const to=i===weights.length-1?duration:Math.max(from,Math.min(duration,words[index]?.start??duration*used/total));const range={start:from,end:to};from=to;return range;});
}
