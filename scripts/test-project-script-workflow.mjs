import assert from 'node:assert/strict';
import {loadTestModule} from './test-ts-module.mjs';
const {syncIntervalText}=await loadTestModule('lib/sync-interval-text.ts','.local/project-script-tests');
const frames=[{id:'a',text:'Kerim ide prema rijeci.',start:2,end:7,prompt:'retain me'},{id:'b',text:'Ema čeka na obali.',start:8,end:11}];
const original=structuredClone(frames);
let result=syncIntervalText(frames,'Kerim polako ide prema rijeci. Ema čeka na obali.');
assert.equal(result.error,undefined);assert.equal(result.segments[0].text,'Kerim polako ide prema rijeci.');assert.deepEqual(result.segments[1],frames[1]);
for(let i=0;i<2;i++)assert.deepEqual({...result.segments[i],text:frames[i].text},frames[i]);
assert.deepEqual(frames,original);
result=syncIntervalText(frames,'Kerim ide prema moru. Ema čeka na obali.');assert.equal(result.segments[0].text,'Kerim ide prema moru.');
assert.equal(syncIntervalText(frames,'').segments,frames);
result=syncIntervalText(frames,'Kerim ide prema rijeci.');
assert.deepEqual(result.retained,['b']);
assert.deepEqual(result.segments,frames);
const mixed=syncIntervalText(frames,'Kerim ide prema moru.');
assert.deepEqual(mixed.retained,['b']);
assert.equal(mixed.segments[0].text,'Kerim ide prema moru.');
assert.deepEqual(mixed.segments[1],frames[1]);
const {frameNarration,measuredFrameDuration}=await loadTestModule('lib/frame-timing.ts','.local/project-script-tests');
const script={id:'script',segments:frames,photo_settings:{narrationPlan:{scenes:{a:{assetId:'voice'},b:{assetId:'voice'}}}}};
const take={id:'voice',contentType:'audio/wav',created_at:'2020',metadata:{scriptId:'script',audioRole:'narration',segmentIds:['a','b'],narration:{text:'Changed pronunciation',segmentIds:['a','b'],duration:10,words:[],sync:true}}};
const newer={...take,id:'new',created_at:'2030'};
assert.equal(frameNarration(script,[take,newer],'a'),take);
const first=measuredFrameDuration(script,take,'a'),second=measuredFrameDuration(script,take,'b');assert.equal(first+second,10);assert.ok(first>0&&second>0);
assert.equal(frameNarration(script,[{...take,metadata:{...take.metadata,archived:true}}],'a'),undefined);
console.log('Interval text, timing, chosen/shared narration and immutability checks passed');

const manual=[{...frames[0],text:'Kerim lagano ide prema rijeci.'},frames[1]];
const preserved=syncIntervalText(manual,'Kerim ide prema rijeci. Ema čeka kraj mora.','Kerim ide prema rijeci. Ema čeka na obali.');
assert.equal(preserved.segments[0].text,manual[0].text);assert.equal(preserved.segments[1].text,'Ema čeka kraj mora.');
console.log('Unrelated manual interval text is preserved');

const {updateScriptInterval}=await loadTestModule('lib/sync-interval-text.ts','.local/project-script-tests');
assert.equal(updateScriptInterval('*More*\nKerim ide prema rijeci.\n\nEma čeka na obali.',frames,'b','Ema se smije.'),'*More*\nKerim ide prema rijeci.\n\nEma se smije.');
assert.equal(updateScriptInterval('Druga priča.',frames,'a','Novo.'),undefined);
console.log('Reverse text sync preserves surrounding scene descriptions');

const story=[
 'Raghun opened his eyes, but for a few moments he could see nothing.',
 'Something hard and cold pressed against his back.',
 'He tried to move.',
 'Cloth caught beneath his shoulder, and his fingers scraped stone.',
];
const intervals=story.map((text,i)=>({id:String(i+1),start:i*4,end:i*4+3.8,text}));
const latest=[story[0],story[1],story[3].replace('scraped','touched')].join(' ');
const mixedStory=syncIntervalText(intervals,latest,story.join(' '));
assert.deepEqual(mixedStory.retained,['3']);
assert.deepEqual(mixedStory.segments.slice(0,3),intervals.slice(0,3));
assert.deepEqual(mixedStory.segments[3],{...intervals[3],text:story[3].replace('scraped','touched')});

const {deletedScriptIntervals}=await loadTestModule('lib/sync-interval-text.ts','.local/project-script-tests');
const before=frames.map(s=>s.text).join(' ');
const shortened=frames[0].text;
assert.deepEqual([...deletedScriptIntervals(syncIntervalText(frames,shortened,before),frames,before,shortened)],['b']);
assert.equal(deletedScriptIntervals(syncIntervalText(frames,shortened),frames,'Manually diverged.',shortened).size,0);
assert.equal(updateScriptInterval(before,frames,'a','').trim(),frames[1].text);
