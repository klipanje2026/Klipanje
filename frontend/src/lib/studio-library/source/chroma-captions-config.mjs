import {AmplifySamples} from './amplify-captions-config.mjs';
export const ChromaSamples=AmplifySamples;
const ceLuma=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const ceContrast=(a,b)=>(Math.max(ceLuma(a),ceLuma(b))+.05)/(Math.min(ceLuma(a),ceLuma(b))+.05);
const ceForeground=(surface,dark,ink)=>{const pick=ceContrast(surface,dark)>ceContrast(surface,ink)?dark:ink;return ceContrast(surface,pick)>=4.5?pick:ceContrast(surface,'#000000')>ceContrast(surface,'#ffffff')?'#000000':'#ffffff';};
const cePalettes=values=>values.map(([name,a,b,dark='#10141b',ink='#fffaf3'])=>({name,a,b,dark,ink,onA:ceForeground(a,dark,ink),onB:ceForeground(b,dark,ink)}));
export const ChromaStyles={
 edge:{name:'EDGECAST',bands:[3,2,3],stack:[],stackRight:[2],weights:[1.68,.77,.86,1.5,.82,.78,.85,1.7],fonts:['saira','text','text','italic','text','text','text','saira'],align:[-1,1,0],texture:'microgrid',palettes:cePalettes([
 ['Signal red / cobalt','#f02e42','#2459f2'],['Electric yellow / black','#ffe100','#252529'],['Ultraviolet / cyan','#7433e6','#00c5f2'],['Cherry / ivory','#c91847','#f0e7d8'],['Forest / acid','#126844','#d4ee14'],['Azure / vermilion','#0063d9','#f14720'],['Hot pink / ink','#e518a2','#272035'],['White / graphite','#f4f4f0','#6d747e']])},
 velvet:{name:'VELVET TYPE',bands:[2,3,3],stack:[1],stackRight:[],weights:[1.64,.78,1.7,.76,.82,.88,1.47,.79],fonts:['italic','text','oswald','text','text','text','italic','text'],align:[1,-1,1],texture:'velvet',palettes:cePalettes([
 ['Oxblood / antique gold','#8d1237','#dfb56a','#1d111c','#fff6e9'],['Bottle green / brass','#174b3c','#c9a04f'],['Aubergine / copper','#4c205b','#df8a52'],['Midnight / silver','#1d2b6b','#d1d9e8'],['Cocoa / saffron','#65321e','#eabb2a'],['Ruby / porcelain','#bd163b','#ece1d3'],['Deep teal / bronze','#006667','#c79b61'],['Plum / champagne','#69174b','#eacfa8']])},
 mono:{name:'MONOBLOCK',bands:[2,3,3],stack:[],stackRight:[1],weights:[1.62,.77,.79,.85,1.65,1.5,.79,.82],fonts:['block','text','text','text','block','italic','text','text'],align:[-1,1,-1],texture:'monograin',palettes:cePalettes([
 ['Chalk / charcoal','#f5f3ee','#42444a','#121316','#ffffff'],['Black / ice','#151a25','#d9e0ec','#080c14','#f8faff'],['Ink / red stamp','#f5f0e8','#be2031'],['Steel / paper','#9da9b6','#fff9ed'],['Indigo / bone','#293273','#e6dbc7'],['Sepia / ivory','#71452f','#f0e3ca'],['Graphite / citron','#4a4f55','#e1ce20'],['White / petrol','#fbf8ee','#115f68']])},
 tidal:{name:'TIDAL INK',bands:[3,3,2],stack:[1],stackRight:[],weights:[1.46,.8,.85,1.65,.77,.85,1.6,.85],fonts:['saira','text','text','saira','text','text','italic','text'],align:[1,-1,0],texture:'contour',palettes:cePalettes([
 ['Petrol / ion cyan','#006a7e','#43ddf6'],['Marine / laser blue','#16437c','#2a9eff'],['Jade / lime light','#126755','#bad331'],['Deep violet / ice blue','#4d36ac','#80cafa'],['Ocean / copper light','#087f83','#e1a473'],['Graphite / cold silver','#384552','#c5d7de'],['Carmine / electric blue','#a42e58','#79b8ff'],['Emerald / warm white','#237c4b','#ede9d9']])},
 pulp:{name:'PULP CUT',bands:[3,2,3],stack:[],stackRight:[0],weights:[.85,.76,1.72,1.57,.79,.8,1.65,.77],fonts:['hand','text','tall','oswald','text','text','tall','text'],align:[-1,1,-1],texture:'newsprint',palettes:cePalettes([
 ['Mustard / ink red','#e0aa19','#ac2c25','#241817','#fff6df'],['Rust / newspaper','#b34723','#eee0c6'],['Cobalt / sunflower','#284fbc','#e4c331'],['Brick / olive','#be3c32','#8f9c31'],['Ochre / teal ink','#c49c3d','#116e74'],['Plum / aged paper','#74296c','#dfcfad'],['Crimson / charcoal','#c92445','#3e414b'],['Black / newsprint','#262523','#e9dec6']])}
};

ChromaStyles.tidal.palettes.push(...cePalettes([["Electric blue / cyan","#0055ff","#00dcff"],["Emerald / acid","#009957","#b6ff00"]]));

ChromaStyles.pulp.palettes.push(...cePalettes([["Cobalt / vivid yellow","#064bff","#ffe000"],["Scarlet / ink","#ff3020","#20232e"]]));

ChromaStyles.edge.palettes.push({...cePalettes([['Bold metal / silver','#2d394c','#8199b7','#10151f','#f5f9ff']])[0],metallic:true});
