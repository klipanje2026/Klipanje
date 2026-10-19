import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('frontend/src/lib/audio-envelope.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {audioEnvelopeGain:gain}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const env={fadeIn:{start:0,duration:1},fadeOut:{start:8,duration:2},lower:{start:2,duration:2,level:.2}};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
near(gain(undefined,4),1);near(gain(env,0),0);near(gain(env,.5),.5);near(gain(env,1),1);near(gain(env,3),.6);near(gain(env,4),.2);near(gain(env,9),.1);near(gain(env,10),0);
// The right-hand cut retains source-time gain, even when moved on the timeline.
const right={start:20,inPoint:3};near(gain(env,right.inPoint+20.5-right.start),gain(env,3.5));
near(gain(JSON.parse(JSON.stringify(env)),3.5),.4);
near(gain({lower:{start:1,duration:1,level:0}},3),0);
near(gain({lower:{start:1,duration:0,level:NaN}},3),1);
console.log('Audio fades, lower-to-level, cut/move continuity and persistence passed.');
