import type {Interval} from './production';
import {narrationParts,estimateSpeech} from './local-timeline';
import {narrationText} from './narration-sync';

export function appendScriptIntervals(existing:Interval[],text:string,keepQuotes:boolean,wpm:number):Interval[]{
 const parts=narrationParts(narrationText(text,keepQuotes)).filter(part=>part.trim());
 if(!parts.length)return existing;
 let start=Math.ceil(existing.reduce((end,item)=>Math.max(end,item.end),0)*10)/10;
 const added=parts.map(text=>{
  const end=Math.round((start+estimateSpeech(text,wpm))*10)/10;
  const interval={id:crypto.randomUUID(),start,end,text:text.trim(),prompt:''};
  start=end;
  return interval;
 });
 return [...existing,...added];
}
