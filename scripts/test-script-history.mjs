import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('frontend/src/lib/use-script-history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
let slots=[],cursor=0;
const react={useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],v=>{slots[i]=v;}];},useRef:v=>{const i=cursor++;return slots[i]??={current:v};}};
const exports={};runInNewContext(code,{exports,require:()=>react});
const initial={content:'Original',title:'Test',segments:[{id:'1',start:0,end:2,text:'Hello'}],keepQuotes:true};
const render=()=>{cursor=0;return exports.useScriptHistory(initial);};
let h=render();assert.equal(h.canUndo,false);
h.field('content')('First');h=render();h.field('content')('Second');h=render();h.undo();h=render();assert.equal(h.value.content,'Original');
h.field('segments')(items=>[...items,{id:'2',start:2,end:4,text:'World'}]);h=render();h.field('keepQuotes')(false);h=render();h.undo();h=render();assert.equal(h.value.keepQuotes,true);assert.equal(h.value.segments.length,2);h.undo();h=render();assert.deepEqual(h.value.segments,initial.segments);
h.field('title')('New');h=render();h.undo();h=render();assert.equal(h.value.title,'Test');h.field('title')('Different');h=render();h.undo();h=render();assert.equal(h.value.title,'Test');
slots=[];h=render();assert.equal(h.canUndo,false);console.log('Script undo: typing, interval edits, settings, new edits after undo and script isolation passed.');

// Merging must restore both original IDs, text, prompts and following timings in one undo.
slots=[];h=render();
const scenes=[{id:'a',start:0,end:2,text:'First',prompt:'A'},{id:'b',start:2,end:5,text:'Second',prompt:'B'},{id:'c',start:5,end:7,text:'Third',prompt:'C'}];
h.field('segments')(scenes);h=render();
h.field('segments')(items=>[{...items[0],text:'First Second',end:4},{...items[2],start:4,end:6}]);h=render();
assert.equal(h.value.segments.length,2);assert.equal(h.canUndo,true);
h=render();h.undo();h=render();assert.deepEqual(h.value.segments,scenes);
console.log('Merge undo restores both scenes and following timings after rerender.');
