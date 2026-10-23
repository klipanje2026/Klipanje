import type {AudioEnvelope} from "./audio-envelope";
const defaults=new WeakMap<File,number>();
export function rememberSoundFade(file:File,seconds:number){defaults.set(file,seconds);return file;}
export function soundEnvelope(file:File,duration:number):AudioEnvelope|undefined{const seconds=defaults.get(file)||0;return Number.isFinite(seconds)&&seconds>0?{fadeIn:{start:0,duration:Math.min(seconds,duration)}}:undefined;}
