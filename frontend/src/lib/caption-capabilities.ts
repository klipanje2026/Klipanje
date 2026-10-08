import {isTestStyle,testRenderStyle} from '../config/captions/test-styles';
import {templates} from '../config/captions/presets';
import type {StyleKey,CaptionSettings} from '../config/captions/types';
import {captionEffects} from '../config/captions/effects';
import {ownCaptionLayout,ignoresCaptionTitles} from './caption-word-roles';

/** Clean and Standard are editable foundations; authored layouts opt out explicitly. */
export function captionCapabilities(style:StyleKey){
 const category=templates.find(template=>template.key===style)?.category;
 const basic=isTestStyle(style)||!!category&&!['Dinamični','Viralno'].includes(category);
 return {
  basic,
  layout:true,
  outlines:basic||!['premiumOrangeV4','metallicCompactV2','dynamicGlass','testSerif','smokeSerif','captionsScript','waveWords','terminalType','prismWords','goldMesh'].includes(style),
  important:basic||!style.startsWith('collection')&&style!=='orbitSignal'&&style!=='velvetScript'&&style!=='inkImpact'&&style!=='prismFold'&&!style.startsWith('neonRiot')&&!ownCaptionLayout(style)&&!['prismWords','trackingStack','testSerif','smokeSerif','captionsScript','goldMesh'].includes(style),
  titles:basic||!ignoresCaptionTitles(style),
 };
}

/** Expose the actual inherited typography so a toggle reverses what is on screen. */
export function captionTypography(style:StyleKey,settings:CaptionSettings):CaptionSettings{
 style=testRenderStyle(style);
 return {...settings,
  fontWeight:settings.fontWeight??(style==='mistWords'?200:['editorialLight','readingFade'].includes(style)?400:(captionEffects.soft as StyleKey[]).includes(style)?600:900),
  italic:settings.italic??['elegant','editorialLight','newsHighlight','brushTitle'].includes(style),
 };
}
