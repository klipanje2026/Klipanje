import type {Overlay,OverlayPreset} from './video-overlays';
export const textFonts=[{name:'Manrope',value:'"Manrope Variable",sans-serif'},{name:'Inter',value:'"Inter Variable", sans-serif'},{name:'Montserrat',value:'"Montserrat Variable", sans-serif'},{name:'Oswald',value:'"Oswald Variable", sans-serif'},{name:'Playfair Display',value:'"Playfair Display Variable", serif'},{name:'Roboto Slab',value:'"Roboto Slab Variable", serif'},{name:'Raleway',value:'"Raleway Variable", sans-serif'},{name:'Nunito',value:'"Nunito Variable", sans-serif'},{name:'Caveat',value:'"Caveat Variable", cursive'},{name:'Arial',value:'Arial,sans-serif'},{name:'Georgia',value:'Georgia,serif'},{name:'Impact',value:'Impact,sans-serif'},{name:'Courier',value:'"Courier New",monospace'}];
export const textStyleDefaults:Partial<Overlay>={animation:'fade',animationDuration:.6,color:'#ffffff',background:'transparent',fontFamily:textFonts[0].value,bold:true,italic:false,underline:false,uppercase:false,align:'center',lineHeight:1.2,strokeColor:'#171717',strokeWidth:0,shadowColor:'#171717',shadowBlur:0,shadowOffset:0,glow:false,letterSpacing:0,verticalAlign:'middle',verticalText:false,backgroundOpacity:100,shadowOpacity:100,shadowAngle:45};
export const basicText:OverlayPreset[]=[{id:'heading',category:'Basic',name:'Add heading',symbol:'Heading',value:{...textStyleDefaults,kind:'text',text:'Tvoj naslov',fontSize:72,width:70,height:24}},{id:'body',category:'Basic',name:'Add body text',symbol:'Body text',value:{...textStyleDefaults,kind:'text',text:'Ovdje napiši svoju priču.',bold:false,fontSize:36,width:70,height:24}}];
const effect=(id:string,name:string,category:string,value:Partial<Overlay>):OverlayPreset=>({id,category,name,symbol:'ART',value:{...textStyleDefaults,kind:'text',text:'Tvoj tekst',fontSize:80,width:70,height:26,...value}});
export const textEffects:OverlayPreset[]=[
 effect('outline','Kontura','Classic',{strokeColor:'#151515',strokeWidth:7}),
 effect('block','Blok','Classic',{animation:'slide',fontFamily:'"Oswald Variable",sans-serif',strokeWidth:3,shadowOffset:6,shadowColor:'#7256cc'}),
 effect('editorial','Elegant','Classic',{fontFamily:'"Playfair Display Variable",serif',italic:true,color:'#f4e1b8'}),
 effect('mono','Pisaća mašina','Classic',{fontFamily:'"Courier New",monospace',bold:false,color:'#f4e8d2'}),
 effect('neon','Neon cyan','Neon',{color:'#b7ffff',glow:true,shadowColor:'#00d9ff',shadowBlur:25}),
 effect('pink','Neon pink','Neon',{color:'#ffe0fa',glow:true,shadowColor:'#fa39c4',shadowBlur:25}),
 effect('lime','Neon lime','Neon',{color:'#efffc9',glow:true,shadowColor:'#a2ef37',shadowBlur:20}),
 effect('candy','Candy','Playful',{color:'#ffafce',strokeWidth:3,strokeColor:'#fff4fa',shadowOffset:4,shadowColor:'#9a3262'}),
 effect('comic','Strip','Playful',{animation:'pop',fontFamily:'"Oswald Variable",sans-serif',color:'#ffe258',strokeWidth:5,shadowOffset:5,uppercase:true}),
 effect('ice','Led','Playful',{color:'#bcf4ff',strokeColor:'#3286ad',strokeWidth:3,shadowOffset:3,shadowColor:'#e0fbff'}),
];
export const textTemplates:OverlayPreset[]=[
 {id:'handwritten',category:'Naslovi',name:'Rukopis',symbol:'Moja priča',value:{...textStyleDefaults,kind:'text',text:'Moja priča',fontFamily:'"Caveat Variable",cursive',animation:'typewriter',animationDuration:1.2,fontSize:100,height:30,color:'#ffdcac'}},
 {id:'modern',category:'Naslovi',name:'Moderni naslov',symbol:'TVOJ TRENUTAK',value:{...textStyleDefaults,kind:'text',text:'TVOJ TRENUTAK',fontFamily:'"Montserrat Variable",sans-serif',animation:'rise',fontSize:68,height:24}},
 {id:'friendly',category:'Oznake',name:'Poruka',symbol:'Hej, zdravo!',value:{...textStyleDefaults,kind:'text',text:'Hej, zdravo!',fontFamily:'"Nunito Variable",sans-serif',fontSize:64,height:22,background:'#285c64'}},

 {id:'intro',category:'Naslovi',name:'Intro',symbol:'MOJA PRIČA',value:{...textStyleDefaults,kind:'text',text:'MOJA PRIČA',fontSize:80,uppercase:true,strokeWidth:2,height:24}},
 {id:'quote',category:'Naslovi',name:'Citat',symbol:'“Tvoja priča”',value:{...textStyleDefaults,kind:'text',text:'“Sve počinje jednom idejom.”',fontFamily:'"Playfair Display Variable",serif',italic:true,fontSize:50,height:30}},
 {id:'chapter',category:'Naslovi',name:'Poglavlje',symbol:'01 / POČETAK',value:{...textStyleDefaults,kind:'text',text:'01 / POČETAK',fontSize:56,background:'#202029',width:65,height:20}},
 {id:'podcast',category:'Naslovi',name:'Podcast',symbol:'NOVA EPIZODA',value:{...textStyleDefaults,kind:'text',text:'NOVA EPIZODA',fontSize:64,color:'#d7fa52',fontFamily:'"Oswald Variable",sans-serif',height:22}},
 {id:'lower',category:'Oznake',name:'Ime i zanimanje',symbol:'IME / ZANIMANJE',value:{...textStyleDefaults,kind:'text',text:'IME PREZIME\nTvoje zanimanje',fontSize:40,background:'#202029',align:'left',width:60,height:24,y:78}},
 {id:'follow',category:'Oznake',name:'Prati me',symbol:'PRATI ZA VIŠE',value:{...textStyleDefaults,kind:'text',text:'PRATI ZA VIŠE',fontSize:52,background:'#7452c7',width:60,height:16,y:76}},
 {id:'promo',category:'Oznake',name:'Akcija',symbol:'−20% DANAS',value:{...textStyleDefaults,kind:'text',text:'−20%\nSAMO DANAS',fontSize:68,background:'#e74b65',width:45,height:32}},
 {id:'tip',category:'Oznake',name:'Savjet',symbol:'DOBRO JE ZNATI',value:{...textStyleDefaults,kind:'text',text:'DOBRO JE ZNATI',fontSize:48,background:'#d7fa52',color:'#172130',width:70,height:18}},
];
export function applyTextEffect(item:Overlay,preset:OverlayPreset):Overlay {
 const {fontSize: _size,width: _width,height: _height,text: _text,kind: _kind,...style}=preset.value;
 void _size;void _width;void _height;void _text;void _kind;
 return {...item,...style,shadowDistance:style.shadowDistance??Math.SQRT2*(style.shadowOffset||0)};
}
