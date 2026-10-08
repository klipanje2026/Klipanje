import {CutStyles,CutSamples} from './cut-captions-config.mjs';

export const SpeakerSamples=[...CutSamples];
export const SpeakerStyles={
 cutline:{name:'CUTLINE',groups:[4,4,4],rows:[2,2],fonts:['barlow','barlow'],sizes:[86,106],gap:11,texture:'paper',palettes:CutStyles.ripline.palettes},
 echo:{name:'ECHO TYPE',groups:[4,4,4],rows:[2,2],fonts:['text','slash'],sizes:[72,102],gap:13,texture:'halftone',palettes:CutStyles.carbon.palettes},
 marker:{name:'MARKER BEAT',groups:[3,3,3,3],rows:[3],fonts:['tall'],sizes:[116],gap:0,texture:'paint',palettes:CutStyles.reel.palettes},
 sidenote:{name:'SIDE NOTE',groups:[4,4,4],rows:[2,2],fonts:['italic','hand'],sizes:[84,112],gap:5,texture:'paint',palettes:CutStyles.speednote.palettes},
 frame:{name:'FRAME HOLD',groups:[4,4,4],rows:[2,2],fonts:['oswald','oswald'],sizes:[82,98],gap:14,texture:'stripe',palettes:CutStyles.pinstripe.palettes}
};
