import type {Asset,Script} from './production';
import type {StillTransition} from './still-scenes';
import {galleryScene,orderedGallery} from './gallery-order';
import {narrationCoverage} from './narration-coverage';
import {scriptSourceKey,scriptChoices} from './script-montage-sync';
import {DEFAULT_CAPTION_SETTINGS} from '../config/captions/presets';
import {shiftSegment} from './local-timeline';
import {fitNarration} from './narration-sync';
import type {VideoCaptions} from './video-captions';
export type StoryBlock={id:string;sourceIds:string[];imageIds:string[];audioIds:string[];captionIds:string[];filler:boolean;duration:number;joinedBlocks?:StoryBlock[];audioRanges?:Record<string,{from:number;to:number}>};
export type StoryPlan={version:1;blocks:StoryBlock[];entryEnabled:boolean;exitEnabled:boolean;entry:StillTransition;exit:StillTransition|'heart';animationDuration:number;spacing:number;spacingMode:'overlap'|'gap'};
export const spokenText=(text:string)=>text.replace(/\*[^*]*\*/gs,'').trim();
export const directionOnly=(text:string)=>!!text.trim()&&!spokenText(text);
// Saved scene assignments and stable frame IDs survive pronunciation-only edits.
export function storyNarrationCoverage(asset:Asset,script:Script){
 const m=asset.metadata;
 if(m.archived||m.scriptId!==script.id||!(m.audioRole==='narration'||m.purpose==='narration'))return {ids:[] as string[],approximate:false};
 const choices=script.photo_settings.narrationPlan?.scenes||{};
 const known=new Set([m.segmentId,...m.segmentIds||[],...m.narration?.segmentIds||[]]);
 const ids=script.segments.filter(s=>choices[s.id]?.assetId===asset.id||known.has(s.id)&&(!choices[s.id]?.assetId||choices[s.id].assetId===asset.id)).map(s=>s.id);
 return ids.length?{ids,approximate:false}:narrationCoverage(asset,script);
}
export function initialStoryPlan(script:Script,assets:Asset[]):StoryPlan{
 const own=assets.filter(a=>!a.metadata.archived&&a.metadata.scriptId===script.id),images=own.filter(a=>a.contentType.startsWith('image/')&&a.metadata.gallery!==false);
 const voices=own.filter(a=>a.contentType.startsWith('audio/')).map(a=>({a,...storyNarrationCoverage(a,script)})).filter(t=>!t.approximate&&t.ids.length).sort((a,b)=>(b.a.created_at||'').localeCompare(a.a.created_at||''));
 const selected=new Set(Object.values(script.photo_settings.narrationPlan?.scenes||{}).map(s=>s.assetId));voices.sort((a,b)=>Number(selected.has(b.a.id))-Number(selected.has(a.a.id)));
 const used=new Set<string>(),blocks:StoryBlock[]=[];
 for(const scene of script.segments){if(used.has(scene.id))continue;const take=!directionOnly(scene.text)&&voices.find(t=>t.ids.includes(scene.id)&&t.ids.every(id=>!used.has(id)));
  const ids=take?take.ids.filter(id=>!directionOnly(script.segments.find(s=>s.id===id)?.text||'')):[scene.id];ids.forEach(id=>used.add(id));
  const photos=images.filter(a=>!a.metadata.filler&&ids.some(id=>(a.metadata.segmentIds||[a.metadata.segmentId]).includes(id)||script.segments[galleryScene(a,script)]?.id===id));
  blocks.push({id:crypto.randomUUID(),sourceIds:ids,imageIds:photos.map(a=>a.id),audioIds:take?[take.a.id]:[],captionIds:take?ids:[],filler:!take,duration:3});
 }
 for(const {asset} of orderedGallery(images.filter(a=>a.metadata.filler),script,'')){const row={id:crypto.randomUUID(),sourceIds:[],imageIds:[asset.id],audioIds:[],captionIds:[],filler:true,duration:3};const index=blocks.findLastIndex(b=>b.sourceIds.includes(asset.metadata.fillerAfter||'')||b.id==='after:'+asset.metadata.fillerAfter);if(index<0)blocks.push(row);else{let at=index+1;while(at<blocks.length&&blocks[at].filler&&!blocks[at].sourceIds.length)at++;blocks.splice(at,0,row);}}
 return {version:1,blocks,entryEnabled:true,exitEnabled:false,entry:'crossfade',exit:'fade',animationDuration:.5,spacing:.5,spacingMode:'overlap'};
}
export function compileStoryPlan(plan:StoryPlan,script:Script,assets:Asset[],durations:Record<string,number>){
 const available=new Map(assets.filter(a=>!a.metadata.archived&&a.metadata.scriptId===script.id).map(a=>[a.id,a]));
 const descriptions=new Map<string,{id:string;name:string;type:string;duration:number;aspectRatio:number}>();
 type Clip={id:string;assetId:string;name:string;type:'video'|'audio';start:number;inPoint:number;outPoint:number;layer:number;volume:number;muted:boolean;groupId:string;sceneSlice?:{index:number;count:number};segmentIds?:string[];narrationSegmentIds?:string[];audioRole?:'narration';imageTransition?:StillTransition;imageExit?:StillTransition|'heart';imageTransitionDuration?:number;imageExitDuration?:number};
 const clips:Clip[]=[],segments:VideoCaptions['segments']=[],usedCaptions=new Set<string>();let cursor=0;
 if(!plan.blocks.length)throw new Error('Dodaj barem jedan blok priče.');
 if(!Number.isFinite(plan.spacing)||plan.spacing<0||plan.spacing>3||!Number.isFinite(plan.animationDuration)||plan.animationDuration<.1||plan.animationDuration>3)throw new Error('Razmak i trajanje animacije moraju biti između 0 i 3 s (animacija najmanje 0,1 s).');
 const register=(id:string,type:'image'|'audio',blockNumber:number)=>{const a=available.get(id),name=assets.find(item=>item.id===id)?.name||id;if(!a||!a.contentType.startsWith(type+'/'))throw new Error(`Blok ${blockNumber} · ${type==='image'?'Slika':'Zvuk'}: ${name} — datoteka nije dostupna u ovoj skripti. Odaberi zamjenu ili ukloni vezu iz bloka.`);const ratio=(a.metadata.aspect||'16:9').split(':').map(Number);descriptions.set(id,{id,name:a.name,type,duration:type==='audio'?durations[id]:5,aspectRatio:ratio[0]/ratio[1]||16/9});return a;};
 plan.blocks.forEach((block,index)=>{
  if(!block.imageIds.length)throw new Error(`Blok ${index+1}: odaberi fotografiju ili ukloni blok.`);
  const selected=block.filler?[]:block.captionIds.map(id=>{const source=script.segments.find(s=>s.id===id);if(!source)throw new Error(`Blok ${index+1}: kadar više ne postoji.`);if(usedCaptions.has(id))throw new Error(`Kadar ${script.segments.indexOf(source)+1} je u više blokova. Spoji ga u jedan blok.`);usedCaptions.add(id);return {...source,text:spokenText(source.text),sourceSceneId:id};}).filter(s=>s.text);
  if(!block.filler&&!block.audioIds.length)throw new Error(`Blok ${index+1}: dodaj naraciju ili uključi Filler.`);
  if(!block.filler&&!selected.length)throw new Error(`Blok ${index+1}: odaberi titlove.`);
  const length=block.filler?block.duration:block.audioIds.reduce((sum,id)=>{register(id,'audio',index+1);const n=durations[id];if(!Number.isFinite(n)||n<=0)throw new Error('Nije moguće očitati trajanje naracije.');const r=block.audioRanges?.[id]||{from:0,to:1};if(!Number.isFinite(r.from)||!Number.isFinite(r.to)||r.from<0||r.to>1||r.to<=r.from)throw new Error('Neispravan dio naracije.');return sum+n*(r.to-r.from);},0);
  if(!Number.isFinite(length)||length<.1||length>21600)throw new Error(`Blok ${index+1}: neispravno trajanje.`);
  const groupId=block.id,captionIds=selected.map(s=>s.id);let audioAt=cursor;
  let fitted:VideoCaptions['segments']=[];
  if(!block.filler){
   const coverage=block.audioIds.map(id=>storyNarrationCoverage(available.get(id)!,script).ids.filter(id=>captionIds.includes(id)));
   const exact=coverage.every(ids=>ids.length)&&captionIds.every(id=>coverage.filter(ids=>ids.includes(id)).length===1);
   if(!exact){const source=selected.map((s,i)=>({...s,start:i,end:i+1}));fitted=fitNarration(source,{segmentIds:captionIds,text:selected.map(s=>s.text).join(' '),words:[],duration:length,sync:true,placement:'scene'},cursor);}
   block.audioIds.forEach((id,i)=>{const a=available.get(id)!,range=block.audioRanges?.[id]||{from:0,to:1},inPoint=durations[id]*range.from,outPoint=durations[id]*range.to,duration=outPoint-inPoint,ids=exact?coverage[i]:captionIds;
    clips.push({id:crypto.randomUUID(),assetId:id,name:a.name,type:'audio',audioRole:'narration',start:audioAt,inPoint,outPoint,volume:100,muted:false,layer:0,groupId,narrationSegmentIds:ids});
    if(exact){const source=selected.filter(s=>ids.includes(s.id)).map((s,j)=>({...s,start:j,end:j+1}));const timing=a.metadata.narration;const scale=timing?.duration?durations[id]/timing.duration:1;fitted.push(...fitNarration(source,{segmentIds:ids,text:source.map(s=>s.text).join(' '),words:(timing?.words||[]).map(w=>({...w,start:w.start*scale,end:w.end*scale})).filter(w=>w.end>inPoint&&w.start<outPoint).map(w=>({...w,start:Math.max(0,w.start-inPoint),end:Math.min(duration,w.end-inPoint)})),duration,sync:true,placement:'scene'},audioAt));}
    audioAt+=duration;
   });
  }
  segments.push(...fitted);
  const imageTargets=block.imageIds.map(id=>{const a=available.get(id);return a?fitted.filter(s=>(a.metadata.segmentIds||[a.metadata.segmentId]).includes(s.sourceSceneId||s.id)):[];});
  const mapped=!block.filler&&imageTargets.every(rows=>rows.length>0)&&fitted.every(s=>imageTargets.filter(rows=>rows.some(r=>r.id===s.id)).length===1)&&imageTargets.every((rows,i)=>i===0||Math.min(...rows.map(s=>s.start))>=Math.max(...imageTargets[i-1].map(s=>s.end))-.001);
  block.imageIds.forEach((id,i)=>{const a=register(id,'image',index+1),span=mapped?Math.max(...imageTargets[i].map(s=>s.end))-Math.min(...imageTargets[i].map(s=>s.start)):length/block.imageIds.length;clips.push({id:crypto.randomUUID(),assetId:id,name:a.name,type:'video',start:mapped?Math.min(...imageTargets[i].map(s=>s.start)):cursor+span*i,inPoint:0,outPoint:span,volume:0,muted:true,layer:1,groupId,sceneSlice:!mapped&&block.imageIds.length>1?{index:i,count:block.imageIds.length}:undefined,segmentIds:mapped?imageTargets[i].map(s=>s.id):captionIds,imageTransition:plan.entryEnabled?plan.entry:'cut',imageExit:plan.exitEnabled?plan.exit:'cut',imageTransitionDuration:plan.animationDuration,imageExitDuration:plan.animationDuration});});
  cursor+=length;
 });
 const photos=clips.filter(c=>c.type==='video');photos.forEach((c,i)=>{if(i===photos.length-1)return;const next=photos[i+1],amount=Math.min(plan.spacing,c.outPoint*.45,next.outPoint*.45);if(plan.spacingMode==='overlap')c.outPoint+=amount;else c.outPoint-=amount;});
 if(cursor>21600)throw new Error('Priča je predugačka.');
 const data={preeditor:{version:1},scriptSync:{sourceKey:scriptSourceKey(script),choices:scriptChoices(script)},clips,assets:[...descriptions.values()],captions:{__script:{segments:segments.sort((a,b)=>a.start-b.start),activeStyle:'clean',captionSettings:{...DEFAULT_CAPTION_SETTINGS,y:82}}},overlays:[],frameAspect:script.photo_settings.format==='9:16'?9/16:script.photo_settings.format==='1:1'?1:16/9,timelineFloor:cursor,sceneDefaults:{imageTransition:plan.entryEnabled?plan.entry:'cut',imageTransitionDuration:plan.animationDuration,imageExit:plan.exitEnabled?plan.exit:'cut',imageExitDuration:plan.animationDuration},timelineLayoutVersion:2};
 return {editor:'edita' as const,data,files:[...descriptions.keys()].map(id=>({key:id,id}))};
}

type StoryClip={id:string;type:string;groupId?:string;start:number;inPoint:number;outPoint:number;segmentIds?:string[];narrationSegmentIds?:string[]};
/** Translate an authored block without collapsing sequential clips or retiming speech. */
export function moveStoryGroup<T extends StoryClip>(clips:T[],segments:VideoCaptions['segments'],id:string,start:number,ripple=false,noOverlap=false){
 const selected=clips.find(c=>c.id===id);if(!selected)return {clips,segments};
 const key=(c:T)=>c.groupId||c.id,groups=new Map<string,T[]>();for(const c of clips){const k=key(c);groups.set(k,[...groups.get(k)||[],c]);}
 const target=key(selected),members=groups.get(target)!,from=Math.min(...members.map(c=>c.start)),end=Math.max(...members.map(c=>c.start+c.outPoint-c.inPoint));
 const prior=[...groups.entries()].filter(([k,g])=>k!==target&&g.some(c=>c.type==='video')&&Math.min(...g.map(c=>c.start))<from);
 const lower=noOverlap?Math.max(0,...prior.flatMap(([,g])=>g.map(c=>c.start+c.outPoint-c.inPoint))):0;
 const delta=Math.max(lower,from+start-selected.start)-from,offsets=new Map([[target,delta]]);let boundary=end+delta;
 const followers=[...groups.entries()].filter(([k,g])=>k!==target&&Math.min(...g.map(c=>c.start))>from+.001).sort((a,b)=>Math.min(...a[1].map(c=>c.start))-Math.min(...b[1].map(c=>c.start)));
 for(const [k,g] of followers){const at=Math.min(...g.map(c=>c.start)),length=Math.max(...g.map(c=>c.start+c.outPoint-c.inPoint))-at;let next=at+(ripple?delta:0);if(noOverlap&&g.some(c=>c.type==='video'))next=Math.max(next,boundary);offsets.set(k,next-at);if(g.some(c=>c.type==='video'))boundary=next+length;}
 const captionOffsets=new Map<string,number>();for(const c of clips){const d=offsets.get(key(c));if(d)for(const scene of [...c.segmentIds||[],...c.narrationSegmentIds||[]])captionOffsets.set(scene,d);}
 return {clips:clips.map(c=>offsets.get(key(c))?{...c,start:c.start+offsets.get(key(c))!}:c),segments:segments.map(s=>{const d=captionOffsets.get(s.id)||captionOffsets.get(s.sourceSceneId||'');return d?shiftSegment(s,d):s;})};
}

/** Merge provenance makes manual joins reversible, including incomplete/filler blocks. */
export function joinStoryBlocks(a:StoryBlock,b:StoryBlock):StoryBlock{
 const union=(key:'sourceIds'|'imageIds'|'audioIds'|'captionIds')=>[...new Set([...a[key],...b[key]])];
 const audioRanges:NonNullable<StoryBlock['audioRanges']>={};
 for(const id of union('audioIds')){const ranges=[a,b].filter(x=>x.audioIds.includes(id)).map(x=>x.audioRanges?.[id]||{from:0,to:1});audioRanges[id]={from:Math.min(...ranges.map(r=>r.from)),to:Math.max(...ranges.map(r=>r.to))};}
 return {...a,sourceIds:union('sourceIds'),imageIds:union('imageIds'),audioIds:union('audioIds'),captionIds:union('captionIds'),filler:a.filler&&b.filler,duration:a.duration+b.duration,audioRanges,joinedBlocks:[...(restoreJoinedBlocks(a)||[a]),...(restoreJoinedBlocks(b)||[b])]};
}
export function restoreJoinedBlocks(block:StoryBlock):StoryBlock[]|null{
 const parts=block.joinedBlocks;if(!parts?.length)return null;
 const total=parts.reduce((sum,p)=>sum+p.duration,0),changedFiller=block.filler!==parts.every(p=>p.filler);
 return parts.map((p,i)=>{const result={...p};for(const key of ['sourceIds','imageIds','audioIds','captionIds'] as const){result[key]=p[key].filter(id=>block[key].includes(id));if(i===0)result[key].push(...block[key].filter(id=>!parts.some(part=>part[key].includes(id))));}result.filler=changedFiller?block.filler:p.filler;if(block.filler&&total>0)result.duration=p.duration*block.duration/total;return result;});
}
/** Older joins lack provenance: divide at caption boundaries, retaining audio trims. */
export function splitStoryBlock(block:StoryBlock,script:Script,assets:Asset[],durations:Record<string,number>):StoryBlock[]{
 const restored=restoreJoinedBlocks(block);if(restored)return restored;
 const count=block.filler?Math.max(block.sourceIds.length,block.imageIds.length):block.captionIds.length;
 if(count<2)throw new Error('Ovaj blok nema više kadrova za odvajanje.');
 const base:StoryPlan={version:1,blocks:[block],entryEnabled:false,exitEnabled:false,entry:'cut',exit:'cut',spacing:0,spacingMode:'gap',animationDuration:.5};
 const doc=compileStoryPlan(base,script,assets,durations).data;
 const caps=doc.captions.__script.segments;
 const spans=block.filler?Array.from({length:count},(_,i)=>({start:block.duration*i/count,end:block.duration*(i+1)/count,id:block.sourceIds[i]})):caps;
 return spans.map((span,i)=>{
  const from=i===0?0:span.start,to=i===spans.length-1?doc.timelineFloor:spans[i+1].start;
  const images=doc.clips.filter(c=>c.type==='video'&&c.start<to-.00001&&c.start+c.outPoint-c.inPoint>from+.00001);
  const audios=doc.clips.filter(c=>c.type==='audio'&&c.start<to-.00001&&c.start+c.outPoint-c.inPoint>from+.00001);
  const audioRanges:NonNullable<StoryBlock['audioRanges']>={};
  for(const c of audios)audioRanges[c.assetId]={from:(c.inPoint+Math.max(from,c.start)-c.start)/durations[c.assetId],to:Math.min(1,(c.inPoint+Math.min(to,c.start+c.outPoint-c.inPoint)-c.start)/durations[c.assetId])};
  return {id:crypto.randomUUID(),sourceIds:span.id?[span.id]:[],imageIds:[...new Set(images.map(c=>c.assetId))],audioIds:audios.map(c=>c.assetId),captionIds:block.filler?[]:[span.id!],filler:block.filler,duration:to-from,audioRanges};
 });
}
