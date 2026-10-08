import {AmplifySamples} from './amplify-captions-config.mjs';
import {ChromaStyles} from './chroma-captions-config.mjs';
import {CutFontMap} from './cut-captions-config.mjs';
export const FormSamples=AmplifySamples;
export const FormFontMap={...CutFontMap,serif:'700 100px Georgia,serif',serifItalic:'italic 700 100px Georgia,serif'};
export const FormStyles={
 halo:{name:'HALO FLOW',concept:'Dvije krivulje i orbitalni luk',texture:'satin',palettes:ChromaStyles.tidal.palettes},
 talk:{name:'TALKBACK',concept:'Tri razgovorna oblačića',texture:'frost',palettes:ChromaStyles.edge.palettes},
 fold:{name:'FOLDOUT',concept:'Dvije kolone i presavijeni papir',texture:'paper',palettes:ChromaStyles.velvet.palettes},
 chain:{name:'SIDECHAIN',concept:'Četiri stepenasta para i putanja',texture:'grid',palettes:ChromaStyles.mono.palettes},
 sketch:{name:'SKETCHBOOK',concept:'Rukopis, potezi i skicirani krug',texture:'paint',palettes:ChromaStyles.pulp.palettes}
};
