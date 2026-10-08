/** Reproducible source adaptation of Semir's supplied collection. Does not run it. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const root=process.cwd(),input=resolve(root,'work/imports/2026-10-02-caption-collection/studio-titlova');
const output=resolve(root,'frontend/src/lib/collection'),assets=resolve(root,'frontend/public/caption-collection');
await mkdir(output,{recursive:true});await mkdir(join(assets,'fonts'),{recursive:true});await mkdir(join(assets,'licenses'),{recursive:true});
const provenance=[];
async function source(name){const bytes=await readFile(join(input,name));provenance.push({file:name,sha256:createHash('sha256').update(bytes).digest('hex')});return bytes.toString('utf8');}
async function emit(name,text){await writeFile(join(output,name),text);}
const catalog=JSON.parse(await source('catalog.json'));
await copyFile(join(input,'catalog.json'),join(assets,'catalog.json'));
let css=await source('assets/fonts.css');
const fontPaths=[...new Set([...css.matchAll(/url\(['"]?(?:\.\/)?fonts\/([^)'"\s]+)/g)].map(m=>m[1]))];
for(const file of fontPaths)await copyFile(join(input,'assets/fonts',file),join(assets,'fonts',file));
await writeFile(join(assets,'fonts.css'),css);
const {readdir}=await import('node:fs/promises');
for(const name of await readdir(join(input,'assets/licenses')))await copyFile(join(input,'assets/licenses',name),join(assets,'licenses',name));
for(const name of ['hyper-font-license.txt','titanium-font-license.txt'])await copyFile(join(input,'source',name),join(assets,'licenses',name));
let three=await source('assets/three-0.169.0.js');
three=three.replace('(()=>{','').replace(/(?:window|globalThis)\.THREE\s*=\s*\{/,'export {').replace(/\}\)\(\);\s*$/,'');
await emit('three.mjs',three);
const modules=['hyper-fonts','hyper-palettes','hyper-material','hyper-renderer','hyper-marks-renderer','juice-material','juice-renderer','noir-material','noir-renderer','rift-effects','rift-material','rift-renderer','titanium-font','titanium-material','titanium-renderer','paper-renderer','fusion-renderer'];
for(const name of modules){
 let text=await source('source/'+name+'.js');
 text=text.replaceAll('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js','./three.mjs').replace(/(from\s+['"]\.\/[^'"]+)\.js(['"])/g,'$1.mjs$2');
 // Font CSS is shipped locally and awaited by Edita before creating a renderer.
 text=text.replace(/    if\(!document\.querySelector\('link\[data-[\s\S]*?await loaded;\}/g,'');
 if(name==='noir-renderer')text=text.replace("this.font='700 400px Georgia, serif'","this.font='700 400px Cinzel, Georgia, serif'");
 if(name==='rift-renderer')text=text.replace(/this.font='[^']+'/,'this.font=\'400 400px "Rammetto One", Impact, sans-serif\'');
 if(name==='paper-renderer')text=text.replace("this.font='900 200px Arial, sans-serif'","this.font='200px \"Bowlby One SC\", sans-serif'");
 if(name==='fusion-renderer')text=text.replace('this.font=`900 180px Arial`','this.font=`180px "${fontFamily}"`');
 // Keep the original stage composition, with a separately switchable backdrop.
 text=text.replaceAll('this.background.visible=stage','this.background.visible=stage&&!this.transparentStage').replaceAll('this.floor.visible=stage','this.floor.visible=stage&&!this.transparentStage');
 text=text.replace("this.studio.visible=!video","this.studio.visible=!video&&!this.transparentStage").replace("this.backdrop.visible=this.mode==='showcase'","this.backdrop.visible=this.mode==='showcase'&&!this.transparentStage");
 text=text.replace('this.studio.visible=studio','this.studio.visible=studio&&!this.transparentStage');
 await emit(name+'.mjs',text);
}

const omitted=new Set(['rebuild','resize','draw','tick','play','pause','seek','save','restore','updateMaterialControls','setMaterial','checkConnection']);
function parseBody(name,text){
 const file=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let body;
 function visit(node){if(ts.isBlock(node)&&node.statements.some(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='draw'))body=node;ts.forEachChild(node,visit);}visit(file);
 if(!body)throw new Error('Missing artwork body: '+name);
 return{file,body};
}
const configs={
 'forged':{font:'Bungee, Impact, sans-serif',span:2.3,height:460},
 'prism-bloom':{font:'italic 144px "DM Serif Display", Georgia',span:2.7,height:480},
 'ink-riot':{font:'160px Knewave, Impact',span:3,height:480,roles:true,upper:true},
 'porcelain-flow':{font:'160px Rakkas, Georgia',span:3.2,height:485,roles:true},
 'laser-trace':{font:'700 110px Orbitron, sans-serif',span:3.2,height:470,upper:true},
 'velvet-pulse':{font:'160px "Lilita One", sans-serif',span:3,height:480,roles:true},
};
for(const [name,config]of Object.entries(configs)){
 const original=await source('source/'+name+'.js'),{file,body}=parseBody(name,original);
 const vars=[],functions=[];
 const skip=new Set(['root','canvas','ctx','playButton','scrub','picker','inputs','reduced','materialButtons','sentences','segments','chunks','glyphs','time','duration','width','height','playing','last','raf','active','chunkIndex','savedSignature','disposed','font','fontFamily','observer','cleanup','connectionCheck','settings']);
 let settings;
 for(const statement of body.statements){
  if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations){
   const key=d.name.getText(file),value=d.initializer?.getText(file);
   if(key==='settings')settings=value;
   if(!skip.has(key))vars.push(`${statement.declarationList.flags&ts.NodeFlags.Const?'const':'let'} ${d.getText(file)};`);
  }
  if(ts.isFunctionDeclaration(statement)&&!omitted.has(statement.name?.text))functions.push(statement.getText(file));
 }
 let draw=body.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='draw').getText(file);
 // Remove only demo transport / DOM status; the painting statements stay intact.
 draw=draw.slice(draw.indexOf('{')+1,draw.lastIndexOf('}'));
 const a=draw.indexOf('if(next!=='),b=draw.indexOf('const local=',a);
 draw=draw.slice(b);
 draw=draw.replace(/const local=time-(?:active|chunkIndex)\*[\d.]+/,'const local=seconds');
 draw=draw.slice(0,draw.indexOf('scrub.value='));
 draw=draw.replace(/\b(background|backdrop)\(([^)]*)\);/g,'if(options.backdrop)$1($2);');
 const upper=config.upper||name==='forged';
 const make=name==='forged'?'createGlyph':'makeGlyph';
 const text=`/** ${name}: original painting functions; UI, demo clock and host messaging removed. */
export function createArtwork(canvas,options={}){
 const ctx=canvas.getContext('2d'),reduced={matches:false};
 const settings={...${settings},...options};
 const width=736,height=${config.height},glyphs=new Map();
 let time=0,active=0,chunkIndex=0,segments=[],chunks=[],signature='';
 const ${name==='forged'?'fontFamily':'font'}=${JSON.stringify(config.font)};
 ${vars.join('\n')}
 ${functions.join('\n')}
 ${name==='ink-riot'?'paper=makePaper();':''}
 return {canvas,aspect:width/height,span:${config.span},
  resize(w,h){canvas.width=Math.max(1,Math.round(w));canvas.height=Math.max(1,Math.round(h));},
  render(words,seconds,_timings,groupIndex=0){
   active=chunkIndex=groupIndex;
   words=words.map(w=>${upper?"w.toLocaleUpperCase('hr')":"w"});
   const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=chunks=[];segments[groupIndex]={words,cue:0};glyphs.clear();
    ${config.roles?`words.forEach((word,line)=>{const hero=words.length===1||line===1;for(const char of word)glyphs.set(char+':'+(hero?'1':'0'),${make}(char,hero));});`:`for(const char of new Set(words.join('')))glyphs.set(char,${make}(char));`}
   }
   time=seconds+groupIndex*${config.span};ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,width,height);
   {${draw}}
  },dispose(){glyphs.clear();canvas.width=canvas.height=1;}
 };
}
`;
 await emit(name+'.mjs',text);
}
for(const [name,span,font]of [['magma-core',3.8,'200px Bungee, Impact, sans-serif'],['abyssal-pearl',4.2,'200px "Dela Gothic One", sans-serif']]){
 const original=await source('source/'+name+'.js'),{file,body}=parseBody(name,original),vars=[],functions=[];
 const skip=new Set(['canvas','playButton','picker','scrub','inputs','reduced','settings','sentences','segments','time','duration','active','local','playing','raf','last','disposed','savedSignature','font','width','height','viewWidth','renderer','scene','camera','observer','cleanup']);
 let settings;
 for(const statement of body.statements){
  if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations){
   const key=d.name.getText(file);if(key==='settings')settings=d.initializer.getText(file);
   if(!skip.has(key))vars.push(`${statement.declarationList.flags&ts.NodeFlags.Const?'const':'let'} ${d.getText(file)};`);
  }
  if(ts.isFunctionDeclaration(statement)&&!omitted.has(statement.name?.text)){
   let text=statement.getText(file);
   if(statement.name.text==='setup'){
    text=text.replace('antialias:true,alpha:true','antialias:true,alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:false').replace(/renderer.setPixelRatio\([^;]+;/,'renderer.setPixelRatio(1);').replace(/renderer.setClearColor\([^;]+;/,'renderer.setClearColor(0,options.backdrop?1:0);');
    text=text.replace('scene.add(bg);','bg.visible=!!options.backdrop;scene.add(bg);');
    // Preserve the original post-processing, deriving alpha from glyphs and bloom.
    text=text.replace('uStill:{value:0}},vertexShader:postVertex','uStill:{value:0},uTransparent:{value:options.backdrop?0:1}},vertexShader:postVertex');
    text=text.replace(/uniform float uTime,(uHeat|uShine),uStill;/,'uniform float uTime,$1,uStill,uTransparent;');
    text=text.replace('gl_FragColor=vec4(c,1.);}`});',`float coverage=texture2D(uScene,uv).a;float bloom=max(max(glow.r,glow.g),glow.b);float alpha=uTransparent<.5?1.:(coverage+bloom<.0001?0.:clamp(max(coverage,max(max(c.r,c.g),c.b)),0.,1.));gl_FragColor=vec4(uTransparent<.5?c:c/max(alpha,.001),alpha);}\x60});`);
   }
   functions.push(text);
  }
 }
 await emit(name+'.mjs',`/** Original ${name} geometry, materials and animation with a media-time adapter. */
import * as THREE from './three.mjs';
export function createArtwork(canvas,options={}){
 const settings={...${settings},...options},reduced={matches:false},font=${JSON.stringify(font)};
 let width=736,height=500,viewWidth=14.7,renderer=null,scene=null,camera=null;
 let segments=[],active=0,time=0,local=0,signature='';
 ${vars.join('\n')}
 ${functions.join('\n')}
 function resize(w=736,h=500){width=w;height=h;if(!renderer)return;
  camera.aspect=width/height;camera.updateProjectionMatrix();viewWidth=2*17*Math.tan(16*Math.PI/180)*camera.aspect;
  renderer.setSize(width,height,false);sourceTarget.setSize(width,height);glowTarget.setSize(Math.max(1,Math.round(width/2)),Math.max(1,Math.round(height/2)));
  blurMaterial.uniforms.uTexel.value.set(1/width,1/height);finalMaterial.uniforms.uTexel.value.set(2/width,2/height);
  ${name==='magma-core'?'sparks':'dust'}.material.uniforms.uRatio.value=1;
 }
 setup();
 return {canvas,renderer,aspect:736/500,span:${span},resize,
  render(words,seconds,_timings,groupIndex=0){active=groupIndex;const key=JSON.stringify([words,groupIndex]);if(key!==signature){signature=key;segments=[];segments[groupIndex]={words,cue:0};buildWords();}time=seconds+groupIndex*${span};local=seconds;renderScene();},
  dispose(){clearLetters();glyphCache.clear();scene.traverse(obj=>{obj.geometry?.dispose();if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>m.dispose());});sourceTarget.dispose();glowTarget.dispose();blurMaterial.dispose();finalMaterial.dispose();postQuad.geometry.dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
`);
}
await writeFile(join(assets,'provenance.json'),JSON.stringify({archive:'svi-titlovi-kolekcija.zip',imported:'2026-10-02',files:provenance},null,2));
console.log('Imported source modules, local fonts, licenses.');
