import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {writeFileSync} from 'node:fs';
import {loadTestModule} from './test-ts-module.mjs';
const {createOverlay,restoreOverlays,drawOverlays,overlayMotion}=await loadTestModule('lib/video-overlays.ts','work/flag-tests');
const {flagPresets,registerFlagImage}=await loadTestModule('lib/flag-animation.ts','work/flag-tests');
for(const p of flagPresets)registerFlagImage(p.value.flagCountry,await loadImage(`frontend/public/flags/${p.value.flagCountry}.svg`));
const canvas=createCanvas(640,480),ctx=canvas.getContext('2d');
const render=(o,t)=>{ctx.clearRect(0,0,640,480);drawOverlays(ctx,[o],t);return canvas.toBuffer('image/png');};
const sheet=createCanvas(1200,400),sc=sheet.getContext('2d');sc.fillStyle='#231f1c';sc.fillRect(0,0,1200,400);
for(const [i,p] of flagPresets.entries()){
 const item={...createOverlay(p,0,10),width:70,height:80,flagArrival:'none'};
 assert.deepEqual(restoreOverlays(JSON.parse(JSON.stringify([item]))),[item]);
 const a=render(item,2),b=render(item,2.3);assert.notDeepEqual(a,b);
 assert.deepEqual(render({...item,flagStrength:0},2),render({...item,flagStrength:0},2.3));
 assert.deepEqual(render({...item,flagSpeed:0},2),render({...item,flagSpeed:0},2.3));
 assert.notDeepEqual(render({...item,flagPole:false},2),a);
 assert.notDeepEqual(render({...item,flagShape:'pennant'},2),a);
 const flight={...item,flagArrival:'left',animationDuration:1.2};
 assert.ok(overlayMotion(flight,0).x < -item.x);assert.ok(Math.abs(overlayMotion(flight,1.2).x)<1e-9);
 assert.ok(Math.abs(overlayMotion({...flight,flagArrival:'top'},1.2).y)<1e-9);
 sc.drawImage(await loadImage(render(item,2)),i*400,20,400,300);sc.fillStyle='#fff';sc.font='20px sans-serif';sc.fillText(p.name,i*400+80,355);
}
writeFileSync('work/flag-preview.png',sheet.toBuffer('image/png'));
console.log('Three flags: shared drawing, persistence, motion, stationary settings, pole, pennant and landing passed.');
