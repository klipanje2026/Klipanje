import type {Asset,Script} from './production';
import {galleryScene} from './gallery-order';
import {narrationCoverage} from './narration-coverage';
/** Choose the selected narration, otherwise newest exact take; never import every revision. */
export function completedFrames(assets:Asset[],script:Script,importedIds:string[]=[]){
 const own=assets.filter(a=>!a.metadata.archived&&a.metadata.scriptId===script.id);
 const images=own.filter(a=>a.contentType.startsWith('image/')&&a.metadata.gallery!==false&&!a.metadata.filler);
 const takes=own.filter(a=>a.contentType.startsWith('audio/')).map(a=>({asset:a,...narrationCoverage(a,script)})).filter(t=>!t.approximate&&t.ids.length).sort((a,b)=>(b.asset.created_at||'').localeCompare(a.asset.created_at||'')||b.asset.id.localeCompare(a.asset.id));
 const photosFor=(id:string)=>images.filter(a=>(a.metadata.segmentIds||[a.metadata.segmentId]).includes(id)||!a.metadata.manualFrames&&script.segments[galleryScene(a,script)]?.id===id);
 const chosen=new Set(Object.values(script.photo_settings.narrationPlan?.scenes||{}).map(s=>s.assetId));
 takes.sort((a,b)=>Number(importedIds.includes(b.asset.id))-Number(importedIds.includes(a.asset.id))||Number(chosen.has(b.asset.id))-Number(chosen.has(a.asset.id)));
 const used=new Set<string>(),selected:typeof takes=[];
 for(const take of takes){if(take.ids.some(id=>used.has(id)||!photosFor(id).length))continue;selected.push(take);take.ids.forEach(id=>used.add(id));}
 const ready=script.segments.filter(s=>used.has(s.id)).map(s=>({id:s.id,photos:photosFor(s.id),take:selected.find(t=>t.ids.includes(s.id))!}));
 const ids=ready.map(r=>r.id),entries:{asset:Asset;ids:string[];audio:boolean}[]=[];
 for(const row of ready){const take=row.take!;if(!entries.some(e=>e.asset.id===take.asset.id))entries.push({asset:take.asset,ids:take.ids,audio:true});}
 for(const row of ready)for(const asset of row.photos){const entry=entries.find(e=>e.asset.id===asset.id);if(entry)entry.ids.push(row.id);else entries.push({asset,ids:[row.id],audio:false});}
 return {ids,entries};
}

type SceneMedia={id:string;groupId?:string;segmentIds?:string[];narrationSegmentIds?:string[]};
export function linkCompletedMedia<T extends SceneMedia>(clips:T[],frameIds:string[]):T[]{
 const next=clips.map(c=>({...c})),remaining=new Set(next.filter(c=>(c.segmentIds||c.narrationSegmentIds||[]).some(id=>frameIds.includes(id))));
 while(remaining.size){const first=remaining.values().next().value!;const group=[first],ids=new Set(first.segmentIds||first.narrationSegmentIds||[]);remaining.delete(first);
  let changed=true;while(changed){changed=false;for(const c of remaining){const coverage=c.segmentIds||c.narrationSegmentIds||[];if(coverage.some(id=>ids.has(id))){group.push(c);coverage.forEach(id=>ids.add(id));remaining.delete(c);changed=true;}}}
  const groupId=first.groupId||crypto.randomUUID();group.forEach(c=>{c.groupId=groupId;});
 }
 return next;
}
