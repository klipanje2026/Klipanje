import type {CaptionSettings} from '../config/captions/types';
import type {Input,CanvasSink} from 'mediabunny';
type Mode=NonNullable<CaptionSettings['fillTexture']>;
export const captionTextureGroups:{label:string;items:[Mode,string][]}[]=[{"label": "Boje i staklo", "items": [["gold", "Metallic Gold"], ["silver", "Silver"], ["chrome", "Chrome"], ["neonColor", "Neon Color"], ["duotone", "Duotone"], ["glass", "Glassmorphism"], ["frostedGlass", "Frosted Glass"], ["crystalText", "Crystal Text"], ["transparent", "Transparent Fill"], ["acrylic", "Acrylic Effect"], ["iceGlass", "Ice Glass"]]}, {"label": "Površine", "items": [["pattern", "Uzorak"], ["texture", "Tekstura"], ["matte", "Reljef · mat"], ["metal", "Polirani metal"], ["brushed", "Brušeni metal"], ["satin", "Saten"], ["marble", "Marble"], ["granite", "Granite"], ["stone", "Stone"], ["concrete", "Concrete"], ["brick", "Brick"], ["wood", "Wood"], ["carbon", "Carbon Fiber"], ["leather", "Leather"], ["denim", "Denim"], ["fabric", "Fabric"], ["paper", "Paper"], ["vintagePaper", "Vintage Paper"]]}, {"label": "Priroda", "items": [["water", "Water"], ["ocean", "Ocean"], ["fire", "Fire"], ["lava", "Lava"], ["ice", "Ice"], ["snow", "Snow"], ["smoke", "Smoke"], ["cloud", "Cloud"], ["sand", "Sand"], ["mud", "Mud"], ["moss", "Moss"], ["grass", "Grass"]]}, {"label": "Luksuz", "items": [["luxuryGold", "Luxury Gold"], ["blackGold", "Black Gold"], ["diamond", "Diamond"], ["crystal", "Crystal"], ["pearl", "Pearl"], ["jewel", "Jewel"], ["emerald", "Emerald"], ["sapphire", "Sapphire"], ["ruby", "Ruby"]]}, {"label": "Futuristički", "items": [["hologram", "Hologram"], ["cyberpunk", "Cyberpunk"], ["matrix", "Matrix"], ["rgbSplit", "RGB Split"], ["digitalNoise", "Digital Noise"], ["techGrid", "Tech Grid"], ["scifiMetal", "Sci-Fi Metal"], ["aiGlow", "AI Glow"]]},{"label": "Moderni materijali", "items": [["meshGradient", "Mesh Gradient"], ["liquidGlass", "Liquid Glass"], ["holographicFoil", "Holographic Foil"], ["iridescent", "Iridescent"], ["oilSlick", "Oil Slick"], ["aurora", "Aurora Borealis"], ["chromeGradient", "Chrome Gradient"], ["rgbShift", "RGB Shift"], ["glassNeon", "Glass Neon"], ["liquidMetal", "Liquid Metal"]]}];
captionTextureGroups.unshift({label:'Iz stilova',items:[['prism','Prism · preko osobe'],['goldReference','Golden Texture']]});
export function textureNaturalScale(mode:Mode){return ({digitalNoise:180,water:55,ocean:65,wood:80,granite:60,sand:50,denim:65,fabric:70,grass:55,marble:140,diamond:120} as Partial<Record<Mode,number>>)[mode]??100;}
export const captionTextures:[Mode,string][]=[...captionTextureGroups.flatMap(group=>group.items),["image","Slika"],["video","Video"]];
export const animatedTextureModes=["fire","water","ocean","lava","smoke","hologram","cyberpunk","matrix","rgbSplit","digitalNoise","aiGlow","liquidGlass","holographicFoil","iridescent","oilSlick","aurora","rgbShift","glassNeon","liquidMetal"];
/** Material defaults are separate from the saved text/gradient colors. */
export function captionTextureColors(mode:Mode,textColor:string):[string,string]{
 const palettes:Partial<Record<Mode,[string,string]>>={glass:['#779da9','#f4ffff'],crystal:['#687fac','#eefaff'],gold:['#986014','#fff0a0'],marble:['#73797e','#f7f4eb'],carbon:['#141b22','#69747e'],wood:['#663918','#dfb97a'],fire:['#c82b06','#ffe76e'],water:['#086b9f','#b8f3ff'],metal:['#596774','#f4f8fc'],brushed:['#64717d','#dfe7ed'],stone:['#62645f','#dedbd0']};
 Object.assign(palettes,{"meshGradient": ["#674bdb", "#f4b5a8"], "liquidGlass": ["#799cae", "#efffff"], "holographicFoil": ["#ce93ed", "#92ffff"], "iridescent": ["#dfa1ed", "#b8ffc8"], "oilSlick": ["#102130", "#af70c7"], "aurora": ["#133d63", "#65ffc6"], "chromeGradient": ["#23384a", "#f4fdff"], "rgbShift": ["#fc387a", "#47edff"], "glassNeon": ["#462768", "#a6fcff"], "liquidMetal": ["#364b60", "#e7f5ff"]},{"silver": ["#737b88", "#ffffff"], "chrome": ["#182738", "#f1faff"], "neonColor": ["#981ce4", "#45ffff"], "duotone": ["#532cc4", "#ffba6a"], "frostedGlass": ["#9aacbd", "#f1f8ff"], "crystalText": ["#455d9d", "#edffff"], "transparent": ["#c0dbe6", "#ffffff"], "acrylic": ["#6255ac", "#fac4e9"], "iceGlass": ["#4299b7", "#e2fbff"], "granite": ["#535763", "#d8cbbb"], "concrete": ["#737671", "#d1d0c7"], "brick": ["#792d24", "#d98860"], "leather": ["#2c1711", "#91633b"], "denim": ["#13395d", "#91abc0"], "fabric": ["#71605d", "#dccac2"], "paper": ["#c4c1b6", "#fffdf6"], "vintagePaper": ["#997440", "#efdaa7"], "ocean": ["#053c6b", "#6fe6e6"], "lava": ["#291210", "#ff6c13"], "ice": ["#568eb3", "#edffff"], "snow": ["#b3c6d4", "#ffffff"], "smoke": ["#4a4957", "#c7c2ce"], "cloud": ["#8eabc3", "#ffffff"], "sand": ["#b98c4b", "#f6ddb0"], "mud": ["#3d2c1c", "#9a7650"], "moss": ["#233c12", "#9aaf43"], "grass": ["#155b25", "#a2d748"], "luxuryGold": ["#7a460b", "#fff0b0"], "blackGold": ["#0a0c10", "#e5b552"], "diamond": ["#536e8b", "#ffffff"], "pearl": ["#b1a6b8", "#fff9e3"], "jewel": ["#55287e", "#f2bff4"], "emerald": ["#064e32", "#79ffc3"], "sapphire": ["#112e82", "#79c8ff"], "ruby": ["#780a31", "#ff94a9"], "hologram": ["#ef79ef", "#72ffff"], "cyberpunk": ["#c40b90", "#39efff"], "matrix": ["#02180b", "#52ff74"], "rgbSplit": ["#ff2462", "#26e5ff"], "digitalNoise": ["#20323a", "#b6e4d5"], "techGrid": ["#073c53", "#46e6ed"], "scifiMetal": ["#293b54", "#b5d9eb"], "aiGlow": ["#6e44f5", "#8ffff1"]});
 return (mode==='goldReference'?['#ffbc38','#ffdd54'] as [string,string]:palettes[mode])??[textColor,'#ffffff'];
}
type Media={image?:HTMLImageElement;input?:Input;sink?:CanvasSink;canvas?:HTMLCanvasElement;duration:number;time?:number;pending?:Promise<void>;ready:Promise<void>};
const media=new Map<string,Media>(),tiles=new Map<string,HTMLCanvasElement>();
let revision=0;
export const textureFillRevision=()=>revision;
function source(s:CaptionSettings){
 const url=s.fillTextureUrl;if(!url||!['image','video'].includes(s.fillTexture||''))return;
 const key=s.fillTexture+':'+url;let item=media.get(key);if(item)return item;
 item={duration:0,ready:Promise.resolve()};media.set(key,item);const entry=item;
 entry.ready=(async()=>{
  if(s.fillTexture==='image'){
   const image=new Image();image.crossOrigin='anonymous';image.src=url;await image.decode();entry.image=image;
  }else{
   const response=await fetch(url);if(!response.ok)throw new Error('Video ispuna nije dostupna.');
   const m=await import('mediabunny'),input=new m.Input({source:new m.BlobSource(await response.blob()),formats:m.ALL_FORMATS});entry.input=input;
   const track=await input.getPrimaryVideoTrack();if(!track||!await track.canDecode())throw new Error('Format video ispune nije podržan.');
   entry.duration=await input.computeDuration();entry.sink=new m.CanvasSink(track,{poolSize:1});entry.canvas=document.createElement('canvas');
  }revision++;
 })();void entry.ready.catch(()=>{});return entry;
}
export async function prepareTextureFill(s:CaptionSettings,time=0){
 const entry=source(s);if(!entry)return;await entry.ready;
 if(!entry.sink||!entry.canvas)return;
 if(entry.pending)await entry.pending;
 const target=Math.max(0,time)%Math.max(.001,entry.duration);if(entry.time===target)return;
 entry.pending=(async()=>{const frame=await entry.sink!.getCanvas(target);if(!frame)throw new Error('Kadar video ispune nije dostupan.');const c=entry.canvas!;c.width=frame.canvas.width;c.height=frame.canvas.height;c.getContext('2d')!.drawImage(frame.canvas,0,0);entry.time=target;revision++;})();
 try{await entry.pending;}finally{entry.pending=undefined;}
}
export function collectTextureFills(value:unknown):CaptionSettings[]{
 const result=new Map<string,CaptionSettings>();
 function visit(v:unknown){if(!v||typeof v!=='object')return;const s=v as CaptionSettings;if(s.fillTextureUrl&&['image','video'].includes(s.fillTexture||''))result.set(s.fillTexture+':'+s.fillTextureUrl,s);for(const child of Object.values(v))visit(child);}
 visit(value);return [...result.values()];
}
/** A repeating material tile, used by the shared glyph fill in previews and export. */
export function captionTextureFill(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,s:CaptionSettings,time:number):CanvasPattern|undefined{
 const mode=s.fillTexture;if(mode==='goldReference'||mode==='prism')return;if(!mode||mode==='none'||typeof document==='undefined')return;
 const metric=ctx.measureText(text),left=x-(ctx.textAlign==='center'?metric.width/2:['right','end'].includes(ctx.textAlign)?metric.width:0),top=y-metric.actualBoundingBoxAscent;
 if(mode==='image'||mode==='video'){
  const entry=source(s);if(!entry)return;void prepareTextureFill(s,time).catch(()=>{});
  const frame=entry.image||entry.canvas;if(!frame||!frame.width||!frame.height)return;
  const pattern=ctx.createPattern(frame,'no-repeat');if(!pattern)return;
  const w=Math.max(1,metric.width),h=Math.max(1,metric.actualBoundingBoxAscent+metric.actualBoundingBoxDescent),scale=Math.max(w/frame.width,h/frame.height);
  pattern.setTransform(new DOMMatrix().translate(left+(w-frame.width*scale)/2,top+(h-frame.height*scale)/2).scale(scale));return pattern;
 }
 const animated=animatedTextureModes.includes(mode),phase=animated?Math.floor(time*Math.max(.1,Math.min(3,s.textureSpeed??1))*15)/15:0,palette=captionTextureColors(mode,s.textColor),color=s.fillTextureColor||palette[0],secondColor=s.fillTextureColor2||palette[1];
 const key=JSON.stringify([mode,color,secondColor,phase,s.textureDetail,s.textureAmount,s.textColor]);let tile=tiles.get(key);
 if(!tile){
  tile=document.createElement('canvas');tile.width=128;tile.height=128;const c=tile.getContext('2d')!;
  c.fillStyle=color;c.fillRect(0,0,128,128);const rgb=c.getImageData(0,0,1,1).data;c.fillStyle=secondColor;c.fillRect(0,0,1,1);const rgb2=c.getImageData(0,0,1,1).data;c.fillStyle=s.textColor;c.fillRect(0,0,1,1);const base=c.getImageData(0,0,1,1).data,pixels=c.createImageData(128,128);
  for(let j=0;j<128;j++)for(let i=0;i<128;i++){
   const u=i/128,v=j/128,noise=(Math.sin(i*127.1+j*311.7)*43758.5453)%1;
   let brightness=1,r=rgb[0],g=rgb[1],b=rgb[2];
   const detail=Math.max(0,Math.min(100,s.textureDetail??50))/100;
   switch(mode){
    case 'silver':brightness=.35+Math.abs(Math.sin(v*9))*.95;break;
    case 'chrome':brightness=.22+Math.pow(Math.abs(Math.sin(v*12+u*.8)),.22)*1.1;break;
    case 'neonColor':brightness=.55+.65*Math.pow(Math.sin(u*4+v*3),2);break;
    case 'duotone':brightness=u+v>.95?1.45:.25;break;
    case 'frostedGlass':brightness=.95+noise*.2+Math.sin(u*5+v*4)*.16;break;
    case 'crystalText':brightness=.3+Math.abs(Math.sin(Math.floor(u*9)*3+Math.floor(v*5)*2));break;
    case 'transparent':brightness=1.15;break;
    case 'acrylic':brightness=.45+.85*Math.pow(Math.abs(Math.sin(u*5+v*6)),4);break;
    case 'iceGlass':case 'ice':brightness=.8+Math.sin(u*25+Math.sin(v*9)*3)*.15+(Math.abs(Math.sin(u*13+v*17))>.98?.45:0);break;
    case 'granite':brightness=.55+Math.abs(noise)*.8+(Math.sin(i*3+j*7)>.9?.35:0);break;
    case 'concrete':brightness=.85+noise*.16+Math.sin(u*9)*Math.sin(v*11)*.1;break;
    case 'brick':{const row=Math.floor(v*5),tx=(u*3+(row%2)*.5)%1;brightness=(v*5%1<.08||tx<.04)?1.35:.7+noise*.15;break;}
    case 'leather':brightness=.55+.3*Math.abs(Math.sin(i*.5)*Math.sin(j*.45))+noise*.1;break;
    case 'denim':brightness=.55+.6*((i+j*2)%7<3?1:0)+noise*.08;break;
    case 'fabric':brightness=.65+.22*Math.sin(i*2)+.22*Math.cos(j*2);break;
    case 'paper':brightness=1.1+noise*.1+Math.sin(j*.6)*.035;break;
    case 'vintagePaper':brightness=.9+noise*.17-.2*Math.sin(u*9)*Math.cos(v*8);break;
    case 'ocean':brightness=.5+.8*Math.pow(Math.abs(Math.sin(u*14+v*21+phase*2+Math.sin(u*7-phase))),6);break;
    case 'lava':brightness=.25+1.2*Math.pow(Math.abs(Math.sin(u*13+Math.sin(v*10+phase)+phase*.3)),30-detail*28);break;
    case 'snow':brightness=1.1+noise*.2+(Math.sin(i*2+j*3)>.97?.3:0);break;
    case 'smoke':brightness=.7+.45*Math.sin(u*6+phase+Math.sin(v*8-phase*.7));break;
    case 'cloud':brightness=.8+.4*Math.sin(u*7+Math.sin(v*6))*Math.cos(v*5);break;
    case 'sand':brightness=.95+noise*.25+Math.sin(v*25+u*7)*.1;break;
    case 'mud':brightness=.45+.3*Math.sin(u*11+Math.sin(v*14))+noise*.2;break;
    case 'moss':brightness=.6+Math.abs(noise)*.65+Math.sin(u*30)*Math.cos(v*27)*.2;break;
    case 'grass':brightness=.6+.55*Math.abs(Math.sin(u*80+Math.sin(v*4)*5))+noise*.1;break;
    case 'luxuryGold':brightness=.4+.9*Math.pow(Math.abs(Math.sin(v*9+u*2)),.5)+noise*.08;break;
    case 'blackGold':brightness=Math.abs(Math.sin(u*12+v*9+Math.sin(v*16)))>.97?1.4:.26+noise*.03;break;
    case 'diamond':brightness=.3+1.1*Math.abs(Math.sin(Math.floor(u*8)*7+Math.floor(v*8)*11))+(Math.sin(u*40+v*40)>.98?.3:0);break;
    case 'pearl':brightness=1+.25*Math.sin(u*5+v*3)+noise*.025;break;
    case 'jewel':brightness=.3+1.05*Math.abs(Math.sin(Math.floor(u*5+v*2)*5+Math.floor(v*6)*3));break;
    case 'emerald':brightness=.3+1.05*Math.abs(Math.sin(Math.floor((u+v)*7)*2+Math.floor((u-v)*9)*4));break;
    case 'sapphire':brightness=.3+.9*Math.abs(Math.cos(Math.atan2(v-.5,u-.5)*8))+Math.hypot(u-.5,v-.5)*.25;break;
    case 'ruby':brightness=.3+1.05*Math.abs(Math.sin(Math.floor(u*7)*3+Math.floor(v*4+u*2)*5));break;
    case 'meshGradient':brightness=.75+.5*Math.sin(u*4+Math.sin(v*6))*Math.cos(v*3-u*2);break;
    case 'liquidGlass':brightness=.5+.8*Math.pow(Math.abs(Math.sin(u*7+Math.sin(v*8+phase)*2)),8);break;
    case 'holographicFoil':brightness=.7+.6*Math.sin(u*16+v*10+Math.sin(v*22)+phase);break;
    case 'iridescent':brightness=.8+.55*Math.sin(u*5+v*7+phase*.6);break;
    case 'oilSlick':brightness=.35+.9*Math.pow(Math.abs(Math.sin(u*11+Math.sin(v*8+phase*.4)*3)),4);break;
    case 'aurora':brightness=.4+.95*Math.pow(Math.abs(Math.sin(u*8+Math.sin(v*6+phase)*2)),3)*(1-v*.45);break;
    case 'chromeGradient':brightness=.25+1.1*Math.pow(Math.abs(Math.sin((u+v)*8)),.35);break;
    case 'rgbShift':brightness=.75+.65*Math.sin(u*19+phase*2);break;
    case 'glassNeon':brightness=.3+1.15*Math.pow(Math.abs(Math.sin(u*7+v*6+phase)),14);break;
    case 'liquidMetal':brightness=.3+1.1*Math.pow(Math.abs(Math.sin(v*9+Math.sin(u*8+phase)*2)),.4);break;
    case 'hologram':brightness=.7+.65*Math.sin((u+v)*8+phase);break;
    case 'cyberpunk':brightness=.4+.95*(Math.sin(v*50+phase*4)>.6?1:.15)+.18*Math.sin(u*12);break;
    case 'matrix':brightness=((Math.floor(u*16)*13+Math.floor(v*16+phase*3)*7)%11<3)?1.4:.25;break;
    case 'rgbSplit':brightness=.8+.6*Math.sin(u*22+phase*2);break;
    case 'digitalNoise':brightness=.25+Math.abs(Math.sin(Math.floor(i/4)*127+Math.floor(j/3)*39+Math.floor(phase*8))*437.7)%1*1.2;break;
    case 'techGrid':brightness=(i%24<2||j%24<2)?1.4:.3+noise*.03;break;
    case 'scifiMetal':brightness=.4+.65*Math.abs(Math.sin(v*7))+(i%32<2||j%32<2?.3:0);break;
    case 'aiGlow':brightness=.45+.95*Math.pow(Math.abs(Math.sin(u*8+v*6+phase)),3);break;
    case 'matte':brightness=.85+noise*.07;break;
    case 'metal':brightness=.3+1.1*Math.abs(Math.sin(v*8+u*2));break;
    case 'brushed':brightness=.65+.25*Math.sin(j*5)+noise*.12;break;
    case 'stone':brightness=.5+Math.abs(noise)*.6+Math.sin(u*45)*Math.sin(v*37)*.15;break;
    case 'satin':brightness=.55+.55*Math.sin(u*8+Math.sin(v*7)*2);break;
    case 'pattern':brightness=(Math.floor(i/16)+Math.floor(j/16))%2?.45:1.2;break;
    case 'texture':brightness=.7+Math.abs(noise)*.6;break;
    case 'glass':brightness=.45+1.2*Math.pow(Math.max(0,Math.sin((u+v)*Math.PI*2)),12);break;
    case 'crystal':brightness=.5+Math.abs(Math.sin(Math.floor(u*6)*2+Math.floor(v*6)*3))*.9;break;
    case 'gold':r=230;g=174;b=45;brightness=.5+.7*Math.abs(Math.sin(v*12+u*2))+.12*noise;break;
    case 'marble':r=232;g=230;b=222;brightness=1-.65*Math.pow(Math.abs(Math.sin(u*12+v*8+Math.sin(v*15)*2)),22);break;
    case 'carbon':r=75;g=80;b=86;brightness=.35+.65*((Math.floor(i/8)+Math.floor(j/8))%2?i%8:j%8)/8;break;
    case 'wood':r=175;g=108;b=53;brightness=.6+.4*Math.sin(v*75+Math.sin(u*9)*3)+noise*.1;break;
    case 'fire':{const heat=Math.max(0,Math.min(1,.7-v*.5+.3*Math.sin(u*19+phase*3+Math.sin(v*12-phase*4))));r=255;g=heat*210;b=heat*heat*65;brightness=.55+heat*.65;break;}
    case 'water':r=35;g=152;b=211;brightness=.7+.5*Math.pow(Math.sin(u*19+v*12+phase*2)*Math.sin(v*21-u*8-phase),2);break;
   }
   {const mix=Math.max(0,Math.min(1,(brightness-.25)/1.3));r=rgb[0]*(1-mix)+rgb2[0]*mix;g=rgb[1]*(1-mix)+rgb2[1]*mix;b=rgb[2]*(1-mix)+rgb2[2]*mix;brightness=1;}
   if(mode==='rgbSplit'&&!s.fillTextureColor&&!s.fillTextureColor2){const channel=((Math.floor(u*9+phase)%3)+3)%3;r=channel===0?255:35;g=channel===1?255:45;b=channel===2?255:90;}
   const amount=Math.max(0,Math.min(100,s.textureAmount??100))/100;r=base[0]*(1-amount)+r*amount;g=base[1]*(1-amount)+g*amount;b=base[2]*(1-amount)+b*amount;
   const k=(j*128+i)*4;pixels.data[k]=r*brightness;pixels.data[k+1]=g*brightness;pixels.data[k+2]=b*brightness;pixels.data[k+3]=mode==='transparent'?70:mode==='glass'?190:mode==='frostedGlass'?225:mode==='acrylic'?210:mode==='iceGlass'?195:255;
  }c.putImageData(pixels,0,0);tiles.set(key,tile);if(tiles.size>24)tiles.delete(tiles.keys().next().value!);
 }
 const pattern=ctx.createPattern(tile,'repeat');if(!pattern)return;const scale=size/128*Math.max(.1,Math.min(4,(s.fillTextureScale??textureNaturalScale(mode))/100));pattern.setTransform(new DOMMatrix().translate(left,top).scale(scale));return pattern;
}
