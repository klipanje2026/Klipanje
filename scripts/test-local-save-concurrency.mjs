import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';
const source=fs.readFileSync('frontend/src/components/LocalVideoStorage.tsx','utf8');
const fn=source.slice(source.indexOf(' async function save():'),source.indexOf(' async function manualSave()'));
const code=ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let patches=0,release;const gate=new Promise(resolve=>release=resolve);
const latest={current:{changeKey:'first',script:{id:'same',project:'project',photo_settings:{},segments:[]},snapshot:async()=>({data:{clips:[]},files:[]}),putScript:()=>{}}};
const state={syncing:{current:false},sourceState:{current:'[]'},choiceState:{current:{}},sourceText:{current:'[]'},failedKey:{current:''},acceptedText:{current:''},rejectedText:{current:''},scriptSourceKey:()=> '[]',scriptTextKey:()=> '[]',scriptChoices:()=> ({}),localConfirm:async()=>true,activeSave:{current:null},ready:{current:true},opening:false,disabled:false,blocked:false,latest,savedKey:{current:''},saveError:{current:''},setBusy:()=>{},setMessage:()=>{},remoteFiles:new WeakMap(),uploadAsset:()=>{throw Error('Unexpected upload');},getMediaTiming:()=>{},apiJson:async(url,options)=>{assert.equal(url,'/api/scripts/same');if(!options)return latest.current.script;patches++;if(patches===1)await gate;return {...latest.current.script,storyboardRevision:String(patches),storyboard:{savedAt:new Date().toISOString()}};},jsonBody:x=>x,editorIntervals:()=>[],revision:{current:'0'},lastSaved:{current:''},ApiError:class extends Error{},setBlocked:()=>{}};
const save=new Function(...Object.keys(state),code+';return save;')(...Object.values(state));
const first=save();latest.current.changeKey='second';const second=save(),third=save();release();
assert.deepEqual(await Promise.all([first,second,third]),[true,true,true]);assert.equal(patches,2);await save();assert.equal(patches,2);
console.log('Concurrent autosave/exit: one serialized writer, latest edit saved, unchanged save skipped.');

const stale={...state,activeSave:{current:null},savedKey:{current:''},failedKey:{current:''},ready:{current:true},saveError:{current:''},
 scriptSourceKey:s=>JSON.stringify(s.segments),
 apiJson:async(url,options)=>{assert.equal(options,undefined,'A changed source must be detected before PATCH');return {...latest.current.script,segments:[{id:'new',text:'New story',start:0,end:5}]};}
};
const staleSave=new Function(...Object.keys(stale),code+';return save;')(...Object.values(stale));
assert.equal(await staleSave(),false);
assert.equal(stale.failedKey.current,latest.current.changeKey);
assert.ok(stale.saveError.current.length>0);
console.log('Source changed elsewhere: old montage cannot overwrite the new script and failed autosave is remembered.');

const planned={...state,activeSave:{current:null},savedKey:{current:''},failedKey:{current:''},ready:{current:true},latest:{current:{...latest.current,changeKey:'planned',snapshot:async()=>({data:{preeditor:{version:1},clips:[]},files:[]})}},editorIntervals:()=>{throw Error('Preeditor must not rewrite the source script');}};
const savePlanned=new Function(...Object.keys(planned),code+';return save;')(...Object.values(planned));
assert.equal(await savePlanned(),true);
console.log('Preeditor montage saves without deriving or deleting source script intervals.');
