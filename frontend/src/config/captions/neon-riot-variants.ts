import type {CaptionTemplate, StyleKey} from './types';
import type {RiotMotion} from '../../lib/neon-riot-core.mjs';

export const neonRiotVariants = [
  {key:'neonRiot', name:'Original', colors:['#caff36','#ff4fc8','#40edff','#ffab47','#a88bff'], box:'#9458ff', motion:'spring'},
  {key:'neonRiotElectric', name:'Electric', colors:['#40edff','#2874ff','#ffffff','#a88bff','#40edff'], box:'#2649c9', motion:'slide'},
  {key:'neonRiotAcid', name:'Acid', colors:['#caff36','#b9ff00','#fff84f','#ffffff','#56ef86'], box:'#38471b', motion:'zoom'},
  {key:'neonRiotCandy', name:'Candy', colors:['#ff4fc8','#ffa6df','#a88bff','#40edff','#ffffff'], box:'#b9278d', motion:'wave'},
  {key:'neonRiotFire', name:'Fire', colors:['#ff4936','#ffab47','#ffe65a','#ff7538','#ffffff'], box:'#9c251e', motion:'spring'},
  {key:'neonRiotIce', name:'Ice', colors:['#d8fbff','#40edff','#6ca9ff','#a88bff','#ffffff'], box:'#245bb5', motion:'flip'},
  {key:'neonRiotLaser', name:'Laser', colors:['#ff4fc8','#40edff','#caff36','#ffffff','#ff4fc8'], box:'#502ba0', motion:'glitch'},
  {key:'neonRiotViolet', name:'Violet', colors:['#a88bff','#d7b4ff','#ff4fc8','#6d68ff','#ffffff'], box:'#663bff', motion:'slide'},
  {key:'neonRiotSunset', name:'Sunset', colors:['#ffab47','#ff798f','#ff4fc8','#a88bff','#ffe3b2'], box:'#b94472', motion:'wave'},
  {key:'neonRiotChrome', name:'Chrome', colors:['#ffffff','#c2d2e6','#6c86a1','#e6f7ff','#40edff'], box:'#384960', motion:'flip'},
  {key:'neonRiotRetro', name:'Retro', colors:['#ff4fc8','#a88bff','#40edff','#ffab47','#ffffff'], box:'#7f278f', motion:'zoom'},
  {key:'neonRiotToxic', name:'Toxic', colors:['#94ff24','#d6ff45','#51dc86','#dfffab','#a88bff'], box:'#345126', motion:'glitch'},
  {key:'neonRiotOcean', name:'Ocean', colors:['#40edff','#31cbbc','#5687ff','#9fc9ff','#ffffff'], box:'#14549c', motion:'wave'},
  {key:'neonRiotBubble', name:'Bubble', colors:['#ff9dda','#ffd0f0','#a88bff','#c7b2ff','#ffffff'], box:'#be5c9b', motion:'spring'},
  {key:'neonRiotSolar', name:'Solar', colors:['#fff34a','#ffab47','#ffffff','#ffd376','#ff7044'], box:'#a86712', motion:'zoom'},
  {key:'neonRiotCyber', name:'Cyber', colors:['#caff36','#40edff','#ffffff','#ff4fc8','#a88bff'], box:'#37455c', motion:'glitch'},
  {key:'neonRiotMint', name:'Mint', colors:['#8dffd2','#40edff','#d5fff0','#72d9bc','#ffffff'], box:'#176856', motion:'slide'},
  {key:'neonRiotInferno', name:'Inferno', colors:['#ff3158','#ff7639','#ffab47','#ff4fc8','#fff198'], box:'#8c1e45', motion:'flip'},
  {key:'neonRiotAurora', name:'Aurora', colors:['#8affb9','#40edff','#a88bff','#ff7fcf','#ffffff'], box:'#326b8c', motion:'wave'},
  {key:'neonRiotPrism', name:'Prism', colors:['#ff4fc8','#ffab47','#caff36','#40edff','#a88bff'], box:'#693be5', motion:'spring'},
] as const satisfies readonly {key:StyleKey; name:string; colors:readonly string[]; box:string; motion:RiotMotion}[];

export type NeonRiotKey = typeof neonRiotVariants[number]['key'];
export function isNeonRiotStyle(style: string): style is NeonRiotKey {
  return neonRiotVariants.some(variant => variant.key === style);
}
export function neonRiotVariant(style: string) {
  return neonRiotVariants.find(variant => variant.key === style) ?? neonRiotVariants[0];
}
export const neonRiotTemplates: CaptionTemplate[] = neonRiotVariants.map((variant, index) => ({
  key: variant.key,
  name: `Neon Riot · ${String(index + 1).padStart(2, '0')} ${variant.name}`,
  sample: 'Moje riječi', category: 'Dinamični', portrait: 2,
  preset: {
    fontFamily:'"Arial Black", "Montserrat Variable", sans-serif', fontWeight:900,
    fontScale:100, textColor:'#ffffff', highlightColor:variant.colors[0],
    riotColor2:variant.colors[1], riotColor3:variant.colors[2], riotColor4:variant.colors[3], riotColor5:variant.colors[4],
    backgroundColor:variant.box, backgroundOpacity:100, outlineColor:'#080714', outlineWidth:6,
    textDepth:100, textDepthColor:'#241445', uppercase:true, wordMode:'template',
    reveal:'none', animation:'none', revealDuration:.56, letterSpacing:0,
    riotWords:3, riotLetterDelay:.025, riotMotion:variant.motion, riotMotionStrength:100,
    riotParticles:true, riotBoxes:true, riotUnderline:true, behindPerson:false,
    riotDamping:7.5,riotFrequency:11.5,riotTilt:100,riotFloat:100,riotTrails:true,riotTrailStrength:100,
    riotTrailColor1:'#40edff',riotTrailColor2:'#ff4fc8',riotParticleCount:18,riotSpread:100,riotParticleDuration:1.15,
    riotExitDuration:.32,riotUnderlineWidth:5,riotUnderlineDuration:.42,riotBoxRadius:13,riotGradient:true,riotGlow:100,
    x:50, y:72,
  },
}));
