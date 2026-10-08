import {AmplifySamples} from './amplify-captions-config.mjs';
export const KineticSamples=AmplifySamples;
const klPalettes=values=>values.map(([name,a,b,dark='#202432',ink='#fff8ec'])=>({name,a,b,dark,ink}));
export const KineticStyles={
 anchor:{name:'BIG LITTLE',bands:[3,2,3],stack:[0],weights:[1.65,.78,.88,.82,1.46,.76,1.42,.8],fonts:['barlow','text','text','text','italic','text','barlow','text'],align:[-1,1,0],texture:'satin',palettes:klPalettes([['Coral & butter','#ff9c84','#f4dc86'],['Mint & blue','#9ce8c9','#a7d1ff'],['Lilac & apricot','#c5a2fc','#ffc49d'],['Honey & sea','#f3cc76','#9ddeca']])},
 offset:{name:'SIDEQUEST',bands:[2,2,2,2],stack:[],weights:[.82,1.47,1.6,.86,.8,1.45,.86,1.58],fonts:['text','italic','oswald','text','text','italic','text','oswald'],align:[-1,1,-1,1],texture:'halftone',palettes:klPalettes([['Acid & violet','#ddf187','#c2a3f7'],['Peach & azure','#ffb08f','#9bd8f2'],['Pink & pistachio','#ffa6cd','#d5e19a'],['Ice & papaya','#94e4de','#ffc080']])},
 orbit:{name:'SOFT ORBIT',bands:[3,2,3],stack:[],weights:[1.35,.78,1.0,.8,1.6,.85,1.37,.83],fonts:['text','text','text','text','text','text','italic','text'],align:[0,-1,1],texture:'satin',palettes:klPalettes([['Iris & rose','#bcafff','#ffbadb','#252333'],['Melon & mist','#ffba9c','#9ee2e0'],['Mint & vanilla','#a6e7c9','#efdb9b'],['Blue & lilac','#a4d8fa','#d8bafa']])},
 step:{name:'STEPFRAME',bands:[1,3,2,2],stack:[],weights:[1.5,.79,.86,1.54,1.48,.8,.84,1.52],fonts:['saira','text','text','saira','barlow','text','text','saira'],align:[-1,1,0,1],texture:'grid',palettes:klPalettes([['Volt & ice','#e5f577','#a6deed','#1b2730'],['Orange & lavender','#ffaf77','#c7b0ff'],['Aqua & pink','#8ce8d8','#ffacd6'],['Sky & cream','#9acffa','#f3dc98']])},
 ink:{name:'INK LADDER',bands:[2,3,3],stack:[2],weights:[1.42,.94,.85,1.85,.79,1.55,.8,.98],fonts:['block','hand','text','hand','text','barlow','text','hand'],align:[1,0,-1],texture:'paint',palettes:klPalettes([['Tangerine & chalk','#ffb279','#cee993','#242a2c'],['Berry & custard','#ffb0d0','#f1df92'],['Mint & lavender','#a6e4cd','#d3b9f5'],['Sky & peach','#abdafa','#ffc6a6']])}
};

KineticStyles.step.palettes.push(...klPalettes([["Jednobojna / cobalt","#245fff","#245fff","#111b30","#245fff"]]));
