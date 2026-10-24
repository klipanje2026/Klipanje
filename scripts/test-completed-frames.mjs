import assert from 'node:assert/strict';
import {loadTestModule} from './test-ts-module.mjs';
const {completedFrames,linkCompletedMedia}=await loadTestModule('lib/completed-frames.ts','work/completed-tests');
const {orderedGallery}=await loadTestModule('lib/gallery-order.ts','work/completed-tests');
const script={id:'s',segments:[{id:'a',text:'One'},{id:'b',text:'Two'},{id:'c',text:'Three'}],photo_settings:{},title:'Episode'};
const photo=(id,ids,extra={})=>({id,name:id+'.png',contentType:'image/png',created_at:'1',metadata:{scriptId:'s',gallery:true,segmentIds:ids,...extra}});
const voice=(id,ids,date)=>({id,name:id+'.wav',contentType:'audio/wav',created_at:date,metadata:{scriptId:'s',purpose:'narration',segmentIds:ids}});
const images=[photo('p1',['a']),photo('p2',['b'])];
let plan=completedFrames([...images,voice('old',['a'],'1'),voice('new',['a'],'2'),voice('b',['b'],'1')],script);
assert.deepEqual(plan.ids,['a','b']);assert.deepEqual(plan.entries.filter(e=>e.audio).map(e=>e.asset.id),['new','b']);
plan=completedFrames([...images,voice('shared',['a','b'],'2'),voice('single',['b'],'3')],script);
assert.deepEqual(plan.ids,['b']); // no overlapping shared + separate recordings
plan=completedFrames([...images,voice('shared',['a','b'],'2')],script);assert.equal(plan.entries.filter(e=>e.audio).length,1);
assert.equal(completedFrames([images[0],voice('shared',['a','b'],'2')],script).ids.length,0);
assert.equal(completedFrames([photo('pending',['a'],{gallery:false}),voice('a',['a'],'1')],script).ids.length,0);
const original=[{id:'i1',segmentIds:['a']},{id:'i2',segmentIds:['b']},{id:'n',narrationSegmentIds:['a','b']},{id:'other',segmentIds:['c']}];
const linked=linkCompletedMedia(original,['a','b']);assert.equal(linked[0].groupId,linked[1].groupId);assert.equal(linked[1].groupId,linked[2].groupId);assert.equal(linked[3].groupId,undefined);assert.equal(original[0].groupId,undefined);
const sorted=orderedGallery([photo('b',['b']),photo('f1',[],{filler:true,fillerAfter:'a'}),photo('a',['a']),photo('f2',[],{filler:true,fillerAfter:'a'}),photo('last',[],{filler:true})],script,'Test');
assert.deepEqual(sorted.map(s=>s.asset.id),['a','f1','f2','b','last']);assert.deepEqual(sorted.slice(1,3).map(s=>s.position),['1.1','1.2']);
console.log('Completed frames: newest/selected takes, shared coverage, no overlapping takes, gallery eligibility, immutable grouping and filler order passed.');

const alternatives=[...images,voice('old',['a'],'1'),voice('new',['a'],'2')];
assert.equal(completedFrames(alternatives,{...script,photo_settings:{narrationPlan:{scenes:{a:{assetId:'old'}}}}}).entries[0].asset.id,'old');
assert.equal(completedFrames(alternatives,script,['old']).entries[0].asset.id,'old');
