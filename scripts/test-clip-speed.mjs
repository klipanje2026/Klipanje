import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync('frontend/src/lib/clip-speed.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {clipRate,clipSourceTime,retimeClip}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const original={id:'a',start:10,inPoint:2,outPoint:8,audioEnvelope:{fadeIn:{start:2,duration:1}}};
for(const rate of [.1,.5,1.1,1.2,2]){
 const clip=retimeClip(original,rate);
 assert.ok(Math.abs((clip.outPoint-clip.inPoint)-6/rate)<1e-8);
 assert.ok(Math.abs(clipSourceTime(clip,10)-2)<1e-8);
 assert.ok(Math.abs(clipSourceTime(clip,10+3/rate)-5)<1e-8);
 assert.equal(clip.audioEnvelope.fadeIn.start,2/rate);
 const restored=retimeClip(clip,1);assert.ok(Math.abs(restored.outPoint-8)<1e-8);
 const splitTime=clip.inPoint+2/rate;
 const second={...clip,inPoint:splitTime,start:clip.start+2/rate};
 assert.ok(Math.abs(clipSourceTime(second,second.start)-4)<1e-8);
 assert.equal(clipRate(JSON.parse(JSON.stringify(clip))),rate);
}
assert.equal(clipRate({}),1);assert.equal(original.outPoint,8);
console.log('Clip speed: source range, duration, split continuity, envelope, restore and persistence passed.');
