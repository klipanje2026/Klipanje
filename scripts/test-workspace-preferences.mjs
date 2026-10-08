import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
await fs.mkdir('work/preferences-tests',{recursive:true});
for(const name of ['project-snapshot','playback-shortcut']) {
 const code=ts.transpileModule(await fs.readFile(`frontend/src/lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 await fs.writeFile(`work/preferences-tests/${name}.mjs`,code);
}
const {collectLatestSnapshot}=await import('../work/preferences-tests/project-snapshot.mjs');
const original=new File(['original'],'video.mp4'), replacement=new File(['replacement'],'video.mp4');
let current={data:{clips:[{inPoint:0,outPoint:20}],captions:['original']},files:[{key:'asset-id',file:original}]};
let result=await collectLatestSnapshot(async()=>current,async()=>{current={...current,data:{clips:[{inPoint:3,outPoint:9}],captions:['edited']}};return 'stored-original';});
assert.deepEqual(JSON.parse(JSON.stringify(result)).data,current.data);
let uploads=0;
result=await collectLatestSnapshot(async()=>current,async source=>{uploads++; if(source.file===original){current={data:{clips:[{inPoint:1,outPoint:4}],captions:['replacement']},files:[{key:'asset-id',file:replacement}]};return 'old';}return 'new';});
assert.equal(uploads,2);assert.equal(result.files[0].id,'new');assert.deepEqual(result.data,current.data);
current={...current,files:[...current.files,{key:'voice',file:original}]};
result=await collectLatestSnapshot(async()=>current,async source=>{if(source.key==='voice')current={...current,files:current.files.filter(f=>f.key!=='voice')};return source.key;});
assert.deepEqual(result.files,[{key:'asset-id',id:'asset-id'}]);
class Element { closest(){return null;} }
globalThis.HTMLElement=Element;globalThis.document={querySelector:()=>null};
const {installPlaybackShortcut}=await import('../work/preferences-tests/playback-shortcut.mjs');
const listeners=new Map();const target={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
let toggles=0;const remove=installPlaybackShortcut(target,()=>toggles++,()=>true);
function fire(type,repeat=false,element=new Element()) {const event={code:'Space',repeat,target:element,prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){}};listeners.get(type)(event);return event;}
assert.ok(fire('keydown').prevented);assert.ok(fire('keydown',true).prevented);assert.equal(toggles,1);assert.ok(fire('keyup').prevented);assert.equal(toggles,1);
fire('keydown');fire('keyup');assert.equal(toggles,2);
const input=new Element();input.closest=selector=>selector.includes('input')?input:null;assert.equal(fire('keydown',false,input).prevented,false);assert.equal(toggles,2);
fire('keydown');fire('keydown');assert.equal(toggles,4,'A lost keyup must not disable the next physical Space press');fire('keyup');
remove();assert.equal(listeners.size,0);
console.log('Latest edited state, replaced/removed media and Space press/release regression checks passed.');
const linkedCode=ts.transpileModule(await fs.readFile('frontend/src/lib/linked-clips.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
await fs.writeFile('work/preferences-tests/linked-clips.mjs',linkedCode);
const {linkLegacyClips,linkedTo,updateLinked,splitLinked}=await import('../work/preferences-tests/linked-clips.mjs');
const video={id:'v',assetId:'source',type:'video',start:2,inPoint:1,outPoint:11,layer:1,volume:0};
const audio={...video,id:'a',type:'audio',layer:0,volume:100};
let clips=linkLegacyClips([video,audio,{...audio,id:'music',assetId:'music'}]);
assert.ok(linkedTo(clips[0],clips[1]));assert.ok(!linkedTo(clips[0],clips[2]));
assert.equal(linkLegacyClips([video,{...audio,start:3}])[0].groupId,undefined);
clips=updateLinked(clips,'a',{inPoint:2,start:3,volume:70});
assert.equal(clips[0].inPoint,2);assert.equal(clips[0].start,3);assert.equal(clips[0].volume,0);assert.equal(clips[1].volume,70);
clips=splitLinked(clips,clips[0],[5,8]);
const pairs=clips.filter(c=>c.type==='video');assert.equal(pairs.length,3);
for(const clip of pairs){const pair=clips.find(c=>c.type==='audio'&&linkedTo(c,clip));assert.ok(pair);assert.deepEqual([pair.start,pair.inPoint,pair.outPoint],[clip.start,clip.inPoint,clip.outPoint]);}
assert.equal(new Set(pairs.map(c=>c.groupId)).size,3);
const moved=updateLinked(clips,pairs[1].id,{start:20,outPoint:7});
assert.equal(moved.find(c=>c.id===pairs[0].id).start,pairs[0].start);
assert.equal(moved.find(c=>c.type==='audio'&&linkedTo(c,pairs[1])).start,20);
assert.deepEqual(JSON.parse(JSON.stringify(moved)).map(c=>c.groupId),moved.map(c=>c.groupId));
console.log('Linked video/audio migration, cuts, trims, independent volume and saved groups passed.');

const orderCode=ts.transpileModule(await fs.readFile('frontend/src/lib/timeline-track-order.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
await fs.writeFile('work/preferences-tests/timeline-track-order.mjs',orderCode);
const {timelineTrackOrder,moveTimelineTrack}=await import('../work/preferences-tests/timeline-track-order.mjs');
assert.deepEqual(timelineTrackOrder(['video-2','captions-old','video-1','captions-another'],['video-1','video-2'],true),['captions','video-2','video-1']);
assert.deepEqual(timelineTrackOrder(['video-1','captions'],['video-1','video-new'],true),['video-1','video-new','captions']);
assert.deepEqual(moveTimelineTrack(['captions','v1','v2'],'captions','v1'),['v1','v2','captions']);
assert.deepEqual(moveTimelineTrack(['v1','v2','captions'],'captions','v2'),['captions','v1','v2']);
for(const original of [['captions','v1','v2','v3'],['v1','v2','v3','captions']]) for(const id of original) for(const target of [...original,'up','down']) {
 const next=moveTimelineTrack(original,id,target);
 assert.equal(next.filter(k=>k==='captions').length,1);
 assert.ok(next[0]==='captions'||next.at(-1)==='captions');
 assert.deepEqual([...next].sort(),[...original].sort());
}
assert.deepEqual(moveTimelineTrack(['captions','v1','v2'],'v2','v1'),['captions','v2','v1']);
console.log('Single caption lane, legacy track order and fixed caption/media boundary passed.');

const timingCode=ts.transpileModule(await fs.readFile('frontend/src/lib/caption-timing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
await fs.writeFile('work/preferences-tests/caption-timing.mjs',timingCode);
const {dragCaption}=await import('../work/preferences-tests/caption-timing.mjs');
const packed=[0,1,2].map(i=>({id:String(i),start:i*2,end:i*2+2,text:String(i),words:[{text:String(i),start:i*2+.2,end:i*2+1}]}));
const dragged=dragCaption(packed,'0',4,6);
assert.deepEqual(dragged.map(s=>s.start),[4,2,4]);
assert.ok(dragged.every(s=>Math.abs(s.words[0].start-s.start-.2)<1e-9));
assert.deepEqual(dragCaption(packed,'0',NaN,6),packed);
assert.equal(dragCaption(packed,'2',8,12)[2].start,8);
console.log('Caption dragging follows the pointer without moving neighbours or losing word timings.');

assert.equal(dragCaption(packed,'0',1.26,6)[0].start,1.3);

const topicsCode=ts.transpileModule(await fs.readFile('frontend/src/components/TranscriptTopicsPanel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
await fs.writeFile('work/preferences-tests/topics.mjs',topicsCode);
const {suggestTopics}=await import('../work/preferences-tests/topics.mjs');
const topic=suggestTopics('Video prati govor. Govor je dobar. Zvuk prati govor.');
assert.equal(topic.keywords[0],'govor');assert.ok(!topic.keywords.includes('je'));
assert.deepEqual(JSON.parse(JSON.stringify(topic)),topic);assert.deepEqual(suggestTopics('').keywords,[]);
console.log('Whole-transcript keyword ranking and saved topic data passed.');

{
 const themeCode=ts.transpileModule(await fs.readFile('frontend/src/lib/theme.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 await fs.writeFile('work/preferences-tests/theme.mjs',themeCode);
 const store=new Map();globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
 globalThis.document={documentElement:{dataset:{}}};globalThis.window={dispatchEvent:()=>{}};
 const theme=await import('../work/preferences-tests/theme.mjs');
 theme.applyVariant('forest','olive');assert.equal(theme.currentTheme(),'forest');assert.equal(theme.currentVariant(),'olive');
 document.documentElement.dataset={};theme.initializeTheme();assert.equal(theme.currentTheme(),'forest');assert.equal(theme.currentVariant(),'olive');assert.equal(theme.lastDarkTheme(),'forest');
}

const frameCode=ts.transpileModule(await fs.readFile('frontend/src/lib/media-frame-step.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
await fs.writeFile('work/preferences-tests/media-frame-step.mjs',frameCode);
const {adjacentFrameTime}=await import('../work/preferences-tests/media-frame-step.mjs');
for(const fps of [24,25,30,60]){assert.ok(Math.abs(adjacentFrameTime(1,1,fps,10)-(1+1/fps))<1e-8);assert.ok(Math.abs(adjacentFrameTime(1,-1,fps,10)-(1-1/fps))<1e-8);assert.equal(adjacentFrameTime(0,-1,fps,10),0);assert.ok(adjacentFrameTime(10,1,fps,10)<10);}
let steps=[];const stopFrames=installPlaybackShortcut(target,()=>{},()=>true,d=>steps.push(d));
for(const code of ['ArrowLeft','ArrowRight'])listeners.get('keydown')({code,target:new Element(),preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});
assert.deepEqual(steps,[-5,5]);stopFrames();
console.log('Frame stepping follows source cadence and clamps video boundaries.');

{
 const code=ts.transpileModule(await fs.readFile('frontend/src/lib/beta-notice.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 await fs.writeFile('work/preferences-tests/beta-notice.mjs',code);
 const saved=new Map(), storageListeners=new Set();
 globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
 globalThis.window={addEventListener:(_,fn)=>storageListeners.add(fn),removeEventListener:(_,fn)=>storageListeners.delete(fn)};
 const first=await import('../work/preferences-tests/beta-notice.mjs?first');
 assert.equal(first.isBetaNoticeDismissed(),false);
 let updates=0;
 const unsubscribe=first.subscribeBetaNotice(()=>updates++);
 first.dismissBetaNotice();
 assert.equal(updates,1);
 assert.equal(first.isBetaNoticeDismissed(),true);
 unsubscribe();assert.equal(storageListeners.size,0);
 const reloaded=await import('../work/preferences-tests/beta-notice.mjs?reload');
 assert.equal(reloaded.isBetaNoticeDismissed(),true,'Acknowledgment survives editor remounts and page reloads');
 for(const section of ['settings','text','elements','filters','transitions']) {
  saved.clear();saved.set(`edita-beta-notice:${section}`,'1');
  const legacy=await import(`../work/preferences-tests/beta-notice.mjs?legacy=${section}`);
  assert.equal(legacy.isBetaNoticeDismissed(),true,'Any previous section acknowledgment dismisses the shared notice');
 }
 saved.clear();
 const otherTab=await import('../work/preferences-tests/beta-notice.mjs?other-tab');
 let otherUpdates=0;
 const stop=otherTab.subscribeBetaNotice(()=>otherUpdates++);
 assert.equal(otherTab.isBetaNoticeDismissed(),false);
 for(const listener of storageListeners)listener({key:'edita-beta-notice:dismissed',newValue:'1'});
 assert.equal(otherUpdates,1);assert.equal(otherTab.isBetaNoticeDismissed(),true);stop();
 globalThis.localStorage={getItem(){throw Error('Storage blocked');},setItem(){throw Error('Storage blocked');}};
 const blocked=await import('../work/preferences-tests/beta-notice.mjs?blocked');
 assert.equal(blocked.isBetaNoticeDismissed(),false);blocked.dismissBetaNotice();assert.equal(blocked.isBetaNoticeDismissed(),true);
 const studio=await fs.readFile('frontend/src/pages/VideoStudio/VideoStudio.tsx','utf8');
 assert.equal((studio.match(/<BetaNotice\b/g)||[]).length,1);
 assert.doesNotMatch(studio,/<BetaNotice[^>]*\bkey=/,'The notice must not reuse the keyed panel content identity');
 console.log('One shared beta acknowledgment: persistence, legacy preferences, browser-tab sync and unavailable storage passed.');
}
