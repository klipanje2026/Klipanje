/** Adapt the supplied art source; never execute demo render/export loops. */
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const input=resolve('work/imports/motion-pack-02'),out=resolve('frontend/src/lib/motion-pack'),assets=resolve('frontend/public/caption-motion');
await mkdir(out,{recursive:true});await mkdir(assets,{recursive:true});
const read=name=>readFile(join(input,name),'utf8');
const emit=(name,value)=>writeFile(join(out,name),value);
await cp(join(input,'three-title-lab/vendor'),join(out,'vendor'),{recursive:true});
await cp(join(input,'three-title-lab/assets'),join(assets,'assets'),{recursive:true});
await cp(join(input,'palete/PALETE.json'),join(out,'palettes.json'));
await cp(join(input,'palete'),join(assets,'palettes'),{recursive:true});
await cp(join(input,'three-title-lab/assets/edita-studio-sans.typeface.json'),join(out,'font.json'));
for(const name of ['environments/RoomEnvironment','geometries/TextGeometry','loaders/FontLoader']){
 const p=join(out,'vendor/examples/jsm',name+'.js');
 await writeFile(p,(await readFile(p,'utf8')).replaceAll("from 'three'","from '../../../build/three.module.js'"));
}
let three=await read('three-title-lab/effects.js');
three=three.replace("from 'three'","from './vendor/build/three.module.js'").replaceAll("from 'three/addons/","from './vendor/examples/jsm/").replace("'./palettes.js'","'./title-palettes.mjs'");
three=three.replace('class TitleEffect{','export class TitleEffect{').replace('this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5))','this.renderer.setPixelRatio(1)');
// Retain one renderer/environment while replacing only text geometry.
const begin=three.indexOf('  let maximum=0,index=0;'),end=three.indexOf('\n resize(width,height)',begin);
let geometry=three.slice(begin,end);
geometry=geometry.replace('this.setPalette(this.colors);this.resize(width,height);','');
geometry=geometry.slice(0,geometry.lastIndexOf('\n }'));
three=three.slice(0,begin)+`  this.font=font;this.setLines(lines);this.setPalette(this.colors);this.resize(width,height);
 }
 setLines(lines){
  const font=this.font,style=this.style;
  const old=new Set();this.root.traverse(o=>{if(o.geometry)old.add(o.geometry);});for(const g of old)g.dispose();this.root.clear();this.glyphs=[];
${geometry}
 }
`+three.slice(end);
await emit('title-effects.mjs',three);await emit('title-palettes.mjs',await read('three-title-lab/palettes.js'));

let captions=await read('Edita-Motion-Pack/src/captions.mjs');
captions=captions.replace("height=506){","height=506,lines=['',''],backdrop=false){").replace('bg(c);','if(backdrop)bg(c);');
captions=captions.replace("segment===0?'MANJE':'VIŠE'","lines[0]").replace("segment===0?'OBEĆANJA.':'REZULTATA.'","lines[1]");
captions=captions.replace("segment===0?'ODLUKE DANAS.':'POVJERENJE SE'","lines[0]").replace("segment===0?'OBLIKUJU SUTRA.':'GRADI DJELIMA.'","lines[1]");
// Fit arbitrary user words without changing the original sizes for short phrases.
captions=captions.replace('const segment=Math.floor((t%6.4)/3.2),local=', 'const local=').replace('const topSize=segment===0?43:40','const topSize=Math.min(43,740/Math.max(1,lineWidth(c,top,43,2.4))*43)');
captions=captions.replace("const first=lines[0],second=lines[1];","const first=lines[0],second=lines[1];const heroSize=Math.min(79,740/Math.max(1,lineWidth(c,second,79,1.027))*79);");
captions=captions.replace("293,79,local","293,heroSize,local").replace('second,79,1.027','second,heroSize,heroSize*.013');
// The fitting expression itself must use the original base size.
captions=captions.replace('740/Math.max(1,lineWidth(c,second,heroSize,heroSize*.013))*79','740/Math.max(1,lineWidth(c,second,79,1.027))*79');
captions=captions.replace('const sw=lineWidth(c,second,79,1.027)','const sw=lineWidth(c,second,heroSize,heroSize*.013)');
captions=captions.replace('const plaque=ease((local-.03)/.42),fw=lineWidth(c,first,38,5);','const firstSize=Math.min(38,700/Math.max(1,lineWidth(c,first,38,5))*38),plaque=first?ease((local-.03)/.42):0,fw=lineWidth(c,first,firstSize,5);').replace("13,38,5,'#d3dae0'","13,firstSize,5,'#d3dae0'");
captions=captions.replace('const size=61,track=.8','const size=Math.min(61,740/Math.max(1,lineWidth(c,bottom,61,.8))*61),track=.8');
await emit('captions.mjs',captions);

for(const [file,id,span] of [['strata','strata',3.6],['contour-recoil','contour',3.8],['mosaic','mosaic',7.2],['elements','elements',7.2]]){
 let src=await read(`Edita-Motion-Pack/src/${file}.mjs`);
 src=src.replace(/^import .*;\r?\n/gm,'');
 src=src.slice(0,src.indexOf(file==='elements'?'const requested=':'await mkdir('));
 src=src.replace(/canvas=createCanvas\(W,H\),c=canvas.getContext\('2d'\)/,"canvas=makeCanvas(W,H),c=paletteContext(canvas.getContext('2d'),options.colors)");
 if(id==='strata'||id==='contour'){
  const a=src.indexOf('function contours('),b=src.indexOf(id==='strata'?'const scenes=':'function row(',a);
  src=src.slice(0,a)+`function glyph(ch,size){return outlineGlyph(ch,size,${id==='strata'?"'Impact, Barlow Condensed, sans-serif',.395":"'Arial, sans-serif',.35"});}\n`+src.slice(b);
  if(id==='strata'){
   const a=src.indexOf('const scenes='),b=src.indexOf('\nfunction rot(',a);
   src=src.slice(0,a)+`let scenes=[];
function setWords(words){const word=(words.at(-1)||'').toLocaleUpperCase('bs'),top=words.slice(0,-1).join(' ').toLocaleUpperCase('bs');let size=169,gs=[...word].map(ch=>glyph(ch,size));const width=gs.reduce((s,g)=>s+g.width+11,0);if(width>740){size*=740/width;gs=[...word].map(ch=>glyph(ch,size));}scenes=[{word,top,size,glyphs:gs}];}
`+src.slice(b);
  }else{
   const a=src.indexOf('const scenes='),b=src.indexOf('\nfunction rotate(',a);
   src=src.slice(0,a)+`let scenes=[];
function setWords(words){const lines=splitLines(words),fit=(word,size)=>{const width=[...word].reduce((s,ch)=>s+glyph(ch,size).width+9,0);return size*Math.min(1,740/Math.max(1,width));};scenes=[[...row(lines[0],fit(lines[0],106),-69),...row(lines[1],fit(lines[1],153),64).map(v=>({...v,i:v.i+lines[0].length}))]];}
`+src.slice(b);
  }
  src=src.replace(/scene=scenes\[Math.floor\(t\/[\d.]+\)%2\]/,'scene=scenes[0]');
  if(id==='strata')src=src.replace('143+(1-ease(local/.8))*20);','143+(1-ease(local/.8))*20,760);');
 }
 if(id==='mosaic'){
  const a=src.indexOf("c.fillStyle='white'"),b=src.indexOf('\nfunction rot(',a);
  let mask=src.slice(a,b).replace("c.fillText('IZVAN',450,224)","c.fillText(lines[0],450,224,740)").replace("c.fillText('OKVIRA.',450,345)","c.fillText(lines[1],450,345,740)").replace('mask=c.getImageData(0,0,W,H).data,tiles=[]','mask=c.getImageData(0,0,W,H).data');
  mask=mask.replace('let y=110;y<360','let y=50;y<400').replace('let x=170;x<740','let x=50;x<850');
  src=src.slice(0,a)+`let tiles=[];function setWords(words){const lines=splitLines(words);c.clearRect(0,0,W,H);tiles=[];${mask};c.clearRect(0,0,W,H);}\n`+src.slice(b);
  src=src.replace('c.fillStyle=`rgb(${s.val},${s.val+1},${s.val-3})`;',`const amount=clamp((s.val-179)/59),a=options.deltas?.font1||[0,0,0],b=options.deltas?.font2||[0,0,0],d=options.deltas?.font3||[0,0,0],shade=[s.val,s.val+1,s.val-3].map((n,i)=>n+(amount<.8?a[i]+(b[i]-a[i])*amount/.8:b[i]+(d[i]-b[i])*(amount-.8)/.2));c.fillStyle='rgb('+shade.join(',')+')';`);
 }
 if(id!=='elements')src=src.replace('c.fillStyle=bg;c.fillRect(0,0,W,H);','if(options.backdrop){c.fillStyle=bg;c.fillRect(0,0,W,H);}');
 else{
  src=src.replace("c.fillText(word,400,275)","c.fillText(word,400,275,700)").replace('let x=200;x<620','let x=50;x<750').replace("'bold 158px Impact'",`'bold 158px Impact, "Barlow Condensed", sans-serif'`);
  src=src.replace('im.data.set(background);','if(options.backdrop)im.data.set(background);');
  src=src.replace('data[p]=mix(data[p],rr,alpha);data[p+1]=mix(data[p+1],gg,alpha);data[p+2]=mix(data[p+2],bb,alpha);',`if(options.backdrop){data[p]=mix(data[p],rr,alpha);data[p+1]=mix(data[p+1],gg,alpha);data[p+2]=mix(data[p+2],bb,alpha);}else{data[p]=rr;data[p+1]=gg;data[p+2]=bb;data[p+3]=255*alpha;}`);
  // Palette deltas preserve the reference shader exactly at its default colors.
  src=src.replace('const subtle=(tex[k]-.5)*16;',`const dc=options.deltas||{},baseTint=dc.surface||[0,0,0],rimTint=dc.rim||[0,0,0],shineTint=dc.specular||[0,0,0];rr+=baseTint[0]*(1-rim)+rimTint[0]*rim+shineTint[0]*(spec+spec2);gg+=baseTint[1]*(1-rim)+rimTint[1]*rim+shineTint[1]*(spec+spec2);bb+=baseTint[2]*(1-rim)+rimTint[2]*rim+shineTint[2]*(spec+spec2);const subtle=(tex[k]-.5)*16;`);
  src=src.replace('rr+=fl*10;gg+=fl*3;',`rr+=fl*10;gg+=fl*3;const dc=options.deltas||{},crustTint=dc.crust||[0,0,0],hotTint=dc.hot||[0,0,0],hottestTint=dc.hottest||[0,0,0],heat=melt**3;rr+=crustTint[0]*(1-melt)+hotTint[0]*melt*(1-heat)+hottestTint[0]*heat;gg+=crustTint[1]*(1-melt)+hotTint[1]*melt*(1-heat)+hottestTint[1]*heat;bb+=crustTint[2]*(1-melt)+hotTint[2]*melt*(1-heat)+hottestTint[2]*heat;`);
  src=src.replace('background[k*4+3]=255;',`background[k*4+3]=255;const a=options.deltas?.background1||[0,0,0],b=options.deltas?.background2||[0,0,0];for(let ch=0;ch<3;ch++)background[k*4+ch]+=a[ch]*(1-v)+b[ch]*v;`);
  src+=`\nlet shape;function setWords(words){shape=makeShape(words.join(' ').toLocaleUpperCase('bs'));}\nfunction render(t){liquidFrame(t,options.element||'water',shape);}`;
 }
 await emit(id+'.mjs',`import {makeCanvas,paletteContext,outlineGlyph,splitLines} from './helpers.mjs';
export function createArtwork(options={}){
${src}
return {canvas,aspect:W/H,span:${span},setWords,render(t){c.clearRect(0,0,W,H);render(t);},dispose(){canvas.width=canvas.height=1;}};
}
`);
}
