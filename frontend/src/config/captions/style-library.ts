import {isStudioStyle} from './studio-collection';
import {handoffStyleKeys} from './handoff-collection';
import {isCollectionStyle} from './collection';
import {isNeonRiotStyle} from './neon-riot-variants';
import type {CaptionTemplate} from './types';
export const removedStyleKeys=new Set<string>(["collectionStudioPortraitBloom","collectionStudioQuietOrbit","collectionStudioCutRipline","collectionStudioCutUpshift","collectionStudioCutCarbon","collectionStudioCutReel","collectionStudioCutStacktrace","collectionStudioCutSidewinder","collectionStudioCutStamp","collectionStudioCutGlasswire","collectionStudioCutSpeednote","collectionStudioCutPinstripe","collectionStudioKineticOrbit","collectionStudioAmplifyDrive",'collectionStudioMegaAcid','collectionDepth','collectionSatinImpact','collectionSlateFold','collectionHyperMarks','collectionRealityRift','collectionFusionCaps','collectionKaraoke','collectionCinema','collectionNeon','collectionPopPunch']);
export const repairStyleKeys=new Set<string>(["collectionStudioCrystalGlass","collectionStudioLuxurySilk","collectionStudioLiquidImpact","collectionStudioMegaGloss","collectionStudioMegaPixel","collectionStudioMegaJelly","collectionStudioMegaHolo","collectionStudioFinishReel","collectionStudioFinishSidewinder","collectionStudioMotionSun","collectionStudioKineticOffset",'collectionStudioShutter','collectionStudioPleat','collectionForged','collectionTitaniumEdge','collectionMagmaCore','collectionStrata','collectionContourRecoil','collectionMosaicCurrent','collectionCrystalFlux','collectionSilkTorsion','collectionStudioChromaLoop','orbitSignal',...handoffStyleKeys,'collectionWaterform','collectionLavaflow','collectionAtelierNoir','collectionPaperSculpt','collectionVelvetPulse','collectionPorcelainFlow','collectionGlass']);
export const isPresetCaptionStyle=(style:string)=>isCollectionStyle(style)||isNeonRiotStyle(style)||['orbitSignal','velvetScript','inkImpact','prismFold'].includes(style);
export function styleLibraryCategory(template:CaptionTemplate){return repairStyleKeys.has(template.key)?'Prepravke':isStudioStyle(template.key)||isPresetCaptionStyle(template.key)?aiStyleCategory(template.key):template.category==='Dinamični'?'Dynamic':template.category==='Viralno'?'Viral':template.category==='Čisto'?'Clean':'Standard';}

// Presets start at their authored size; never shrink them when selecting a card.
export const defaultCaptionScale=(_key:string)=>100;

export const aiStyleCategories=['Glass & Shine','Gaming','Cards & Frames','Handwriting & Ink','Editorial','Materials','Kinetic'] as const;
export function aiStyleCategory(key:string):typeof aiStyleCategories[number]{
 if(/Prism|Pearl|Opal|Glass|Lustre|Laser|Holo/i.test(key))return 'Glass & Shine';
 if(/HyperPop|JuiceJam|neonRiot|WarpJam|PowerArmor|AmplifyPunch|MegaPixel/i.test(key))return 'Gaming';
 if(/Unwind|Folio|FormTalk|FormFold|FormChain|MotionTicket|MotionPass|SpeakerFrame|QuietSubframe|QuietTape|QuietChat|KineticStep|AmplifyFold|AmplifyRelay/i.test(key))return 'Cards & Frames';
 if(/velvetScript|inkImpact|InkRiot|Sketch|Scribble|Marker|Tidal|KineticInk|AmplifyWild/i.test(key))return 'Handwriting & Ink';
 if(/Business|Quiet|OpticPoetry|ChromaMono|SpeakerSidenote|Pinstripe|Speednote/i.test(key))return 'Editorial';
 if(/Luxury|Meadow|PowerForge|PowerGel|ChromaVelvet|ChromaPulp|AmplifyRiso/i.test(key))return 'Materials';
 return 'Kinetic';
}
export const styleCategoryOrder=(template:CaptionTemplate)=>repairStyleKeys.has(template.key)?5:isPresetCaptionStyle(template.key)?0:['Dynamic','Viral','Clean','Standard'].indexOf(styleLibraryCategory(template))+1;
// Repair styles are exclusively in the staff repair shelf, including saved/favorite cards.
export const visibleInStyleShelf=(template:CaptionTemplate,category:string,isStaff:boolean)=>
 !removedStyleKeys.has(template.key)&&(repairStyleKeys.has(template.key)?isStaff&&category==='Prepravke':category!=='Prepravke');
