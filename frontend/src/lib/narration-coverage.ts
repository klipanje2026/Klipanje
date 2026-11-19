import type {Asset, Script} from './production';

const words=(text:string)=>text.replace(/\[[^\]\r\n]*\]/g,' ').replace(/\*\*/g,'').replace(/(^|\n)\s*[\p{L} ]{1,30}:\s*/gu,' ').toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu,'').match(/[\p{L}\p{N}]+/gu)||[];
export function narrationCoverage(asset:Asset,script:Pick<Script,'id'|'segments'>&Partial<Pick<Script,'photo_settings'>>){
 const m=asset.metadata;
 if(m.archived||m.scriptId!==script.id||!(m.audioRole==='narration'||m.purpose==='narration'))return {ids:[] as string[],approximate:false};
 const stored=new Set([...(m.segmentIds?.length?m.segmentIds:[m.segmentId]),...m.narration?.segmentIds||[]]);
 const explicit=script.segments.filter(s=>stored.has(s.id));
 // A saved selection can recover an older recording after interval IDs changed.
 const scenes=script.photo_settings?.narrationPlan?.scenes;
 const selected=explicit.length?explicit:script.segments.filter(s=>asset.id&&scenes?.[s.id]?.assetId===asset.id);
 return {ids:selected.map(s=>s.id),approximate:false};
}
export function narrationCoverageLabel(ids:string[],segments:Script['segments']){
 const numbers=segments.flatMap((s,i)=>ids.includes(s.id)?[i+1]:[]),ranges:string[]=[];
 for(let i=0;i<numbers.length;i++){const start=numbers[i];let end=start;while(numbers[i+1]===end+1)end=numbers[++i];ranges.push(start===end?String(start):`${start}–${end}`);}
 return numbers.length?(numbers.length===1?'Kadar ':'Kadrovi ')+ranges.join(', '):'Kadar nije prepoznat';
}

export function narrationTextMatches(asset:Asset,text:string){const target=words(text).join(" "),source=words(asset.metadata.narration?.text||"").join(" ");return Boolean(target&&source&&(" "+source+" ").includes(" "+target+" "));}
