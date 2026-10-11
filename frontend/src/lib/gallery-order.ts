import type {Asset,Script} from './production';

export function orderedGallery(assets:Asset[],script:Script,projectName:string,order:'scene'|'created'='scene'){
 const scene=(a:Asset)=>{const i=script.segments.findIndex(s=>s.id===a.metadata.segmentId);return i<0?script.segments.length+1:i+1;};
 const ordered=[...assets].sort((a,b)=>(order==='scene'?scene(a)-scene(b):0)||(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id));
 const prefix=projectName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').slice(0,4).toUpperCase()||'PROJ';
 const episode=String(Number(script.title.match(/\d+/)?.[0]||1)).padStart(2,'0');
 const variants=new Map<number,number>();
 return ordered.map((asset,index)=>{const n=scene(asset),variant=(variants.get(n)||0)+1;variants.set(n,variant);const ext=asset.contentType==='image/jpeg'?'jpg':asset.contentType==='image/webp'?'webp':asset.contentType==='image/png'?'png':asset.name.split('.').pop()||'mp4';
  return {asset,number:index+1,name:`${prefix}-ep${episode}-scene${String(n).padStart(2,'0')}-${String(variant).padStart(2,'0')}.${ext}`};
 });
}
