import {captionOutputTime} from './caption-clock';
import type {CaptionSettings,Segment} from '../config/captions/types';
export type CaptionSoundEvent={start:number;kind:'whoosh'|'pop'|'tick';volume:number};
export function captionSounds(segments:Segment[],settings:CaptionSettings):CaptionSoundEvent[]{
 return segments.filter(s=>!s.effectOnly&&s.role!=='title').flatMap(s=>{const config=(s.separateStyle===false?undefined:s.detachedStyle?.settings)||s.laneStyle?.settings||settings;const kind=config.captionSound;if(!kind||kind==='none')return [];return [{start:captionOutputTime(s.start),kind,volume:Math.max(0,Math.min(1,(config.captionSoundVolume??25)/100))}];});
}
const samples=new Map<string,Float32Array>();
export function soundSamples(kind:CaptionSoundEvent['kind'],rate=48000){
 const key=kind+rate;let result=samples.get(key);if(result)return result;
 const duration=kind==='whoosh'?.28:kind==='pop'?.14:.065;result=new Float32Array(Math.ceil(rate*duration));let seed=12345,low=0;
 for(let i=0;i<result.length;i++){const t=i/rate,p=i/result.length;seed=(Math.imul(seed,1664525)+1013904223)|0;const noise=(seed>>>0)/2147483648-1;low+=.12*(noise-low);
 result[i]=kind==='whoosh'?low*Math.sin(Math.PI*p)**2*.8:Math.sin(2*Math.PI*(kind==='pop'?420*t-900*t*t:1400*t))*Math.exp(-p*9)*Math.min(1,p*35)*.3;}
 let peak=0;for(const value of result)peak=Math.max(peak,Math.abs(value));if(peak>0)for(let i=0;i<result.length;i++)result[i]*=.8/peak;
 samples.set(key,result);return result;
}
export function mixCaptionSounds(buffer:AudioBuffer,start:number,events:CaptionSoundEvent[]){
 const rate=buffer.sampleRate;
 for(const event of events){const samples=soundSamples(event.kind,rate),offset=Math.round((event.start-start)*rate);if(offset>=buffer.length||offset+samples.length<=0)continue;
 for(let channel=0;channel<buffer.numberOfChannels;channel++){const dest=buffer.getChannelData(channel);for(let i=Math.max(0,-offset);i<Math.min(samples.length,buffer.length-offset);i++)dest[offset+i]+=samples[i]*event.volume;}}
 // Prevent digital clipping when an effect overlaps a loud source.
 for(let channel=0;channel<buffer.numberOfChannels;channel++){const dest=buffer.getChannelData(channel);for(let i=0;i<dest.length;i++)dest[i]=Math.max(-1,Math.min(1,dest[i]));}
}
