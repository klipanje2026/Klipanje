import type {Asset,Script} from './production';
import {narrationCoverage} from './narration-coverage';
import {fitNarration} from './narration-sync';
export function frameNarration(script:Script,assets:Asset[],id:string){
 const available=assets.filter(a=>!a.metadata.archived&&a.contentType.startsWith('audio/')&&!['sound','music'].includes(a.metadata.audioRole||'')&&a.metadata.scriptId===script.id);
 const chosen=available.find(a=>a.id===script.photo_settings.narrationPlan?.scenes[id]?.assetId);
 return chosen||available.filter(a=>{const c=narrationCoverage(a,script);return !c.approximate&&c.ids.includes(id);}).sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||'')).at(-1);
}
export function measuredFrameDuration(script:Script,asset:Asset,id:string){
 const timing=asset.metadata.narration;if(!timing?.duration)return undefined;
 const explicit=new Set([asset.metadata.segmentId,...asset.metadata.segmentIds||[],...timing.segmentIds||[],...Object.keys(script.photo_settings.narrationPlan?.scenes||{}).filter(key=>script.photo_settings.narrationPlan?.scenes[key]?.assetId===asset.id)]);
 const linked=script.segments.filter(s=>explicit.has(s.id)).map(s=>s.id);const ids=linked.length?linked:narrationCoverage(asset,script).ids.length?narrationCoverage(asset,script).ids:[id];
 const frames=script.segments.filter(s=>ids.includes(s.id));
 const measured=fitNarration(frames,{...timing,segmentIds:ids,sync:true},0).find(s=>s.id===id);
 return measured?Math.max(.1,measured.end-measured.start):undefined;
}
