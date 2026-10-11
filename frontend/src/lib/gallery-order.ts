import type {Asset,Script} from './production';

export function orderedGallery(assets:Asset[],script:Script,projectName:string,order:'scene'|'created'='scene'){
 const scene=(a:Asset)=>{const i=script.segments.findIndex(s=>s.id===a.metadata.segmentId);return i<0?script.segments.length+1:i+1;};
 const ordered=[...assets].sort((a,b)=>(order==='scene'?scene(a)-scene(b):0)||(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id));
 const prefix=projectName.trim().replace(/[\\/:*?"<>|]/g,'-')||'Projekat';
 const episode=String(Number(script.title.match(/\d+/)?.[0]||1));
 const chronological=[...assets].sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id));
 return ordered.map(asset=>{const index=(asset.metadata.sequence||chronological.findIndex(a=>a.id===asset.id)+1)-1;const ext=asset.contentType==='image/jpeg'?'jpg':asset.contentType==='image/webp'?'webp':asset.contentType==='image/png'?'png':asset.name.split('.').pop()||'mp4';
  return {asset,number:index+1,name:`${prefix}-ep${episode}-${String(index+1).padStart(3,'0')}.${ext}`};
 });
}
