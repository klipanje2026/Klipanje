/** Source import only: does not render frames or run a comparison suite. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
const referenceRoot=resolve(process.argv[2]||'work/imports/studio-titlova');
const input=join(referenceRoot,'source'),out=resolve('frontend/src/lib/studio-library/source');
await mkdir(out,{recursive:true});await mkdir('frontend/public/studio-library/licenses',{recursive:true});
const catalog=JSON.parse(await readFile(join(referenceRoot,'catalog.json'),'utf8'));
const old=new Set(JSON.parse(await readFile('frontend/public/caption-collection/catalog.json','utf8')).map(x=>x.id));
const items=catalog.filter(x=>!old.has(x.id)),families={};
const titleIds=['chroma-loop','flipcore','warp-jam','parallax','pleat','quanta','unwind','ricochet','shutter','swerve','folio','splice','optic-poetry','new-world'];
for(const id of titleIds)families[id]={file:id+'-renderer',config:id+'-config',mode:'title',crop:[0,1000,1080,920],words:8};
const specs=[
 ['lustreCut','lustre','LustreStyles','lustre-cut','lower',8],
 ['powerCaptions','power-captions','PowerStyles','power','lower',8],
 ['formCaptions','form-captions','FormStyles','form','lower',8],
 ['chromaCaptions','chroma-captions','ChromaStyles','chroma','lower',8],
 ['motionCaptions','motion-captions','MotionStyles','atlas','lower',8],
 ['kineticCaptions','kinetic-captions','KineticStyles','kinetic','lower',8],
 ['amplifyCaptions','amplify-captions','AmplifyStyles','amplify','lower',8],
 ['speakerCaptions','speaker-captions','SpeakerStyles','speaker','lower',8],
 ['colorDirections','color-directions','ColorDirections','look','middle',8],
 ['cutFinish','cut-finish','CutStyles','coated','middle',8],
 ['cutCaptions','cut-captions','CutStyles','cut','middle',8],
 ['portraitCaptions','portrait','PortraitStyles','portrait','middle',8],
 ['liquidImpact','liquid','LiquidStyles','liquid','flex',12],
 ['megaCaptions','mega','MegaStyles','mega','flex',12],
 ['quietWorlds','quiet-worlds','QuietWorlds','world','flex',24],
 ['businessStack','business-stack','BusinessStyles','business','flex',24],
 ['crystalGlass','crystal-glass','CrystalPalettes','reference','glass',4],
 ['luxuryThemes','luxury-themes','LuxuryThemes','theme','meadow',2],
 ['meadowType','meadow','MeadowPalettes','forest','meadow',2],
];
for(const [api,file,exportName,variant,mode,words]of specs)families[api]={file:file+'-renderer',config:file==='cut-finish'?'cut-captions-config':file==='meadow'?'meadow-palettes':file==='crystal-glass'?null:file+'-config',exportName,variant,mode,words,crop:mode==='lower'?[0,1000,1080,920]:mode==='middle'?[0,400,1080,1250]:null};
const visited=new Set(),fontLoaders=new Map(),dependencies=new Map(),classes=new Map();
async function copyModule(name){
 if(visited.has(name))return;visited.add(name);
 const raw=await readFile(join(input,name+'.js'),'utf8');
 const deps=[...raw.matchAll(/(?:from\s*|import\s*)['"]\.\/([^'"]+)\.js['"]/g)].map(m=>m[1]);dependencies.set(name,deps);
 fontLoaders.set(name,[...raw.matchAll(/export\s+(?:async\s+)?function\s+(load\w*Fonts?)\s*\(/g)].map(m=>m[1]));
 const cls=raw.match(/export class (\w+)/);if(cls)classes.set(name,cls[1]);
 let text=raw.replaceAll('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js','../../collection/three.mjs').replace(/((?:from\s*|import\s*)['"]\.\/[^'"]+)\.js(['"])/g,'$1.mjs$2');
 // Keep the reference stage geometry while allowing transparent compositing.
 if(['meadow-renderer','luxury-themes-renderer'].includes(name))text=text.replaceAll('this.background.visible=stage','this.background.visible=stage&&!this.transparentStage').replaceAll('this.floor.visible=stage','this.floor.visible=stage&&!this.transparentStage');
 // HALO's second row can be empty when a caption ends with one word.
 if(name==='form-captions-renderer')text=text.replace('for(const [i,words]of parts.entries()){','for(const [i,words]of parts.entries()){if(!words.length)continue;');
 // Demo sentence sizes are not input requirements in Edita. The shared
 // adapter already pages long captions and supplies real word timings.
 text=text.replaceAll('tokens.length<12||tokens.length>24','tokens.length<1')
  .replaceAll('tokens.length<1||tokens.length>24','tokens.length<1')
  .replaceAll('tokens.length!==12','tokens.length<1')
  .replaceAll('count<12','count<1')
  .replaceAll('Blok mora imati između 12 i 24 riječi.','Titl mora sadržavati tekst.')
  .replaceAll('Blok mora imati između 1 i 24 riječi.','Titl mora sadržavati tekst.')
  .replaceAll('Svaka rečenica treba najmanje 12 riječi.','Titl mora sadržavati tekst.')
  .replace('`Svaki titl mora imati tačno 12 riječi (primljeno ${tokens.length}).`',"'Titl mora sadržavati tekst.'");
 if(name==='amplify-captions-renderer')text=text.replace('for(let r=0;r<counts.length;r++){','for(let r=0;r<counts.length;r++){if(!counts[r])continue;');
 if(['portrait-renderer','cut-captions-renderer'].includes(name)){
  text=text.replace('for(let r=0;r<style.rows.length;r++){','for(let r=0;r<style.rows.length;r++){if(index>=cue.words.length)break;');
  text=text.replaceAll('space*(count-1)',name==='portrait-renderer'?'space*(selected.length-1)':'space*(words.length-1)');
 }
 if(name==='portrait-renderer')text=text.replaceAll('(end-start)*.047','(end-start)/tokens.length');
 if(name==='speaker-captions-renderer')text=text
  .replace('for(const [groupIndex,count] of style.groups.entries()){','for(const [groupIndex,count] of style.groups.entries()){if(cursor>=cue.words.length)break;')
  .replace('for(const [r,n] of style.rows.entries()){','for(const [r,n] of style.rows.entries()){if(index>=chosen.length)break;')
  .replaceAll('space*(n-1)','space*(words.length-1)');
 if(name==='form-captions-renderer')text=text.replace('for(const [col,words]of parts.entries()){','for(const [col,words]of parts.entries()){if(!words.length)continue;');
 // Give Optic Poetry its own final-word line, including short captions.
 if(name==='optic-poetry-renderer')text=text.replace('n>=6?[n-6,1,3,2]:n===5?[1,1,1,2]:n===4?[1,1,0,2]:n===3?[0,1,0,2]','n>=6?[n-6,1,4,1]:n===5?[1,1,2,1]:n===4?[1,1,1,1]:n===3?[0,1,1,1]');
 await writeFile(join(out,name+'.mjs'),text);for(const dep of deps)await copyModule(dep);
}
for(const family of Object.values(families)){await copyModule(family.file);if(family.config)await copyModule(family.config);}
const {readdir}=await import('node:fs/promises');
for(const name of await readdir(input))if(/license/i.test(name))await copyFile(join(input,name),join('frontend/public/studio-library/licenses',name));
const allFonts=name=>{const found=new Map(),seen=new Set();function visit(n){if(seen.has(n))return;seen.add(n);if(fontLoaders.get(n)?.length)found.set(n,fontLoaders.get(n));for(const d of dependencies.get(n)||[])visit(d);}visit(name);return [...found];};
const loaders=[];for(const [key,f]of Object.entries(families))loaders.push(`${JSON.stringify(key)}:async()=>{const [module]=await Promise.all([import('./source/${f.file}.mjs'),${allFonts(f.file).map(([name,fns])=>`import('./source/${name}.mjs').then(m=>Promise.all([${fns.map(fn=>`m.${fn}()`).join(',')}]))`).join(',')}]);return module.${classes.get(f.file)};}`);
await writeFile(resolve(out,'../loaders.mjs'),`// Lazy-load each family and its original embedded fonts.\nexport const loaders={${loaders.join(',\n')}};\n`);
const definitions=[],meta={},entries=[];
function swatches(p){const values=[];function visit(v){if(typeof v==='string'&&/^#[\da-f]{6}$/i.test(v))values.push(v);else if(Array.isArray(v))v.forEach(visit);}Object.values(p).forEach(visit);return [...new Set(values)].slice(0,5);}
for(const item of items){
 const familyKey=titleIds.includes(item.id)?item.id:item.api,f=families[familyKey];if(!f)throw Error('Missing family '+item.api);
 // Config modules contain only source palette/layout data. No renderers are executed.
 const cfg=f.config?await import(pathToFileURL(join(out,f.config+'.mjs'))):{},title=f.mode==='title';
 let variant=item[f.variant]||f.variant||item.id,palettes,span=6,sample;
 if(title){const prefix=Object.keys(cfg).find(k=>k.endsWith('Duration'))?.replace(/Duration$/,'');span=cfg[prefix+'Duration'];sample=cfg[prefix+'Text'];palettes=cfg[prefix+'Palettes'];}
 else if(f.mode==='glass')palettes={reference:{label:'Reference · neutralno'},smoke:{label:'Obsidian · dimljeno'},champagne:{label:'Champagne · toplo'},glacier:{label:'Glacier · hladno'}};
 else if(familyKey==='meadowType')palettes=cfg.MeadowPalettes;
 else {const data=cfg[f.exportName][variant];palettes=data.palettes;sample=data.sentences?.[0];}
 const paletteRows=Object.entries(palettes).map(([value,p])=>({value,label:p.name||p.label||value,colors:swatches(p)}));
 const key='collectionStudio'+item.id.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(''),id='studio-'+item.id;
 const aspect=f.crop?f.crop[2]/f.crop[3]:f.mode==='glass'?1080/520:736/700;
 definitions.push([key,id,item.name,'700 80px Arial',f.words,aspect]);
 meta[id]={family:familyKey,mode:f.mode,variant,palettes:paletteRows,span,words:f.words,crop:f.crop,aspect};
 entries.push({key,id,name:item.name,sample:sample||'Kad promijeniš ritam običan trenutak dobije novi život',family:familyKey});
}
await writeFile(resolve(out,'../catalog.json'),JSON.stringify(meta,null,2));
await writeFile('frontend/src/config/captions/studio-collection.ts',`// Imported original source: studio-titlova (2026-10-05).\nexport const studioDefinitions=${JSON.stringify(definitions)} as const;\nexport const studioMetadata:Record<string,{family:string;mode:string;variant:string;palettes:{value:string;label:string;colors:string[]}[];span:number;words:number;crop:number[]|null;aspect:number}>=${JSON.stringify(meta)};\nexport const studioSamples:Record<string,string>=${JSON.stringify(Object.fromEntries(entries.map(e=>[e.key,e.sample])))};\nexport const isStudioStyle=(style:string)=>style.startsWith('collectionStudio')&&studioDefinitions.some(d=>d[0]===style);\n`);
await writeFile('frontend/public/studio-library/catalog.json',JSON.stringify(entries,null,2));
await writeFile(resolve(out,'../provenance.json'),JSON.stringify({source:'studio-titlova',date:'2026-10-05',styles:items.map(x=>x.id),modules:[...visited]},null,2));
console.log(`Imported source for ${items.length} styles in ${Object.keys(families).length} renderer families. No renderers or tests run.`);
