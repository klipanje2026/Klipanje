import {AmplifySamples} from './amplify-captions-config.mjs';
export const MotionSamples=AmplifySamples;
const maPalettes=values=>values.map(([name,a,b,dark='#20262d',ink='#fff8e9'])=>({name,a,b,dark,ink}));
export const MotionStyles={
 pass:{name:'BANDPASS',bands:[2,3,3],stack:[1],stackRight:[],weights:[1.45,.86,1.65,.76,.88,.82,1.42,.87],fonts:['italic','text','barlow','text','text','text','italic','text'],align:[1,-1,0],texture:'halftone',palettes:maPalettes([['Tangerine & ice','#ffb27f','#a1e5eb'],['Violet & citron','#c5abff','#e4ed99'],['Mint & rose','#9cdec1','#ffa8ca'],['Sky & cream','#a8d8fa','#f2d796']])},
 sun:{name:'SUNSPOT',bands:[3,3,2],stack:[],stackRight:[],weights:[1.32,.87,.8,.83,1.68,.82,1.4,.88],fonts:['text','hand','text','text','text','text','italic','text'],align:[0,1,-1],texture:'satin',palettes:maPalettes([['Peach & yellow','#ffba89','#f4df8e'],['Iris & blush','#c8aff6','#ffbfd2'],['Mint & honey','#a4e5c9','#ecd386'],['Coral & sea','#ffa693','#9edbd9']])},
 woven:{name:'STITCHSHIFT',bands:[2,3,3],stack:[2],stackRight:[],weights:[1.55,.83,.86,1.52,.8,1.65,.8,.87],fonts:['oswald','text','text','italic','text','oswald','text','hand'],align:[-1,1,0],texture:'woven',palettes:maPalettes([['Sage & cream','#b6dbb1','#edd69b','#26332f'],['Denim & peach','#a5d3f0','#ffc0a1'],['Rose & lilac','#f2b3d0','#c8b6f5'],['Lemon & mint','#e5e89d','#a4dccd']])},
 bridge:{name:'CUTBRIDGE',bands:[3,3,2],stack:[],stackRight:[0],weights:[.9,.77,1.7,.79,1.47,.77,.84,1.48],fonts:['text','text','saira','text','italic','text','text','saira'],align:[-1,0,1],texture:'stripe',palettes:maPalettes([['Acid & periwinkle','#dff08b','#b9b7ff'],['Apricot & blue','#ffb58a','#9ed7fa'],['Pink & ice','#ffacd1','#a5e8dd'],['Sky & vanilla','#a8d8f3','#f1d895']])},
 ticket:{name:'TICKET MIX',bands:[2,2,4],stack:[],stackRight:[],weights:[.88,1.64,1.6,.83,.79,.86,.76,1.48],fonts:['hand','tall','oswald','text','text','hand','text','tall'],align:[1,-1,1],texture:'paper',palettes:maPalettes([['Butter & lilac','#f0df91','#c8aaf8','#292631'],['Coral & pistachio','#ffb1a0','#d4e698'],['Mint & apricot','#a4dfcb','#f4cc97'],['Ice & rose','#a7dbed','#efb4d7']])}
};

MotionStyles.woven.palettes.push(...maPalettes([["Royal blue / tangerine","#1255ff","#ff741e"],["Vivid violet / lime","#8a24ff","#c2f500"]]));
