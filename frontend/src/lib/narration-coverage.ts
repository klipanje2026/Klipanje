import type {Asset, Script} from './production';

const words=(text:string)=>text.replace(/\[[^\]\r\n]*\]/g,' ').replace(/\*\*/g,'').replace(/(^|\n)\s*[\p{L} ]{1,30}:\s*/gu,' ').toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu,'').match(/[\p{L}\p{N}]+/gu)||[];
function distance(a:string[],b:string[]){let row=b.map((_,i)=>i+1);row.unshift(0);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));row=next;}return row[b.length];}
export function narrationCoverage(asset:Asset,script:Pick<Script,'id'|'segments'>){
 const m=asset.metadata;
 if(m.archived||m.scriptId!==script.id||!(m.audioRole==='narration'||m.purpose==='narration'))return {ids:[] as string[],approximate:false};
 const known=new Set([m.segmentId,...m.segmentIds||[],...m.narration?.segmentIds||[]].filter(Boolean));
 const explicit=script.segments.filter(s=>known.has(s.id)).map(s=>s.id);
 const source=words(m.narration?.text||'');
 if(!source.length)return {ids:explicit,approximate:false};
 // Full-frame text containment survives regenerated IDs and a changed frame division.
 const sourceText=' '+source.join(' ')+' ';
 const exact=script.segments.filter(s=>{const text=words(s.text).join(' ');return text&&sourceText.includes(' '+text+' ');});
 const ids=new Set([...(explicit.length<=1?explicit:[]),...exact.map(s=>s.id)]);
 let approximate=false;
 for(const s of script.segments){
  if(ids.has(s.id))continue;
  const target=words(s.text);if(target.length<5||(exact.length&&source.length<target.length*1.5))continue;
  let best=0;
  // A small edit in an older take should remain discoverable, clearly marked.
  for(let length=Math.max(1,target.length-2);length<=Math.min(source.length,target.length+2);length++)for(let start=0;start+length<=source.length;start++){
   const score=1-distance(target,source.slice(start,start+length))/Math.max(target.length,length);best=Math.max(best,score);
  }
  if(best>=.82){ids.add(s.id);approximate=true;}
 }
 return {ids:script.segments.filter(s=>ids.has(s.id)).map(s=>s.id),approximate};
}
export function narrationCoverageLabel(ids:string[],segments:Script['segments']){
 const numbers=segments.flatMap((s,i)=>ids.includes(s.id)?[i+1]:[]),ranges:string[]=[];
 for(let i=0;i<numbers.length;i++){const start=numbers[i];let end=start;while(numbers[i+1]===end+1)end=numbers[++i];ranges.push(start===end?String(start):`${start}–${end}`);}
 return numbers.length?(numbers.length===1?'Kadar ':'Kadrovi ')+ranges.join(', '):'Kadar nije prepoznat';
}

export function narrationTextMatches(asset:Asset,text:string){const target=words(text).join(" "),source=words(asset.metadata.narration?.text||"").join(" ");return Boolean(target&&source&&(" "+source+" ").includes(" "+target+" "));}
