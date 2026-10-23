import type {Asset,Script} from './production';

const normalized=(text:string)=>text.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function contextContains(context:string,text:string){
 if((' '+context+' ').includes(' '+text+' '))return true;
 const target=text.split(' '),source=context.split(' ');
 if(target.length<6)return false;
 // Recover small wording edits without guessing from filenames or image order.
 const allowance=Math.floor(target.length*.18);
 for(let length=Math.max(1,target.length-allowance);length<=Math.min(source.length,target.length+allowance);length++)for(let start=0;start+length<=source.length;start++){
  let row=Array.from({length:length+1},(_,i)=>i);
  for(let i=0;i<target.length;i++){const next=[i+1];for(let j=0;j<length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(target[i]===source[start+j]?0:1)));row=next;}
  if(row[length]<=allowance)return true;
 }
 return false;
}
/** Resolve saved IDs first, then recover only unambiguous stored text/prompt matches. */
export function galleryScene(asset:Asset,script:Script){
 const direct=script.segments.findIndex(s=>s.id===asset.metadata.segmentId||asset.metadata.segmentIds?.includes(s.id));
 if(direct>=0)return direct;
 const context=normalized(asset.metadata.fullPrompt?.match(/Narration context:\s*([\s\S]*?)(?:\n\s*Scene direction:|$)/i)?.[1]||'');
 if(context){const matches=script.segments.flatMap((s,i)=>{const text=normalized(s.text.replace(/\*\*/g,'').replace(/^[^:\n]{1,30}:\s*/,''));return text.length>=8&&contextContains(context,text)?[i]:[];});if(matches.length&&matches.every((n,i)=>!i||n===matches[i-1]+1))return matches[0];}
 const prompt=normalized(asset.metadata.prompt||'');if(prompt.length<20)return -1;
 const candidates=script.segments.map((s,i)=>{const texts=[s.prompt,...(script.photo_settings.prompts?.[s.id]||[]).map(p=>p.text),...(script.photo_settings.generationPrompts||[]).filter(p=>p.segment===s.id).map(p=>p.text),script.photo_settings.groupPrompts?.[s.id]].filter((t):t is string=>!!t).map(normalized);return {i,exact:texts.includes(prompt),contained:texts.some(t=>t.length>=30&&(prompt.includes(t)||t.includes(prompt)))};});
 const exact=candidates.filter(c=>c.exact);if(exact.length===1)return exact[0].i;if(exact.length>1)return -1;
 const contained=candidates.filter(c=>c.contained);return contained.length===1?contained[0].i:-1;
}

export function orderedGallery(assets:Asset[],script:Script,projectName:string,order:'scene'|'created'='scene'){
 const scene=(a:Asset)=>{const i=galleryScene(a,script);return i<0?script.segments.length+1:i+1;};
 const ordered=[...assets].sort((a,b)=>(order==='scene'?scene(a)-scene(b):0)||(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id));
 const prefix=projectName.trim().replace(/[\\/:*?"<>|]/g,'-')||'Projekat';
 const episode=String(Number(script.title.match(/\d+/)?.[0]||1));
 const chronological=[...assets].sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id));
 return ordered.map(asset=>{const index=(asset.metadata.sequence||chronological.findIndex(a=>a.id===asset.id)+1)-1;const ext=asset.contentType==='image/jpeg'?'jpg':asset.contentType==='image/webp'?'webp':asset.contentType==='image/png'?'png':asset.name.split('.').pop()||'mp4';
  return {asset,number:index+1,name:`${prefix}-ep${episode}-${String(index+1).padStart(3,'0')}.${ext}`};
 });
}
