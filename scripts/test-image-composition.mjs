import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createCanvas} from '@napi-rs/canvas';
const source=ts.transpileModule(readFileSync('frontend/src/lib/image-composition.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {compositionBoxes,drawComposition}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const canvas=createCanvas(400,400),ctx=canvas.getContext('2d'),images=new Map();
['#ff0000','#00ff00','#0000ff','#ffff00'].forEach((color,i)=>{const c=createCanvas(100,100);c.naturalWidth=100;c.naturalHeight=100;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,100,100);images.set(String(i),c);});
const value={items:[0,1,2,3].map(i=>({assetId:String(i),at:i})),layout:'grid',gap:0,border:0,borderStyle:'solid',color:'#ffffff',animation:'none'};
const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
drawComposition(ctx,images,value,.5);
assert.deepEqual(pixel(100,100),[255,0,0,255]);assert.equal(pixel(300,100)[3],0);
drawComposition(ctx,images,value,3.5);
assert.deepEqual(pixel(300,100),[0,255,0,255]);assert.deepEqual(pixel(100,300),[0,0,255,255]);assert.deepEqual(pixel(300,300),[255,255,0,255]);
ctx.clearRect(0,0,400,400);drawComposition(ctx,images,{...value,animation:'fade'},.2);
assert.ok(pixel(100,100)[3]>110&&pixel(100,100)[3]<140);
ctx.clearRect(0,0,400,400);drawComposition(ctx,images,{...value,gap:2,border:1},4);
assert.equal(pixel(0,0)[3],0);assert.deepEqual(pixel(6,50),[255,255,255,255]);
for(const borderStyle of ['dashed','double'])drawComposition(ctx,images,{...value,border:1,borderStyle},4);
const stack=compositionBoxes(4,'overlap');
assert.ok(stack[0].x+stack[0].w>stack[1].x);
assert.equal(compositionBoxes(4,'strips')[3].x,75);
assert.equal(compositionBoxes(2,'grid')[0].h,100);
console.log('Composition staggered timing, four-image layout, fades, gaps, borders and overlap passed on real canvas.');

for(const count of [2,3,4]){
 ctx.clearRect(0,0,400,400);
 drawComposition(ctx,images,{...value,items:value.items.slice(0,count),layout:'overlap',gap:8},5);
 for(let y=0;y<400;y+=10)for(let x=0;x<400;x+=10)assert.equal(pixel(x,y)[3],255,`Gap at ${x},${y} for ${count} images`);
}
for(const borderStyle of ['wood','paper']){
 ctx.clearRect(0,0,400,400);drawComposition(ctx,images,{...value,border:3,borderStyle},5);
 assert.deepEqual(pixel(100,100),[255,0,0,255]);
 assert.equal(pixel(2,2)[3],255);
 assert.notDeepEqual(pixel(2,2),pixel(100,2));
}
assert.equal(stack[2].x,0);assert.ok(stack[2].y>0);assert.equal(stack[3].x+stack[3].w,100);
console.log('Overlap fills the frame as a grid; wood/paper frames render without gaps and preserve image interiors.');

assert.equal(compositionBoxes(4,'grid',6,35)[0].w,35);
assert.equal(compositionBoxes(4,'grid',6,35)[1].x,35);
assert.equal(compositionBoxes(4,'strips',6,50,'horizontal')[3].y,75);
assert.equal(compositionBoxes(4,'strips',6,50,'horizontal')[3].w,100);
console.log('Grid split and horizontal strip controls use the shared composition geometry.');
