import {PortraitSamples} from './portrait-config.mjs';
export const CutSamples=[...PortraitSamples];
const cutPalettes=(colors)=>colors.map(([name,a,b,dark='#1b2425',ink='#fbf7e9'])=>({name,a,b,dark,ink}));
export const CutStyles={
 ripline:{name:'RIPLINE',rows:[2,3,2,3,2],fonts:['barlow','barlow','barlow','barlow','barlow'],sizes:[163,136,163,120,167],align:[-1,1,0,-1,1],gap:23,texture:'paper',
  palettes:cutPalettes([['Tangerine paper','#ff9660','#cff398'],['Electric violet','#c5afff','#fdb8c9'],['Mint print','#a1e9cb','#ffdd7c'],['Blue cut','#96c8ff','#ffab8c']])},
 upshift:{name:'UPSHIFT',rows:[3,2,3,4],fonts:['saira','saira','saira','saira'],sizes:[119,193,149,110],align:[-1,1,-1,1],gap:32,texture:'satin',
  palettes:cutPalettes([['Aqua boost','#73e5d1','#ff986c'],['Lime lift','#dafa65','#a5b9ff'],['Heatwave','#ff9479','#ffe18c'],['Ice drive','#9ac7ff','#f4b3dc'],["Cobalt / ice","#2865ff","#77ddff","#101b32","#f5f9ff"],["Crimson / gold","#f33857","#ffc43d","#291723","#fff6e6"],["Emerald / ivory","#17c68b","#f4efd7","#102c25","#fffdf2"],["Violet / electric","#9d57ff","#ff57c5","#221636","#fff4ff"]])},
 carbon:{name:'CARBON COPY',rows:[3,3,2,2,2],fonts:['barlow','barlow','slash','text','barlow'],sizes:[119,122,175,96,170],align:[-1,0,1,-1,1],gap:22,texture:'halftone',
  palettes:cutPalettes([['Red registration','#ff735c','#ecf0dd','#29262b'],['Cobalt print','#82b6ff','#ffe09b'],['Magenta press','#ff98d1','#c1dca3'],['Green edition','#bef084','#92d7df']])},
 reel:{name:'HIGHLIGHT REEL',rows:[2,3,3,2,2],fonts:['tall','tall','tall','tall','tall'],sizes:[183,158,149,178,177],align:[0,-1,1,-1,0],gap:13,texture:'paint',
  palettes:cutPalettes([['Lemon ink','#e9fb69','#91ded9'],['Orange marker','#ffb475','#cbc0ff'],['Pink pen','#ffaddb','#adebbb'],['Ocean marker','#9ce6f2','#ffe38a']])},
 stacktrace:{name:'STACKTRACE',rows:[2,2,2,2,2,2],fonts:['block','barlow','block','barlow','block','barlow'],sizes:[114,157,116,163,117,162],align:[-1,1,-1,1,-1,1],gap:14,texture:'grid',
  palettes:cutPalettes([['Lilac keys','#c3b2ff','#def979'],['Coral keys','#ffae9b','#aae5e0'],['Mint keys','#a5ecc3','#f4c592'],['Ice keys','#afd7ff','#f7b6d8']])},
 sidewinder:{name:'SIDEWINDER',rows:[3,2,2,3,2],fonts:['text','saira','slash','saira','slash'],sizes:[88,183,167,136,170],align:[-1,1,-1,0,1],gap:31,texture:'satin',
  palettes:cutPalettes([['Orange curve','#ffad76','#9bdad9'],['Lilac curve','#cbafff','#e6f58d'],['Seafoam curve','#a6ead2','#ffc8ab'],['Pink curve','#fca8d2','#b3d7ff']])},
 stamp:{name:'RUBBERSTAMP',rows:[2,2,4,2,2],fonts:['slash','slash','barlow','slash','slash'],sizes:[171,181,120,165,177],align:[0,-1,0,1,0],gap:26,texture:'rubber',
  palettes:cutPalettes([['Coral stamp','#ff947b','#e6ddae','#2c2623'],['Lime stamp','#d5f08a','#a9d9dc'],['Lilac stamp','#cfaff7','#f3d4a1'],['Blue stamp','#9bccf1','#ffc3af']])},
 glasswire:{name:'GLASSWIRE',rows:[3,2,4,3],fonts:['tall','tall','tall','tall'],sizes:[142,211,124,177],align:[0,-1,0,1],gap:35,texture:'frost',
  palettes:cutPalettes([['Glacier wire','#a0e9f0','#ffaf87'],['Lilac wire','#d2c0ff','#f8b3cf'],['Lime wire','#d1f79b','#a2d0f0'],['Rose wire','#ffc2d9','#b6e7d6']])},
 speednote:{name:'SPEEDNOTE',rows:[3,2,3,2,2],fonts:['italic','italic','hand','italic','italic'],sizes:[135,196,179,180,174],align:[-1,1,0,-1,1],gap:17,texture:'paint',
  palettes:cutPalettes([['Track orange','#ffb177','#afe6d9'],['Pink motion','#fca6d0','#d4f79d'],['Cobalt motion','#a2bfff','#f6d18c'],['Mint motion','#b1edbe','#ffc5c2']])},
 pinstripe:{name:'PINSTRIPE',rows:[3,2,2,3,2],fonts:['oswald','block','oswald','barlow','oswald'],sizes:[121,128,182,130,182],align:[1,-1,0,1,-1],gap:27,texture:'stripe',
  palettes:cutPalettes([['Acid stripe','#dff780','#c8b7ff'],['Peach stripe','#ffc08c','#a7dbe9'],['Lilac stripe','#d2b6ff','#b7efc8'],['Sky stripe','#a8d9ff','#f5bea5']])}
};
export const CutFontMap={barlow:'900 100px CutBarlow',italic:'italic 900 100px CutItalic',tall:'400 100px CutTall',oswald:'700 100px CutOswald',saira:'800 100px CutSaira',block:'400 100px CutBlock',slash:'400 100px PCSlash',text:'650 100px PCText',hand:'700 100px PCHand'};
