import assert from 'node:assert/strict';import {loadTestModule} from './test-ts-module.mjs';
const {frameDefinition,resolvedFrameAssets,selectionKey}=await loadTestModule('lib/frame-definitions.ts','.local/material-flow/tests');
const {initialStoryPlan,compileStoryPlan,reconcileStorySelections,splitStoryBlock}=await loadTestModule('lib/preeditor.ts','.local/material-flow/tests');
const {timingOptions}=await loadTestModule('lib/material-processing.ts','.local/material-flow/tests');
const script={id:'s',project:'p',title:'Story',content:'One Two',segments:[{id:'a',start:0,end:5,text:'One'},{id:'b',start:5,end:10,text:'Two'}],photo_settings:{}};
const image={id:'img',name:'image.png',contentType:'image/png',url:'/img',metadata:{scriptId:'s',segmentIds:['a','b'],gallery:true}};
const video={id:'vid',name:'video.mp4',contentType:'video/mp4',url:'/vid',metadata:{scriptId:'s',gallery:true,mediaDuration:3}};
const voice={id:'voice',name:'voice.wav',contentType:'audio/wav',metadata:{scriptId:'s',purpose:'narration',segmentIds:['a','b']}};
const sound={id:'bg',name:'sea.wav',contentType:'audio/wav',metadata:{scriptId:'other',audioRole:'sound'}};
const assets=[image,video,voice,sound],before=JSON.stringify(assets);
script.photo_settings.frameDefinitions={a:{...frameDefinition(script,'a',assets),kind:'video',videoSource:'vid'}};
script.photo_settings.narrationPlan={voices:{},scenes:{a:{assetId:'voice'},b:{assetId:'voice'}},backgrounds:['bg']};
let effective=resolvedFrameAssets(script,assets);assert.deepEqual(effective.find(a=>a.id==='img').metadata.segmentIds,['b']);assert.deepEqual(effective.find(a=>a.id==='vid').metadata.segmentIds,['a']);assert.equal(JSON.stringify(assets),before);
const plan=initialStoryPlan(script,assets);assert.equal(plan.spacing,.2);assert.ok(plan.blocks[0].imageIds.includes('vid'));assert.ok(plan.blocks[0].imageIds.includes('img'));
// Narration order, rather than asset upload order, must determine media order.
assert.deepEqual(plan.blocks[0].imageIds,['vid','img']);const doc=compileStoryPlan(plan,script,assets,{vid:3,voice:10,bg:60});assert.equal(doc.data.assets.find(a=>a.id==='vid').type,'video');assert.equal(doc.data.clips.find(c=>c.assetId==='vid').outPoint,3);assert.equal(doc.data.timelineFloor,10);assert.equal(doc.data.clips.find(c=>c.assetId==='bg').outPoint,10);assert.equal(doc.data.clips.find(c=>c.assetId==='bg').allowOverlap,true);
assert.equal(doc.data.clips.find(c=>c.assetId==='voice').outPoint,10);
assert.throws(()=>compileStoryPlan(plan,script,assets,{voice:10,bg:60}),/trajanje/);
const authored={...plan,selectionKey:'[]',blocks:[{...plan.blocks[0],id:'keep-me',imageIds:['img'],audioRanges:{voice:{from:.1,to:.9}}}]};const synced=reconcileStorySelections(authored,script,assets);assert.equal(synced.blocks[0].id,'keep-me');assert.deepEqual(synced.blocks[0].audioRanges,authored.blocks[0].audioRanges);assert.deepEqual(synced.blocks[0].imageIds,['vid','img']);assert.equal(reconcileStorySelections(synced,script,assets),synced);assert.equal(synced.selectionKey,selectionKey(script));
assert.equal(timingOptions(8,0,6,1,5).speed,1.2);assert.equal(timingOptions(8,0,6,1,5).output,5);assert.throws(()=>timingOptions(8,0,9,1));assert.throws(()=>timingOptions(8,0,6,1,.2));
// Video source offsets survive splitting a shared narration block.
const splitScript={...script,photo_settings:{}};const block={...plan.blocks[0],imageIds:['vid']};const split=splitStoryBlock(block,splitScript,[...assets.map(a=>a.id==='vid'?{...a,metadata:{...a.metadata,segmentIds:[]}}:a)],{vid:12,voice:10});assert.equal(split[1].videoOffsets.vid,5);const splitDoc=compileStoryPlan({...plan,spacing:0,blocks:split},splitScript,assets,{vid:12,voice:10});assert.equal(splitDoc.data.clips.filter(c=>c.assetId==='vid')[1].inPoint,5);
console.log('Material selections, immutable originals, video duration bounds, background audio, saved-plan reconciliation, trim/speed and split video offsets passed.');
