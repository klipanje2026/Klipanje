import assert from 'node:assert/strict';
import {loadTestModule} from './test-ts-module.mjs';

const {buildPhotoPlan}=await loadTestModule('lib/photo-plan.ts','work/creative-tests');
const {localTimelineDuration,timelineClock,extendTimelineRequest,timelineZoomMaximum}=await loadTestModule('lib/timeline-duration.ts','work/creative-tests');

const prompts=[{id:'p1',segment:'one',text:'Forest'},{id:'p2',segment:'one',text:'Character'},{id:'p3',segment:'two',text:'City'}];
assert.deepEqual(buildPhotoPlan(['one','two'],{one:3,two:1},prompts),[
 {segment:'one',prompt:'Forest'},{segment:'one',prompt:'Character'},{segment:'one',prompt:'Forest'},{segment:'two',prompt:'City'}
]);
assert.deepEqual(buildPhotoPlan(['overall'],{overall:1},[{id:'p',segment:'overall',text:'Overview'}]),[{segment:'',prompt:'Overview'}]);
assert.equal(buildPhotoPlan(['one','two'],{one:0,two:1},prompts).length,1);
assert.throws(()=>buildPhotoPlan(['one'],{},prompts),/barem/);
assert.throws(()=>buildPhotoPlan(['one'],{one:1},prompts),/najmanje/);
assert.throws(()=>buildPhotoPlan(['two'],{two:2.5},prompts),/1 do 10/);
assert.throws(()=>buildPhotoPlan(['two'],{two:1},[{id:'p',segment:'two',text:'  '}]),/popunjen/);
const many=Array.from({length:9},(_,i)=>`frame-${i}`);
assert.throws(()=>buildPhotoPlan(many,Object.fromEntries(many.map(id=>[id,10])),many.map(id=>({id,segment:id,text:'Frame'}))),/80/);

assert.deepEqual(localTimelineDuration([],[],[],0),{minimum:0,duration:10});
assert.deepEqual(localTimelineDuration([5],[20],[8],12),{minimum:20,duration:12});
assert.deepEqual(localTimelineDuration([45],[20],[8],60),{minimum:45,duration:60});
assert.equal(localTimelineDuration([65],[20],[8],60).duration,60);
assert.equal(extendTimelineRequest(45,65,60),65);
assert.equal(extendTimelineRequest(65,65,12),12);
assert.equal(extendTimelineRequest(65,45,60),60);
assert.equal(extendTimelineRequest(0,20,0),0);
assert.ok(timelineZoomMaximum(21600,800)*800/100/21600*2>=240);
assert.equal(timelineClock(562.2),'09:22.2');
assert.equal(timelineClock(600),'10:00.0');
assert.equal(timelineClock(3599.99),'01:00:00.0');
assert.equal(timelineClock(NaN),'00:00.0');
console.log('Photo counts, frame prompts, timeline duration and timecode checks passed.');

const {imageOutputEstimate}=await loadTestModule('lib/image-estimate.ts','work/creative-tests');
assert.equal(imageOutputEstimate('1:1').tokens,439);
assert.equal(imageOutputEstimate('16:9').usd,0.01029);
assert.equal(imageOutputEstimate('9:16').usd,0.01029);
const {localMediaLanes}=await loadTestModule('lib/local-media-lanes.ts','work/creative-tests');
const base={assetId:'a',start:0,inPoint:0,outPoint:4,layer:1};
const media=[{...base,id:'image',type:'video',groupId:'g'},{...base,id:'voice',type:'audio',audioRole:'narration'},{...base,id:'sound',type:'audio',audioRole:'sound'},{...base,id:'original',type:'audio',groupId:'g'}];
assert.deepEqual(localMediaLanes(media).map(l=>[l.key,l.clips.map(c=>c.id)]),[['images',['image']],['narration',['voice']],['sounds',['sound','original']]]);
const {rulerTicks}=await loadTestModule('lib/video-layout.ts','work/creative-tests');
const late=rulerTicks(21600,2592000,{start:18000,end:18007});
assert.ok(late.length<20&&late.every(t=>t.time>=18000&&t.time<=18007));
console.log('Explicit duration, automatic extension, long-timeline zoom/ruler, image estimate and separate audio lanes passed.');
const {drawStillScene}=await loadTestModule('lib/still-scenes.tsx','work/creative-tests');
const draws=[];
const ctx={canvas:{width:100,height:100},globalAlpha:1,save(){},restore(){},drawImage(...args){draws.push(args)},translate(){},scale(){}};
const still={assetId:'image',start:0,inPoint:0,outPoint:5,layer:1,imageTransitionDuration:1};
const images=new Map([['image',{naturalWidth:100,naturalHeight:100}]]);
for(const [direction,x,y] of [['slide-left',-50,0],['slide-right',50,0],['slide-up',0,50],['slide-down',0,-50]]){
 draws.length=0;drawStillScene(ctx,images,{...still,imageTransition:direction},.5,1);
 assert.equal(draws[0][1],x);assert.equal(draws[0][2],y);
}
drawStillScene(ctx,images,{...still,filter:{id:'mono',start:0,end:5,strength:100}},1,1);
assert.match(ctx.filter,/grayscale/);
console.log('Directional image entrances and shared image filter drawing passed.');
