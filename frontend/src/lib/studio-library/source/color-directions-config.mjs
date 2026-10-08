import {CutSamples} from './cut-captions-config.mjs';
export const ColorSamples=[...CutSamples];
const directionPalettes=rows=>rows.map(([name,a,b,dark='#19212b',ink='#fff5e8'])=>({name,a,b,dark,ink}));
export const ColorDirections={
 pigment:{name:'PIGMENT',palettes:directionPalettes([
  ['Tangerine & leaf',['#fa7843','#ffb873','#e86764'],['#c4df53','#e1f4a2','#6dcc92']],
  ['Berry & apricot',['#d985bd','#f9b5d1','#ee717f'],['#f4b04e','#ffdb94','#e98766']],
  ['Ocean & lime',['#38b7d0','#94e2e0','#6493d4'],['#b6dc54','#e8f59c','#63c293']],
  ['Orchid & sky',['#ad82dc','#d8b4ec','#eb88be'],['#61b6e1','#ade2f1','#81a6e7']]
 ])},
 luma:{name:'LUMA',palettes:directionPalettes([
  ['Rose & ice',['#f5a0cb','#ffdcc3','#ed87b5'],['#a2def1','#dbd4ff','#a9e7d3'],'#252434','#faf6f0'],
  ['Dawn & mist',['#ffb09a','#ffdfb0','#f9aabd'],['#a5d9ce','#d6e8c9','#adc6f0']],
  ['Iris & mint',['#b2a1e5','#eed6f6','#d09cd8'],['#91dacc','#d6f1c5','#98dcd7']],
  ['Peach & azure',['#f6b192','#ffe5bf','#e99faa'],['#94bfee','#c6e5f8','#b6b8ea']]
 ])},
 duotone:{name:'DUOTONE',palettes:directionPalettes([
  ['Coral & lilac',['#ed6958','#ffb984','#f28684'],['#7263cb','#c8acef','#8998ee'],'#242432','#fff0d9'],
  ['Blue & lemon',['#9dc4ef','#b5def1','#79aed4'],['#e5d472','#f8e9a1','#ceb968']],
  ['Cherry & aqua',['#ee9ea9','#ffbbad','#d8809a'],['#a4d9ca','#bce8d4','#71bfc0']],
  ['Forest & clay',['#9ac797','#cbe0a5','#80afa7'],['#dda47f','#f4cba1','#c88d85']]
 ])}
};
