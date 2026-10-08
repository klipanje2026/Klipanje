import type {Segment} from '../config/captions/types';
import type {TranscriptWord} from './transcription-client';
export type NumberDisplay='digits'|'words';
const storageKey='edita-number-display';
export function numberDisplay():NumberDisplay{try{return localStorage.getItem(storageKey)==='words'?'words':'digits';}catch{return 'digits';}}
export function saveNumberDisplay(value:NumberDisplay){try{localStorage.setItem(storageKey,value);}catch{}}
const units=['nula','jedan','dva','tri','četiri','pet','šest','sedam','osam','devet'];
const teens=['deset','jedanaest','dvanaest','trinaest','četrnaest','petnaest','šesnaest','sedamnaest','osamnaest','devetnaest'];
const tens=['','','dvadeset','trideset','četrdeset','pedeset','šezdeset','sedamdeset','osamdeset','devedeset'];
const hundreds=['','sto','dvjesto','tristo','četiristo','petsto','šeststo','sedamsto','osamsto','devetsto'];
const values=new Map<string,number>([...units.map((w,i)=>[w,i] as [string,number]),...teens.map((w,i)=>[w,i+10] as [string,number]),...tens.flatMap((w,i)=>w?[[w,i*10] as [string,number]]:[]),...hundreds.flatMap((w,i)=>w?[[w,i*100] as [string,number]]:[]),['jedna',1],['jedno',1],['dvije',2],['dve',2],['dvesta',200],['trista',300],['četristo',400]]);
const scales=new Map([['hiljada',1000],['hiljade',1000],['hiljadu',1000],['tisuća',1000],['tisuće',1000],['tisuću',1000],['milion',1000000],['miliona',1000000],['milijun',1000000],['milijuna',1000000]]);
function spell(n:number):string{
 if(n<10)return units[n];if(n<20)return teens[n-10];
 if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+spell(n%10):'');
 if(n<1000)return hundreds[Math.floor(n/100)]+(n%100?' '+spell(n%100):'');
 const scale=n>=1000000?1000000:1000,count=Math.floor(n/scale),last=count%100;
 const noun=scale===1000?(last%10===1&&last!==11?'hiljada':last%10>=2&&last%10<=4&&(last<12||last>14)?'hiljade':'hiljada'):(last%10===1&&last!==11?'milion':'miliona');
 const lead=scale===1000?spell(count).replace(/jedan$/,'jedna').replace(/dva$/,'dvije'):spell(count);
 return lead+' '+noun+(n%scale?' '+spell(n%scale):'');
}
const token=(text:string)=>text.match(/^([„“"(]*)([\p{L}\d]+)([,.!?;:…)”"]*)$/u);
/** Conservative cardinal numbers only: leave dates, ordinals, decimals and identifiers unchanged. */
export function formatTranscriptNumbers(words:TranscriptWord[],mode=numberDisplay()):TranscriptWord[]{
 const result:TranscriptWord[]=[];
 for(let i=0;i<words.length;i++){
  const word=words[i],match=token(word.text||'');if(!match||word.type==='spacing'||word.type==='audio_event'){result.push(word);continue;}
  const [,prefix,body,suffix]=match;
  if(mode==='words'){
   if(!/^(0|[1-9]\d{0,8})$/.test(body)||suffix.startsWith('.')){result.push(word);continue;}
   const parts=spell(Number(body)).split(' '),start=word.start,end=word.end;
   parts.forEach((text,index)=>result.push({...word,text:(index===0?prefix:'')+text+(index===parts.length-1?suffix:''),start:start===undefined||end===undefined?start:start+(end-start)*index/parts.length,end:start===undefined||end===undefined?end:start+(end-start)*(index+1)/parts.length}));continue;
  }
  let sum=0,group=0,rank=Infinity,lastScale=Infinity,j=i,tail=suffix,consumed=false;
  for(;j<words.length;j++){
   const m=token(words[j].text||'');if(!m||j>i&&m[1]||j>i&&words[j].start!==undefined&&words[j-1].end!==undefined&&words[j].start!-words[j-1].end!>.7)break;
   const value=values.get(m[2].toLocaleLowerCase('bs')),scale=scales.get(m[2].toLocaleLowerCase('bs'));
   if(scale!==undefined){if(scale>=lastScale)break;sum+=(group||1)*scale;group=0;rank=Infinity;lastScale=scale;}
   else if(value!==undefined){if(rank===10&&(value===0||value>=10))break;const nextRank=value>=100?100:value>=20&&value%10===0?10:1;if(nextRank>=rank)break;group+=value;rank=nextRank;}
   else break;
   consumed=true;tail=m[3];if(tail){j++;break;}
  }
  if(consumed){result.push({...word,text:prefix+String(sum+group)+tail,end:words[j-1].end});i=j-1;}else result.push(word);
 }
 return result;
}
export function formatNumberText(text:string,mode=numberDisplay()):string{return text.split('\n').map(line=>formatTranscriptNumbers(line.split(/\s+/).filter(Boolean).map(text=>({text})),mode).map(w=>w.text).join(' ')).join('\n');}

/** Apply to existing captions without replacing segment IDs, timing or style settings. */
export function formatCaptionNumbers(segments:Segment[],mode:NumberDisplay):Segment[]{
 const indexMaps=new Map<string,Map<number,number>>();
 const updated=segments.map(segment=>{
  const tokens=segment.text.trim().split(/\s+/).filter(Boolean);
  const timed=segment.words?.length===tokens.length&&segment.words.every((w,i)=>w.text===tokens[i]);
  let offset=0;
  const output:Array<TranscriptWord&{origin:number}>=[];
  const lines=segment.text.split('\n').map(line=>{
   const input=line.split(/\s+/).filter(Boolean).map(text=>{const origin=offset++;return {...(timed?segment.words![origin]:{}),text,origin};});
   const converted=formatTranscriptNumbers(input,mode) as typeof input;
   output.push(...converted);return converted.map(w=>w.text).join(' ');
  });
  const text=lines.join('\n');if(text===segment.text)return segment;
  const mapping=new Map<number,number>();
  output.forEach((word,index)=>{
   const end=output.slice(index+1).find(w=>w.origin!==word.origin)?.origin??tokens.length;
   for(let i=word.origin;i<end;i++)if(!mapping.has(i))mapping.set(i,index);
  });
  indexMaps.set(segment.id,mapping);
  const remap=(value:number|null|undefined)=>value==null?value:mapping.get(value);
  const wordStyles:Segment['wordStyles']={},wordOffsets:Segment['wordOffsets']={};
  output.forEach((word,index)=>{
   const old=segment.wordStyles?.[word.origin],position=segment.wordOffsets?.[word.origin];
   if(old)wordStyles[index]={...old,text:word.text!};
   if(position)wordOffsets[index]={...position,text:word.text!};
  });
  return {...segment,text,words:timed?output.map(w=>({text:w.text!,start:w.start!,end:w.end!})):undefined,
   wordStyles:segment.wordStyles?wordStyles:undefined,wordOffsets:segment.wordOffsets?wordOffsets:undefined,
   keywordWord:remap(segment.keywordWord),headingWord:remap(segment.headingWord),
   hiddenTitleWords:segment.hiddenTitleWords?.flatMap(i=>mapping.has(i)?[mapping.get(i)!]:[])};
 });
 return updated.map(segment=>{
  const map=segment.sourceCaptionId?indexMaps.get(segment.sourceCaptionId):undefined;
  return map&&segment.sourceWord!==undefined?{...segment,sourceWord:map.get(segment.sourceWord)}:segment;
 });
}
