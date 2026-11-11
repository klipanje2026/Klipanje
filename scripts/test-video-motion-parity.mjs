import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createCanvas} from '@napi-rs/canvas';

const encode=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React}}).outputText;
const dependencies={};
for(const name of ['sunlight-motion','heart-exit','video-layout','scene-effects'])dependencies[name]=encode(compile(`frontend/src/lib/${name}.ts`));
let still=compile('frontend/src/lib/still-scenes.tsx');
still=still.replace(/import .* from ['"]react['"];?/g,'').replace(/import .* from ['"].\/image-composition['"];?/g,'const drawComposition=()=>{throw Error("Unexpected composition")};');
for(const [name,url] of Object.entries(dependencies))still=still.replaceAll(`'./${name}'`,JSON.stringify(url)).replaceAll(`"./${name}"`,JSON.stringify(url));
const stillUrl=encode(still);
let video=compile('frontend/src/lib/video-scene.ts').replace(/import .* from ['"].\/still-scenes['"];?/,`import {drawStillScene} from ${JSON.stringify(stillUrl)};`);
video=video.replace(/import .* from ['"].\/video-background['"];?/,'const drawVideoBackground=(ctx,frame,bg,x,y,w,h)=>ctx.drawImage(frame,x,y,w,h);');
const {drawStillScene}=await import(stillUrl);
const {drawVideoScene,needsVideoScene}=await import(encode(video));
const source=createCanvas(320,180),paint=source.getContext('2d');
paint.fillStyle='#254b65';paint.fillRect(0,0,320,180);paint.fillStyle='#efae62';paint.fillRect(30,20,100,90);
Object.assign(source,{naturalWidth:320,naturalHeight:180,videoWidth:320,videoHeight:180,currentTime:0});
const images=new Map([['a',source]]);
let count=0;
const effects=[...['none','zoom-in','zoom-out','pan','pan-up','pan-down','breathe','shake','surprise','wind'].map(motion=>({motion})),...['fade','crossfade','slide-left','slide-right','slide-up','slide-down'].flatMap(id=>[{imageTransition:id},{imageExit:id}]),{imageExit:'heart'},{sunlight:true},{filter:{id:'blink',start:3,end:5,strength:100}}];
for(const effect of effects)for(const elapsed of [.1,.4,1,2.5,4.8]){
 const clip={assetId:'a',start:10,inPoint:3,outPoint:8,layer:0,...effect};
 const a=createCanvas(320,180),b=createCanvas(320,180);
 drawStillScene(a.getContext('2d'),images,clip,10+elapsed,16/9);
 drawVideoScene(b.getContext('2d'),source,clip,elapsed,5,16/9,3+elapsed);
 assert.deepEqual(b.toBuffer('image/png'),a.toBuffer('image/png'),JSON.stringify({effect,elapsed}));count++;
}
assert(needsVideoScene({motion:'zoom-in'}));assert(needsVideoScene({imageTransition:'crossfade'}));assert(!needsVideoScene({motion:'none'}));
console.log(`Video/image motion parity: ${count} matching rendered frames, all motion modes, entries/exits, heart, blink and sunlight.`);
