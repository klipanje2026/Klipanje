import assert from 'node:assert/strict';
import {loadTestModule} from './test-ts-module.mjs';
const {groupTimelineSelection,dissolveTimelineGroup,moveTimelineGroup,detachTimelineElement,splitTimelineAt}=await loadTestModule('lib/timeline-edit-actions.ts','.local/test-timeline-edit-actions');
const {narrationReadyTime}=await loadTestModule('lib/narration-ready-time.ts','.local/test-timeline-edit-actions');
const clip=(id,start,len,extra={})=>({id,assetId:id,type:'audio',layer:1,start,inPoint:0,outPoint:len,muted:false,...extra});
const voice=[clip('a',2,3),clip('b',6,4)];const image=clip('image',3,2,{type:'video'});
const text=[{id:'text',start:2,end:5,text:'Jedan dva tri',words:[{text:'Jedan',start:2,end:3},{text:'dva',start:3,end:4},{text:'tri',start:4,end:5}]}];
const input=JSON.stringify([voice,image,text]);
const grouped=groupTimelineSelection([...voice,image],text,['a','b','image'],['text'],new Set(['image']),'g');
assert.deepEqual(grouped.clips.slice(0,2).map(c=>[c.start,c.inPoint,c.outPoint]),[[2,0,3],[6,0,4]]);
assert.deepEqual([grouped.clips[2].start,grouped.clips[2].outPoint],[2,8]);
assert.deepEqual([grouped.segments[0].start,grouped.segments[0].end],[2,10]);
assert.equal(JSON.stringify([voice,image,text]),input);
const saved=JSON.parse(JSON.stringify(grouped));assert.equal(saved.clips[0].timelineGroupId,'g');
const moved=moveTimelineGroup(saved.clips,saved.segments,'g',3);assert.deepEqual(moved.clips.map(c=>c.start),[5,9,5]);assert.equal(moved.segments[0].start,5);
const dissolved=dissolveTimelineGroup(moved.clips,moved.segments,'g');assert.deepEqual(dissolved.clips.map(c=>c.start),[5,9,5]);assert.ok(dissolved.clips.every(c=>!c.timelineGroupId));
const detached=detachTimelineElement(grouped.clips,grouped.segments,'image');assert.equal(detached.clips[2].timelineGroupId,undefined);assert.equal(detached.clips[0].timelineGroupId,'g');
const mixed=[clip('v',1,10,{type:'video',inPoint:5,outPoint:15,playbackRate:1.2,groupId:'old'}),clip('n',2,6,{inPoint:10,outPoint:16,groupId:'old',narrationSegmentIds:['text']}),clip('later',20,2)];
const cut=splitTimelineAt(mixed,text,3.5);
assert.equal(cut.clips.length,5);assert.deepEqual(cut.clips.slice(0,4).map(c=>[c.start,c.inPoint,c.outPoint]),[[1,5,7.5],[3.5,7.5,15],[2,10,11.5],[3.5,11.5,16]]);
assert.equal(cut.clips[1].groupId,cut.clips[3].groupId);assert.equal(cut.clips.at(-1),mixed[2]);
assert.equal(cut.segments.length,2);assert.equal(cut.segments.map(s=>s.text).join(' '),'Jedan dva tri');
assert.ok(cut.clips[3].narrationSegmentIds.includes(cut.segments[1].id));
const one=splitTimelineAt([], [{id:'one',start:0,end:2,text:'Hej!'}],1);assert.equal(one.segments.length,2);
assert.equal(narrationReadyTime(0,.2,[clip('n',0,3)],()=>({paused:false,seeking:false,readyState:4,pending:true,currentTime:0})),0);
assert.equal(narrationReadyTime(0,.2,[clip('n',0,3)],()=>({paused:false,seeking:false,readyState:4,currentTime:0})),.025);
assert.equal(narrationReadyTime(.3,.4,[clip('n',0,3)],()=>({paused:false,seeking:false,readyState:4,currentTime:.4})),.4);
assert.equal(narrationReadyTime(0,.2,[clip('n',0,3,{audioRole:'sound'})],()=>({paused:true,seeking:false,readyState:0})),.2);
assert.equal(narrationReadyTime(.9,1.1,[clip('n',1,3)],()=>undefined),1);
console.log('Groups, range fitting, voice immutability, detach/dissolve, source-correct cuts, caption links, persisted metadata and cold audio startup passed.');
import fs from 'node:fs/promises';
import {createCanvas} from '@napi-rs/canvas';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const {splitOverlaysAt,drawOverlays,overlayMotion,clockMinutesAt}=await loadTestModule('lib/video-overlays.ts','.local/test-timeline-edit-actions');
const baseOverlay={id:'overlay',kind:'clock',text:'Test',color:'#ffffff',background:'transparent',x:50,y:50,width:50,height:50,rotation:0,opacity:100,start:1,end:9,bold:false,animation:'fade',animationDuration:.6};
for(const kind of ['clock','sleep','sunlight','lightning','rect']){
 const original={...baseOverlay,kind};const parts=splitOverlaysAt([original],3.5);
 for(const time of [1.1,3.49,3.5,4,8]){
  const a=createCanvas(160,90),b=createCanvas(160,90);drawOverlays(a.getContext('2d'),[original],time);drawOverlays(b.getContext('2d'),parts,time);
  assert.deepEqual(a.getContext('2d').getImageData(0,0,160,90).data,b.getContext('2d').getImageData(0,0,160,90).data,kind+' split changes rendered phase at '+time);
 }
}
// A caption already split from a scene must attach to its new right half, not another sibling.
const siblings=[{id:'sib1',sourceSceneId:'scene',start:0,end:4,text:'One two three'},{id:'sib2',sourceSceneId:'scene',start:4,end:8,text:'Four five six'}];
const recut=splitTimelineAt([clip('n1',0,4,{narrationSegmentIds:['sib1']}),clip('n2',4,4,{narrationSegmentIds:['sib2']})],siblings,2);
assert.equal(recut.clips[1].narrationSegmentIds[0],recut.segments[1].id);assert.deepEqual(recut.clips[2].narrationSegmentIds,['sib2']);
const followers=[...grouped.clips,clip('follower',12,2,{type:'video'}),clip('sound',13,4,{audioRole:'sound'})];
const solo=moveTimelineGroup(followers,grouped.segments,'g',1,{ripple:true,scope:'lane',clipId:'image'});
assert.equal(solo.clips.find(c=>c.id==='follower').start,13);assert.equal(solo.clips.find(c=>c.id==='sound').start,13);assert.equal(solo.segments[0].start,3);
const all=moveTimelineGroup(followers,grouped.segments,'g',1,{ripple:true,scope:'all',clipId:'image'});assert.equal(all.clips.find(c=>c.id==='sound').start,14);
const collision=moveTimelineGroup(followers,grouped.segments,'g',5,{noOverlap:true,clipId:'image'});assert.equal(collision.clips.find(c=>c.id==='follower').start,15);assert.equal(collision.clips.find(c=>c.id==='sound').start,13);
assert.deepEqual(collision.clips.slice(0,2).map(c=>c.outPoint-c.inPoint),[3,4]);
const {adjustTimelineGap}=await loadTestModule('lib/timeline-gap.ts','.local/test-timeline-edit-actions');
const gapped=adjustTimelineGap([clip('anchor',0,1,{type:'video'}),...grouped.clips],grouped.segments,[],{clipId:'anchor'},'add');
assert.equal(gapped.clips[1].start,2.1);assert.equal(gapped.clips[2].start,6.1);assert.equal(gapped.segments[0].start,2.1);
const {refreshMediaPreview}=await loadTestModule('lib/refresh-media-preview.ts','.local/test-timeline-edit-actions');
class FakeMedia extends EventTarget{
 readyState=4;paused=false;seeking=false;duration=12;loads=0;_time=0;
 pause(){this.paused=true;}load(){this.loads++;this.readyState=0;queueMicrotask(()=>{this.readyState=4;this.dispatchEvent(new Event('loadedmetadata'));});}
 set currentTime(t){this._time=t;this.seeking=true;queueMicrotask(()=>{this.seeking=false;this.dispatchEvent(new Event('seeked'));});}get currentTime(){return this._time;}
}
const media=new FakeMedia();await refreshMediaPreview(media,5,new AbortController().signal);assert.equal(media.currentTime,5);assert.equal(media.loads,1);assert.equal(media.paused,true);
const abort=new AbortController();abort.abort();await assert.rejects(refreshMediaPreview(new FakeMedia(),0,abort.signal),{name:'AbortError'});
let slots=[],cursor=0;
const react={useRef:value=>{const i=cursor++;return slots[i]??={current:value};},useState:value=>{const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useCallback:fn=>fn};
const hook={};runInNewContext(ts.transpileModule(await fs.readFile('frontend/src/lib/use-editor-history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:hook,require:()=>react});
const originalState={clips:[...voice,image],segments:text};const render=()=>{cursor=0;return hook.useEditorHistory(originalState);};
let history=render();for(const transform of [state=>groupTimelineSelection(state.clips,state.segments,['a','b','image'],['text'],new Set(['image']),'g'),state=>splitTimelineAt(state.clips,state.segments,3.5),state=>dissolveTimelineGroup(state.clips,state.segments)]){const before=history.value;history.set(transform);history=render();const after=history.value;history.undo();history=render();assert.deepEqual(history.value,before);history.redo();history=render();assert.deepEqual(history.value,after);}
console.log('Overlay pixel parity after cutting, repeated caption cuts, lane/all group ripple, collision handling, group gaps, decoder refresh/abort and complete undo/redo passed.');
