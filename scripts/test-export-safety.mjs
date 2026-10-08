import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import {runInNewContext} from 'node:vm';
const code=ts.transpileModule(await fs.readFile('frontend/src/lib/export-media.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};runInNewContext(code,{exports,setTimeout,clearTimeout,Error});
class Media extends EventTarget {src='';load(){queueMicrotask(()=>this.dispatchEvent(new Event(this.src==='good'?'loadeddata':this.src==='bad'?'error':'waiting')));}}
await exports.loadExportMedia(new Media(),'good',100);
await assert.rejects(exports.loadExportMedia(new Media(),'bad',100),/Izvorni/);
await assert.rejects(exports.loadExportMedia(new Media(),'stalled',5),/isteklo/);
// Exercise the actual LoadingVideo hooks through conversion and switching sources.
const componentCode=ts.transpileModule(await fs.readFile('frontend/src/components/LoadingVideo/LoadingVideo.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
let slots=[],cursor=0,effects=[],dirty=false;
const hook=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>v!==old.deps[n])){slots[i]={deps,clean:old?.clean};effects.push(()=>{slots[i].clean?.();slots[i].clean=fn();});}};
const React={useRef:v=>{const i=cursor++;return slots[i]??=( {current:v});},useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],value=>{const n=typeof value==='function'?value(slots[i]):value;if(n!==slots[i]){slots[i]=n;dirty=true;}}];},useEffect:hook,useLayoutEffect:hook,useCallback:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))slots[i]={deps,fn};return slots[i].fn;}};
const comp={};let conversions=0;runInNewContext(componentCode,{exports:comp,require:name=>name==='react'?React:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'}:name.includes('media-audio-compatibility')?{needsAudioPreparation:async()=>false}:name.includes('use-editing-preview')?{useEditingPreview:(_file,src)=>({src})}:name.includes('use-loading-leave-guard')?{useLoadingLeaveGuard:()=>{}}:name.includes('diagnostics')?{recordMediaFailure:()=>{},downloadDiagnostics:()=>{}}:{prepareBrowserVideo:async()=>{conversions++;return{};}},URL:{createObjectURL:()=>`blob:converted-${conversions}`,revokeObjectURL:()=>{}},AbortController,ResizeObserver:class{observe(){}disconnect(){}},document:{addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}},setTimeout:()=>1,clearTimeout:()=>{}});
const media={readyState:0,videoWidth:0,currentTime:0,pause(){},addEventListener(){},removeEventListener(){},load(){}};const ref={current:media};
const fileA={name:'A.mp4',size:10},fileB={name:'B.mp4',size:10};
function render(file,src){let tree;do{dirty=false;cursor=0;effects=[];tree=comp.LoadingVideo({file,src,ref});for(const effect of effects)effect();}while(dirty);return tree.props.children.find(child=>child?.type==='video');}
let video=render(fileA,'blob:A');video.props.onError({currentTarget:media});await new Promise(r=>setImmediate(r));video=render(fileA,'blob:A');assert.equal(video.props.src,'blob:converted-1');
video=render(fileB,'blob:B');assert.equal(video.props.src,'blob:B','Changing source must drop the previous converted video');video.props.onError({currentTarget:media});await new Promise(r=>setImmediate(r));video=render(fileB,'blob:B');assert.equal(conversions,2,'The next source can independently prepare its preview');assert.equal(video.props.src,'blob:converted-2');
console.log('Export media success/error/timeout and converted preview isolation passed.');

const offlineCode=ts.transpileModule(await fs.readFile('frontend/src/lib/offline-export.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const soundCode=ts.transpileModule(await fs.readFile('frontend/src/lib/caption-sounds.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const clockModule={},rangeModule={};
for(const [name,module] of [['caption-clock',clockModule],['export-range',rangeModule]]) {
 const compiled=ts.transpileModule(await fs.readFile(`frontend/src/lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(compiled,{exports:module});
}
const soundModule={};runInNewContext(soundCode,{exports:soundModule,require:name=>{assert.equal(name,'./caption-clock');return clockModule;}});
assert.equal(soundModule.captionSounds([{id:'s',text:'Test',start:2,end:3}],{captionSound:'pop'})[0].start,1.9,'Caption sound follows the same lead as the rendered words');
const textureCode=ts.transpileModule(await fs.readFile('frontend/src/lib/caption-texture-fill.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const textureModule={};runInNewContext(textureCode,{exports:textureModule});
const offlineModule={};runInNewContext(offlineCode,{exports:offlineModule,require:name=>{if(name==='./export-range')return rangeModule;if(name==='./collection-captions')return {};if(name==='./caption-sounds')return soundModule;if(name==='./caption-texture-fill')return textureModule;throw new Error(`Unexpected import: ${name}`);}});
for(const [width,height] of [[1920,1080],[3840,2160],[2160,3840]])for(const fps of [29.97,59.94,30000/1001,60000/1001,30,60]){
 const bitrate=offlineModule.exportVideoBitrate(width,height,fps);
 assert.ok(Number.isSafeInteger(bitrate)&&bitrate>0,'Fractional camera framerates produce a positive integer bitrate');
 assert.ok(bitrate>=8000000);
}
console.log('Integer encoder bitrate validated for portrait, 4K and fractional camera frame rates.');

const optionsCode=ts.transpileModule(await fs.readFile('frontend/src/components/ExportOptionsDialog.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const optionsModule={};runInNewContext(optionsCode,{exports:optionsModule,require:()=>({})});
assert.equal(optionsModule.exportFilename(' Moj video.mp4 '),'Moj video.mp4');
assert.equal(optionsModule.exportFilename('   '),'edita-video.mp4');
assert.equal(optionsModule.exportFilename('Video/test:one'),'Video-test-one.mp4');
