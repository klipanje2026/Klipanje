import {inkMixBase,isInkMixStyle} from './ink-mix-family';
import {testTemplates,ordinaryStyleFamilies} from './test-styles';
import {isRiplineStyle,riplineBase} from './ripline-family';
import {removedStyleKeys,isPresetCaptionStyle} from './style-library';
import type { CaptionTemplate, CaptionSettings, StyleCategory, StyleKey } from './types';
import { captionColors } from './colors';
import {neonRiotTemplates} from './neon-riot-variants';
import {collectionTemplates} from './collection';
export type * from './types';

export const templates: CaptionTemplate[] = [
 ...testTemplates,
 ...collectionTemplates,
 {key:'scriptVerbatim',name:'Script Verbatim',sample:'Tvoja priča ostavlja trag',category:'Dinamični',preset:{fontFamily:'"ArtBrush", "Caveat Variable", cursive',secondaryFontFamily:'"Pinyon Script", cursive',fontWeight:600,textColor:'#ffffff',highlightColor:'#ffffff',outlineWidth:0,backgroundOpacity:0,uppercase:false,wordMode:'spoken',animation:'none',reveal:'none',alignment:'left',x:10}},
 {key:'underlinedEditorial',name:'Editorial Underline',sample:'Tvoja priča počinje ovdje',category:'Dinamični',preset:{fontFamily:'"Raleway Variable", sans-serif',secondaryFontFamily:'"Playfair Display Variable", serif',fontWeight:500,textColor:'#ffffff',highlightColor:'#ffffff',underlineColor:'#ffffff',outlineWidth:0,backgroundOpacity:0,uppercase:true,wordMode:'spoken',animation:'none',reveal:'none',behindPerson:true}},
 {key:'curvyBackdrop',name:'Curvy Backdrop',sample:'Ovo je tvoja DISCIPLINA',category:'Dinamični',preset:{fontFamily:'"Oswald Variable", sans-serif',secondaryFontFamily:'"Pinyon Script", cursive',fontWeight:900,textColor:'#ffffff',highlightColor:'#b5ff3d',outlineWidth:0,backgroundOpacity:0,uppercase:false,behindPerson:true,wordMode:'spoken',animation:'none',reveal:'none'}},
 {key:'prismWords',name:'Prism Words',sample:'Budi uvijek READY',category:'Dinamični',preset:{fontFamily:'"Oswald Variable", sans-serif',fontWeight:900,textColor:'#f7f4e9',highlightColor:'#287fa6',prismStrength:100,behindPerson:true,outlineWidth:0,backgroundOpacity:0,uppercase:true,wordMode:'single',animation:'none',reveal:'none'}},
 {key:'trackingStack',name:'Tracking Stack',sample:'one swipe that’s it grab',category:'Dinamični',preset:{fontFamily:'"Nunito Variable", sans-serif',fontWeight:800,textColor:'#ffe19a',highlightColor:'#ffe19a',outlineColor:'#151515',outlineWidth:.65,backgroundOpacity:0,uppercase:false,wordMode:'spoken',animation:'none',reveal:'none',alignment:'left',x:10}},
 {key:'metallicCompactV2',name:'Metallic Compact',sample:'Tvoja priča zaslužuje TITLOVE',category:'Dinamični',preset:{fontFamily:'"Arial Black", "Montserrat Variable", sans-serif',secondaryFontFamily:'Arial, sans-serif',fontWeight:900,fontScale:100,textColor:'#ffffff',highlightColor:'#ff9515',metallicRed:'#850926',metallicSilver:'#9db7d1',metallicShine:100,metallicMaterial:'auto',metallicZone:'mixed',metallicPhraseWords:3,metallicHoldEnd:false,glassCamera:true,glassIntensity:100,behindPerson:false,wordMode:'spoken',outlineWidth:0,backgroundOpacity:0,reveal:'none',animation:'none'}},
 {key:'captionsScript',name:'Captions Script',sample:'Tvoja priča',category:'Dinamični',preset:{fontFamily:'"Inter Variable", sans-serif',secondaryFontFamily:'"Caveat Variable", cursive',fontScale:100,textColor:'#ffffff',highlightColor:'#e9eb73',backgroundOpacity:0,outlineWidth:0,revealGroupSize:2,animation:'none',reveal:'none'}},
 {key:'premiumOrangeV4',name:'Premium Orange',sample:'Tvoja priča zaslužuje više',category:'Dinamični',preset:{fontFamily:'Arial, sans-serif',fontWeight:700,fontScale:100,textColor:'#ffffff',highlightColor:'#ffb929',effectDepth:100,outlineWidth:0,backgroundOpacity:0,wordMode:'spoken',reveal:'none',animation:'none',glassCamera:true,glassIntensity:100,premiumEntrance:'mixed',premiumPhraseWords:6}},
 {key:'waveWords',name:'Wave Words',sample:'Riječi u pokretu',category:'Dinamični',preset:{fontFamily:'"Oswald Variable", sans-serif',fontWeight:700,textColor:'#7acbea',highlightColor:'#ffffff',outlineColor:'#f3fcff',outlineWidth:1.2,backgroundOpacity:0,uppercase:false,wordMode:'spoken',reveal:'none',animation:'none',waveStrength:100,revealGroupSize:1}},
 {key:'terminalType',name:'Terminal',sample:'Tvoja priča počinje_',category:'Dinamični',preset:{fontFamily:'Courier New, monospace',fontWeight:700,textColor:'#d4ffe1',highlightColor:'#ffffff',backgroundColor:'#101c18',backgroundOpacity:100,outlineWidth:0,uppercase:false,wordMode:'spoken',reveal:'none',animation:'none',typingUnit:'letters'}},
 {key:'goldMesh',name:'Golden Texture',sample:'lazy',category:'Dinamični',preset:{fontFamily:'"YWFT Black Slabbath", serif',fontWeight:400,textColor:'#ffbc38',highlightColor:'#ffdd54',faceTexture:'goldMesh',backgroundOpacity:0,outlineWidth:1.53,outlineColor:'#8f2701',outerOutlineWidth:1.19,textureOpacity:100,uppercase:false,wordMode:'single',revealGroupSize:1,reveal:'fade',animation:'none'}},
 {key:'tripleGothic',name:'Triple Gothic',sample:'brown',category:'Dinamični',preset:{fontFamily:'"CC-GothicPro", "Oswald Variable", sans-serif',fontWeight:400,textColor:'#000000',highlightColor:'#000000',backgroundOpacity:0,outlineWidth:0,uppercase:false,revealGroupSize:1,wordMode:'single',animation:'none',reveal:'none',outlineLayers:[{color:'#fff78f',width:2.04},{color:'#21baca',width:4.08},{color:'#f20dd4',width:6.12}]}},
 {key:'testSerif',name:'Smoky',sample:'TVOJA PRIČA',category:'Dinamični',preset:{fontFamily:'"Playfair Display Variable", serif',fontScale:100,textColor:'#eef0f3',highlightColor:'#d7deef',outlineColor:'#333640',backgroundOpacity:0,outlineWidth:.7,uppercase:true,revealGroupSize:1,animation:'none',reveal:'fade',fadeFrom:0,textureBackground:true,glyphSmokeScale:115,textureOpacity:100,frostWidth:100,frostHeight:100,smokeDuration:2.1,borderMist:false}},
 {key:'smokeSerif',name:'Icy',sample:'TVOJA PRIČA',category:'Dinamični',preset:{fontFamily:'"Playfair Display Variable", serif',fontScale:100,textColor:'#f1f1f4',highlightColor:'#d7deef',backgroundOpacity:0,outlineWidth:0,uppercase:true,revealGroupSize:2,animation:'none',reveal:'none'}},
 {key:'dynamicGlass' ,name:'Dynamic Glass',sample:'Svaka priča zaslužuje svoj trenutak',category:'Dinamični',preset:{fontFamily:'"Montserrat Variable", sans-serif',fontScale:100,textColor:'#ffffff',highlightColor:'#477aff',glassAccentColor:'#ff880c',glassCamera:true,glassIntensity:100,behindPerson:true,revealGroupSize:2,backgroundOpacity:0,outlineWidth:0,reveal:'none',animation:'none'}},
 {key:'comicLetterBounce',name:'Comic Letter Bounce',sample:'Tvoja priča pokreće svijet',category:'Dinamični',preset:{fontFamily:'"Nunito Variable", sans-serif',fontScale:135,textColor:'#e36528',highlightColor:'#ffe16b',outlineColor:'#ffe16b',outlineWidth:2.5,backgroundOpacity:0,reveal:'none',wordMode:'spoken',uppercase:false,glowIntensity:90,glowRadius:35}},
 {key:'sketchNote',name:'Sketch',sample:'IDEJA Svaka riječ ostaje',category:'Dinamični',preset:{fontFamily:'"ArtBrush", "Caveat Variable", cursive',secondaryFontFamily:'"Montserrat Variable", sans-serif',secondaryStyle:{fontWeight:600},textColor:'#fff9e7',highlightColor:'#eee5c8',backgroundColor:'#333831',backgroundOpacity:0,fontScale:140,secondaryFontScale:150,outlineWidth:0,reveal:'fade',fadeFrom:0,revealDuration:.12,wordMode:'spoken'}},
 {key:'lensFrame',name:'Lens',sample:'Uhvatimo pravi trenutak',category:'Dinamični',preset:{fontFamily:'"Oswald Variable", sans-serif',textColor:'#ffffff',highlightColor:'#e4b454',backgroundColor:'#10121a',backgroundOpacity:85,outlineWidth:0,reveal:'fade',fadeFrom:0,wordMode:'spoken'}},
 {key:'popCollage',name:'Pop Collage',sample:'PROJEKT Danas stvaramo nešto svoje',category:'Dinamični',preset:{fontFamily:'"Caveat Variable", cursive',secondaryFontFamily:'"Oswald Variable", sans-serif',textColor:'#17151d',highlightColor:'#efb8da',backgroundColor:'#ffffff',backgroundOpacity:100,outlineColor:'#17151d',outlineWidth:0,fontScale:130,secondaryFontScale:165,reveal:'none',wordMode:'all',animation:'pop'}},
 {key:'aeArtbrushSticker',name:'Artbrush Sticker',sample:'Tvoja priča ostaje',category:'Viralno',preset:{fontFamily:'"ArtBrush", "Caveat Variable", cursive',textColor:'#d77725',highlightColor:'#d77725',fontScale:145,outlineColor:'#ffffff',outlineWidth:2.4,outerOutlineColor:'#080808',outerOutlineWidth:2.1,backgroundOpacity:0,reveal:'fade',fadeFrom:0,revealDuration:.14,revealGroupSize:2,wordMode:'template',uppercase:false}},
 {key:'goldBold',name:'Golden Bold',sample:'TVOJA PRIČA VRIJEDI',category:'Viralno',preset:{fontFamily:'"Roboto Variable", sans-serif',secondaryFontFamily:'"Roboto Variable", sans-serif',fontScale:125,secondaryFontScale:125,textColor:'#ffffff',highlightColor:'#dfb64c',outlineWidth:0,backgroundOpacity:0,uppercase:true,wordMode:'all',emphasisWord:1,reveal:'fade',revealDuration:.18,animation:'fade'}},
 {key:'depthText',name:'Sculpted 3D',sample:'GIVE YOUR WORDS DEPTH',category:'Viralno',preset:{fontFamily:'"Roboto Variable", sans-serif',textColor:'#ffffff',highlightColor:'#70a9ff',textDepth:35,textDepthColor:'#263746',textMaterial:'metal',surfaceStrength:75,surfaceBevel:45,surfaceLightAngle:-45,outlineWidth:0,backgroundOpacity:0,uppercase:true,fontScale:135,y:65,reveal:'pop'}},
 {key:'hightech',name:'Hightech',sample:'THE FUTURE STARTS HERE',category:'Dinamični',preset:{fontFamily:'"Hightech", "Roboto Variable", sans-serif',textColor:'#e9fdff',highlightColor:'#50f3e5',outlineWidth:0,backgroundOpacity:0,uppercase:true,fontScale:125,letterSpacing:3,y:62,reveal:'slideFall',revealDuration:.32}},
 {key:'cyberTrack',name:'Cyber Track',sample:'CREATE YOUR NEXT LEVEL',category:'Dinamični',preset:{fontFamily:'"Cyber Track", "Roboto Variable", sans-serif',textColor:'#ffffff',highlightColor:'#b3ff39',outlineWidth:0,backgroundOpacity:0,uppercase:true,fontScale:135,letterSpacing:2,y:60,reveal:'slideFall',revealDuration:.24}},
 {key:'brushTitle',name:'Brush Titles',sample:'Make your story move',category:'Dinamični',preset:{fontFamily:'"Caveat Variable", cursive',textColor:'#ffffff',highlightColor:'#ffd26b',outlineWidth:0,backgroundOpacity:0,fontScale:170,rotation:-3,y:55,reveal:'slideFall',revealDuration:.3}},
 {key:'slideFall',name:'Slide & Fall',sample:'Svaka riječ ima svoj ritam',category:'Dinamični',preset:{fontFamily:'"Roboto Variable", sans-serif',textColor:'#ffffff',highlightColor:'#ffffff',outlineWidth:0,backgroundOpacity:0,fontScale:115,y:72,reveal:'slideFall',revealDuration:.32}},
 {key:'blurReading',name:'Blur Reading',sample:'Svaka riječ postaje jasna',category:'Dinamični',preset:{fontFamily:'"Inter Variable", sans-serif',textColor:'#ffffff',backgroundOpacity:0,outlineWidth:0,reveal:'letters',revealDuration:.24,fontScale:145,letterSpacing:5,y:65}},
 {key:'editorialHeader',name:'Editorial Header',sample:'GREAT That is the whole story.',category:'Dinamični',preset:{fontFamily:'Courier New, monospace',secondaryFontFamily:'"Playfair Display Variable", serif',textColor:'#ffffff',highlightColor:'#f0e7d5',backgroundOpacity:0,outlineWidth:0,alignment:'left',y:82,behindPerson:true,uppercase:true,letterSpacing:4}},
 {key:'boldHeader',name:'Bold Header',sample:'BUILD Three steps to something great',category:'Dinamični',preset:{fontFamily:'"Roboto Variable", sans-serif',textColor:'#111111',highlightColor:'#ffffff',backgroundColor:'#eae4cd',backgroundOpacity:100,outlineColor:'#242424',outlineWidth:1,y:82,behindPerson:true,uppercase:true}},
 {key:'prismPop',name:'Prism Pop',sample:'ALWAYS CREATE SOMETHING NEW',category:'Dinamični',preset:{fontFamily:'"Roboto Variable", sans-serif',textColor:'#128bc5',highlightColor:'#9da6b2',prismStrength:75,backgroundOpacity:0,outlineWidth:0,wordMode:'single',uppercase:true,fontScale:245,y:50,reveal:'pop',behindPerson:true}},
 {key:'mistWords',name:'Mist',sample:'now make your story',category:'Dinamični',preset:{fontFamily:'"Inter Variable", sans-serif',textColor:'#ffffff',backgroundOpacity:0,outlineWidth:0,wordMode:'single',letterSpacing:16,fontScale:155,y:48,reveal:'fade',revealDuration:.24}},
 {key:'newsHighlight',name:'News Highlight',sample:'I FIRED OUR BIGGEST',category:'Dinamični',preset:{fontFamily:'"Roboto Variable", sans-serif',textColor:'#ffffff',highlightColor:'#e6ff00',backgroundColor:'#ff2516',backgroundOpacity:100,outlineWidth:0,emphasisWord:1,uppercase:true,alignment:'left',y:78,fontScale:115,wordMode:'highlight',reveal:'none'}},
 {key:'bigKeyword',name:'Big Keyword',sample:'I have watched FIVE technologies over the years',category:'Dinamični',preset:{fontFamily:'Courier New, monospace',textColor:'#ffffff',highlightColor:'#ff3c16',backgroundOpacity:0,outlineWidth:0,emphasisWord:3,uppercase:true,alignment:'left',y:76,wordMode:'all',reveal:'none'}},
 {key:'prism',name:'Prism',sample:'Real estate',category:'Dinamični',preset:{fontFamily:'"Roboto Variable", sans-serif',secondaryFontFamily:'"Playfair Display Variable", serif',textColor:'#ffffff',highlightColor:'#b25cff',prismStrength:100,backgroundOpacity:0,outlineWidth:0,y:27,behindPerson:true}},
 {key:'verticalTitle',name:'Vertical Header',sample:'PRIČA koja ostaje',category:'Dinamični',preset:{fontFamily:'"Roboto Variable", sans-serif',secondaryFontFamily:'"Playfair Display Variable", serif',textColor:'#ffffff',highlightColor:'#c8f43c',backgroundOpacity:0,outlineWidth:1,y:85}},
 {key:'sweepTitle',name:'Header BG Fill',sample:'SVOJA priča počinje ovdje',category:'Dinamični',preset:{fontFamily:'"Roboto Variable", sans-serif',textColor:'#ffffff',highlightColor:'#ffffff',backgroundColor:'#50623b',backgroundOpacity:100,outlineWidth:0,y:78}},
 {key:'readingFade',name:'Opacity Reading',sample:'Zapamti, prestani slušati. Počni pričati.',category:'Dinamični',preset:{fontFamily:'"Playfair Display Variable", serif',textColor:'#ffffff',backgroundOpacity:0,outlineWidth:0,y:60,emphasisWord:2,reveal:'none'}},
  {key:"stackedHeadlines",name:"Layer Header",sample:"MOJA PRIČA IDE DALJE",category:"Dinamični",preset:{fontFamily:'"Roboto Variable", sans-serif',textColor:"#ffffff",highlightColor:"#e8f23d",outlineColor:"#17242b",backgroundOpacity:0,outlineWidth:0,uppercase:true,y:77,fontScale:140,reveal:"pop",letterSpacing:1}},
  {key:"paperCut",name:"Papercut",sample:"PRIČA BEZ GRANICA",category:"Dinamični",preset:{fontFamily:'"Oswald Variable", sans-serif',textColor:"#ffffff",highlightColor:"#e6ed95",backgroundColor:"#17231f",backgroundOpacity:100,outlineColor:"#e6ed95",outlineWidth:1,uppercase:true,position:"top",y:22,reveal:"rise",letterSpacing:5}},
  {key:"editorialLight",name:"Elevate",sample:"Trenutak koji ostaje",category:"Film",preset:{fontFamily:'"Playfair Display Variable", serif',textColor:"#ffffff",highlightColor:"#fff1c9",backgroundOpacity:0,outlineWidth:0,y:55,reveal:"fade",fontScale:110}},
  {key:"primeFrame",name:"Borders",sample:"TVOJA PRIČA",category:"Dinamični",preset:{captionFrame:true,fontFamily:'"Caveat Variable", cursive',textColor:"#ffffff",highlightColor:"#8bf5ee",reveal:"pop",fontScale:110,position:"top",y:20,secondaryFontFamily:'"Caveat Variable", cursive'}},
  { key: "clean", name: "Clean", sample: "Jasno i mirno", category: "Čisto", preset: { fontFamily: "Georgia, serif", textColor: captionColors.white, highlightColor: captionColors.white, outlineWidth: 0, backgroundOpacity: 0, y: 87.5 } },
  { key: "focus", name: "Focus", sample: "BITNE riječi", category: "Viralno", preset: { textColor: captionColors.white, highlightColor: captionColors.lime, uppercase: true } },
  { key: "word", name: "Riječ po riječ", sample: "Prati GOVOR", category: "Viralno", preset: { textColor: captionColors.white, highlightColor: captionColors.lime, fontScale: 125 } },
  { key: "karaoke", name: "Karaoke", sample: "Prati ritam", category: "Viralno", preset: { textColor: captionColors.white, highlightColor: captionColors.yellow } },
  { key: "box", name: "Box", sample: "Dobar kontrast", category: "Čisto", preset: { textColor: captionColors.white, outlineWidth: 0, backgroundColor: captionColors.black, backgroundOpacity: 82 } },
  { key: "bounce", name: "Pop", sample: "Svaka RIJEČ", category: "Viralno", preset: { textColor: captionColors.white, highlightColor: captionColors.lime, fontScale: 115 } },
  { key: "minimal", name: "Minimal", sample: "Manje je više", category: "Čisto", preset: { textColor: captionColors.white, outlineWidth: 0, backgroundOpacity: 0, fontScale: 90 } },
  { key: "news", name: "Vijesti", sample: "NASLOV PRIČE", category: "Čisto", preset: { textColor: captionColors.white, highlightColor: "#ffdb3b", uppercase: true, outlineWidth: 0 } },
  { key: "glow", name: "Glow", sample: "NEON GLOW", category: "Neon", preset: { textColor: captionColors.white, highlightColor: captionColors.violet, outlineWidth: 0 } },
  { key: "marker", name: "Marker", sample: "Označeni tekst", category: "Viralno", preset: { highlightColor: captionColors.lime, outlineWidth: 0 } },
  { key: "comic", name: "Strip", sample: "WOW! PRIČA", category: "Viralno", preset: { highlightColor: "#ffe33d", fontFamily: "Impact, sans-serif", uppercase: true, outlineWidth: 3 } },
  { key: "cinema", name: "Cinema", sample: "VELIKA PRIČA", category: "Film", preset: { textColor: captionColors.white, fontFamily: "Georgia, serif", uppercase: true, outlineWidth: 0 } },
  { key: "retro", name: "Retro", sample: "PLAY 1999", category: "Film", preset: { textColor: "#ffd39b", highlightColor: "#ffd39b", fontFamily: "Courier New, monospace" } },
  { key: "gradient", name: "Gradient", sample: "COLOR FLOW", category: "Neon", preset: { textColor: captionColors.violet, highlightColor: captionColors.lime, outlineWidth: 0 } },
  { key: "outline", name: "Outline", sample: "SAMO RUB", category: "Čisto", preset: { highlightColor: captionColors.white, uppercase: true, outlineWidth: 3 } },
  { key: "bubble", name: "Bubble", sample: "Meki oblak", category: "Viralno", preset: { highlightColor: captionColors.lime, outlineWidth: 0 } },
  { key: "neon", name: "Neon cyan", sample: "NIGHT MODE", category: "Neon", preset: { textColor: captionColors.cyan, highlightColor: captionColors.cyan, fontFamily: "Arial Black, Arial, sans-serif", uppercase: true, outlineWidth: 0 } },
  { key: "neonPink", name: "Neon pink", sample: "PINK LIGHT", category: "Neon", preset: { textColor: captionColors.pink, highlightColor: captionColors.pink, fontFamily: "Arial Black, Arial, sans-serif", uppercase: true, outlineWidth: 0 } },
  { key: "cyber", name: "Cyber", sample: "SYSTEM ON", category: "Neon", preset: { textColor: "#73ff5b", highlightColor: "#00f0ff", fontFamily: "Courier New, monospace", uppercase: true, outlineWidth: 0 } },
  { key: "threeD", name: "3D Depth", sample: "VELIKI 3D", category: "Viralno", preset: { textColor: captionColors.white, highlightColor: "#7659ff", fontFamily: "Impact, sans-serif", uppercase: true, outlineWidth: 2 } },
  { key: "sticker", name: "Sticker", sample: "STICKER!", category: "Viralno", preset: { textColor: captionColors.white, highlightColor: "#ffdb3b", fontFamily: "Arial Black, Arial, sans-serif", uppercase: true, outlineWidth: 5 } },
  { key: "chrome", name: "Chrome", sample: "METAL", category: "Neon", preset: { textColor: captionColors.white, highlightColor: "#cbd3ff", fontFamily: "Impact, sans-serif", uppercase: true, outlineWidth: 1 } },
  { key: "fire", name: "Vatra", sample: "ON FIRE", category: "Neon", preset: { textColor: "#ff4d00", highlightColor: "#ffe600", fontFamily: "Impact, sans-serif", uppercase: true, outlineWidth: 1 } },
  { key: "ice", name: "Led", sample: "ICE COLD", category: "Neon", preset: { textColor: "#e7fbff", highlightColor: "#58c7ff", uppercase: true, outlineWidth: 1 } },
  { key: "typewriter", name: "Typewriter", sample: "nova poruka_", category: "Film", preset: { textColor: "#f3ead7", fontFamily: "Courier New, monospace", outlineWidth: 0, backgroundOpacity: 0 } },
  { key: "elegant", name: "Elegant", sample: "Jedna priča", category: "Film", preset: { textColor: "#fff6dd", highlightColor: "#d8b86c", fontFamily: "Georgia, serif", outlineWidth: 0, fontScale: 95 } },
  { key: "gaming", name: "Gaming", sample: "LEVEL UP", category: "Viralno", preset: { textColor: captionColors.white, highlightColor: "#67ff37", fontFamily: "Impact, sans-serif", uppercase: true, outlineWidth: 2 } },
  { key: "urgent", name: "Hitno", sample: "BREAKING", category: "Čisto", preset: { textColor: captionColors.white, highlightColor: "#ff3131", uppercase: true, outlineWidth: 0 } },
  { key: "pastel", name: "Pastel", sample: "soft mood", category: "Čisto", preset: { textColor: "#4d315f", highlightColor: "#ffc7e8", outlineWidth: 0, backgroundOpacity: 0 } },
  { key: "social", name: "Social pop", sample: "Gledaj OVO", category: "Viralno", preset: { textColor: captionColors.white, highlightColor: "#ffdb3b", fontFamily: "Arial Black, Arial, sans-serif", fontScale: 115 } },
  { key: "shadow", name: "Duboka sjena", sample: "BOLD STORY", category: "Film", preset: { textColor: captionColors.white, highlightColor: "#7659ff", fontFamily: "Arial Black, Arial, sans-serif", uppercase: true, outlineWidth: 0 } },
  { key: "captionCard", name: "Caption kartica", sample: "Čitaj bez napora", category: "Čisto", preset: { textColor: captionColors.white, outlineWidth: 0, backgroundColor: "#15151d", backgroundOpacity: 78 } },
 ...neonRiotTemplates,
 {key:'prismFold',name:'Prism Fold',sample:'Svjetlost pokreće priču',category:'Dinamični',portrait:3,preset:{fontFamily:'"Inter Variable", sans-serif',fontWeight:800,fontScale:100,uppercase:true,textColor:'#fffaf2',highlightColor:'#72f5ef',foldColor2:'#a98aff',backgroundColor:'#14283b',backgroundOpacity:72,outlineWidth:0,letterSpacing:1,wordMode:'template',animation:'none',reveal:'none',revealDuration:.58,motionCurve:'softStop',foldWords:3,foldSlices:4,foldStrength:100,foldStagger:.045,foldBeamSpeed:1,foldBeam:true,foldRim:true,foldEcho:true,textMaterial:'satin',surfaceStrength:45,surfaceBevel:30,surfaceColor:'#c5f6ff',surfaceOpacity:18,shineMode:'diagonal',shineStrength:65,shineSpeed:1,shineWidth:30,behindPerson:false}},
 {key:'inkImpact',name:'Ink Impact',sample:'Ostavi svoj trag',category:'Dinamični',portrait:4,preset:{fontFamily:'"Oswald Variable", sans-serif',fontWeight:700,fontScale:100,uppercase:true,textColor:'#fff1dc',highlightColor:'#ffd34e',inkColor2:'#ff6e49',inkBrushTextColor:'#19151a',backgroundOpacity:100,outlineColor:'#171318',outlineWidth:1,letterSpacing:.3,wordMode:'template',animation:'none',reveal:'none',revealDuration:.24,motionCurve:'softStop',inkWords:3,inkImpact:100,inkGrain:60,inkRoughness:65,inkDrops:16,inkSpread:100,inkTilt:100,inkRowGap:5,inkExitDuration:.2,inkBrush:true,inkSplatter:true,inkUnderline:true,behindPerson:false}},
 {key:'orbitSignal',name:'Orbit Signal',sample:'Tvoj glas putuje',category:'Dinamični',portrait:5,preset:{fontFamily:'"Inter Variable", sans-serif',fontWeight:800,fontScale:100,uppercase:true,textColor:'#f2fbff',highlightColor:'#4ee1c6',orbitColor2:'#ffb573',backgroundOpacity:0,outlineColor:'#0b222c',outlineWidth:.6,letterSpacing:.4,wordMode:'template',animation:'none',reveal:'none',revealDuration:.5,motionCurve:'softStop',orbitWords:3,orbitEntry:100,orbitSpeed:1,orbitRadius:100,orbitSatellites:2,orbitGlow:50,orbitRings:true,orbitDashes:true,orbitLeader:true,behindPerson:false}},
 {key:'velvetScript',name:'Velvet Script',sample:'Sve počinje tobom',category:'Dinamični',portrait:6,preset:{fontFamily:'"Pinyon Script", cursive',fontWeight:400,fontScale:100,uppercase:false,textColor:'#fff5e5',highlightColor:'#e8be7a',velvetShadowColor:'#342034',backgroundOpacity:0,outlineColor:'#392230',outlineWidth:.35,letterSpacing:0,wordMode:'template',animation:'none',reveal:'none',revealDuration:.7,motionCurve:'softStop',velvetWords:3,velvetWrite:true,velvetPenGlow:true,velvetFlourish:true,velvetFlourishWidth:105,scriptDrawDuration:.65,shineMode:'diagonal',shineStrength:65,shineSpeed:.6,shineWidth:30,behindPerson:false}},
];

export const styleCategories: StyleCategory[] = ["Sve", "Dinamični", "Dvobojni", "Viralno", "Neon", "Čisto", "Film"];

export const isDuoStyle = (style: StyleKey) => style.startsWith("duo");

// Stroke widths are the visible band thickness at a 34px reference font, not total path width.
const duoBase: Partial<CaptionSettings> = {
  fontFamily: "Arial Black, Arial, sans-serif", uppercase: true,
  outlineWidth: 2.2, outerOutlineWidth: 1.5, backgroundOpacity: 0,
  fontScale: 110, glowIntensity: 80, glowRadius: 35, letterSpacing: 1,
};
const duo = (key: StyleKey, name: string, sample: string, face: string, inner: string, outer: string, extra: Partial<CaptionSettings> = {}): CaptionTemplate => ({
  key, name, sample, category: "Dvobojni",
  preset: { ...duoBase, textColor: face, highlightColor: ["#ffea28", captionColors.electricYellow, "#ffef66"].includes(face) ? captionColors.white : inner, outlineColor: inner,
    outerOutlineColor: outer, outlineGlowColor: outer, ...extra },
});
export const duoTemplates: CaptionTemplate[] = [
  duo("duoSunshine", "Sunčani glow", "DOBAR DAN", "#ffea28", "#20ccff", "#fff1a4", { outlineGlow: true, outlineGlowColor: captionColors.yellow, glowIntensity: 130 }),
  duo("duoCherry", "Cherry bubble", "Baš dobro!", "#ff2945", "#fffdf8", "#b51d43", { outlineWidth: 3.2, outerOutlineWidth: 1, uppercase: false, outlineGlow: true, outlineGlowColor: "#ff405b" }),
  duo("duoElectric", "Electric lemon", "PUNA ENERGIJA", captionColors.electricYellow, "#18dffc", "#123b72"),
  duo("duoStrawberry", "Jagoda i mlijeko", "MALA PRIČA", "#fff9f4", "#f43d60", "#7b1743"),
  duo("duoGrape", "Purple pop", "SVOJ RITAM", "#f7e7ff", "#b45cff", "#422475", { outlineGlow: true, outlineGlowColor: "#c06cff", glowIntensity: 60 }),
  duo("duoMint", "Mint punch", "SVJEŽA IDEJA", "#dafff0", "#20ddaa", "#155f69"),
  duo("duoTangerine", "Orange pop", "SJAJAN TRENUTAK", "#fff1cc", "#ff852f", "#963148"),
  duo("duoArctic", "Arctic blue", "JASNO I GLASNO", "#f7fdff", "#49c9ff", "#254dad"),
  duo("duoPink", "Pink voltage", "DOBRA VIBRA", "#ffef66", "#ff51a6", "#7f247b", { outlineGlow: true, outlineGlowColor: "#ff63b1", glowIntensity: 60 }),
  duo("duoPeach", "Breskva i lavanda", "Lijep trenutak", "#ffe0b7", "#bda1ff", "#59417d", { uppercase: false }),
  duo("duoContrast", "Žuto + bijelo", "PRIČA KOJA OSTAJE", captionColors.white, "#11131e", captionColors.electricYellow, { wordColorMode: "alternate", highlightColor: captionColors.electricYellow, outerOutlineWidth: .9, outlineWidth: 2.6 }),
  duo("duoBeat", "Riječ u fokusu", "PRATI MOJ RITAM", captionColors.white, "#10151d", "#42dfc5", { wordColorMode: "active", highlightColor: captionColors.electricYellow, outerOutlineWidth: 1 }),
];
// Put the new reference-inspired combinations first without changing existing template keys.
templates.unshift(...duoTemplates);

export const dynamicTemplates: CaptionTemplate[] = [
  { key: 'revealPop', name: 'Riječi iskaču', sample: 'Svaka riječ ima ritam', category: 'Dinamični', preset: { reveal: 'pop', textColor: '#ffffff', highlightColor: '#ccff36', outlineWidth: 2, fontScale: 110 } },
  { key: 'revealRise', name: 'Ulazak odozdo', sample: 'Podigni svoju priču', category: 'Dinamični', preset: { reveal: 'rise', textColor: '#ffffff', outlineWidth: 1, fontScale: 110 } },
  { key: 'revealFade', name: 'Fade 40 → 100', sample: 'Neka riječi ožive', category: 'Dinamični', preset: { reveal: 'fade', fadeFrom: .4, textColor: '#fff0dc', outlineWidth: 0 } },
  { key: 'revealLetters', name: 'Slovo po slovo', sample: 'Priča nastaje pred tobom', category: 'Dinamični', preset: { reveal: 'letters', fontFamily: 'Courier New, monospace', textColor: '#ffffff', outlineWidth: 1 } },
  { key: 'wordUnderline', name: 'Podvučena riječ', sample: 'Istakni ono što vrijedi', category: 'Dinamični', preset: { reveal: 'pop', underline: true, underlineColor: '#ffdc52', emphasisWord: -1, outlineWidth: 1 } },
  { key: 'mixedFocus', name: 'Velika tanka riječ', sample: 'Tvoja priča počinje ovdje', category: 'Dinamični', preset: { reveal: 'fade', emphasisWord: 1, fontFamily: 'Arial, sans-serif', fontScale: 110, outlineWidth: 0 } },
  { key: 'behindPerson', name: 'Iza osobe', sample: 'Tvoja priča vrijedi', category: 'Dinamični', preset: { reveal: 'rise', behindPerson: true, wordMode: 'single', y: 32, uppercase: true, textColor: '#bcff35', outlineWidth: 0, fontScale: 145 } },
];
for (const template of dynamicTemplates) template.preset = { wordMode: 'template', ...template.preset };
templates.unshift(...dynamicTemplates);
// Built-in styles share the third horizontal guide for the main caption.
for(const template of templates)template.preset={...template.preset,...(!isPresetCaptionStyle(template.key)?{fontScale:100}:{}),position:"bottom",y:template.key==='curvyBackdrop'?28:template.key==='prismWords'?45:['trackingStack','scriptVerbatim'].includes(template.key)?62:65};


export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  textColor: captionColors.white, highlightColor: captionColors.lime, fontFamily: "Georgia, serif",
  fontScale: 100, position: "bottom", uppercase: false, alignment: "center",
  outlineWidth: 0, backgroundColor: captionColors.black, backgroundOpacity: 0,
  x: 50, y: 65, rotation: 0,
  glowIntensity: 120, glowRadius: 70, effectDepth: 65, outlineColor: captionColors.ink,
  outerOutlineColor: captionColors.white, outerOutlineWidth: 1.5, outlineGlow: false,
  outlineGlowColor: captionColors.yellow, wordColorMode: "solid",
  gradientAngle: 90, letterSpacing: 0, wordMode: "template", animation: "none",
};

export function settingsForTemplate(template: CaptionTemplate, current = DEFAULT_CAPTION_SETTINGS): CaptionSettings {
  return { ...DEFAULT_CAPTION_SETTINGS, fontFamily: "Arial, sans-serif", outlineWidth: 2, x: 50, y: current.y, position: current.position,
    rotation: current.rotation, wordMode: current.wordMode, ...template.preset };
}

const catalogStyleKeys:StyleKey[]=['bubble','retro',...testTemplates.map(template=>template.key),...collectionTemplates.map(template=>template.key),...neonRiotTemplates.map(template=>template.key),'orbitSignal','velvetScript','inkImpact','prismFold','scriptVerbatim','underlinedEditorial','curvyBackdrop','prismWords','trackingStack','metallicCompactV2','premiumOrangeV4','waveWords','terminalType','goldMesh','tripleGothic','captionsScript','smokeSerif','dynamicGlass','comicLetterBounce','sketchNote','lensFrame','popCollage','aeArtbrushSticker','goldBold','depthText','hightech','cyberTrack','brushTitle','slideFall','paperCut','primeFrame','prism','stackedHeadlines','verticalTitle','sweepTitle','readingFade','blurReading','editorialHeader','boldHeader','prismPop','mistWords','newsHighlight','bigKeyword','clean','box','minimal','focus','karaoke','social','neon','neonPink','glow','cinema','elegant','typewriter','duoElectric','duoCherry','duoMint'];
export const visibleStyleKeys=catalogStyleKeys.filter(key=>(!isInkMixStyle(key)||key===inkMixBase)&&!ordinaryStyleFamilies[key]&&!removedStyleKeys.has(key)&&(!isRiplineStyle(key)||key===riplineBase)&&key!=='collectionSilkTorsion'&&key!=='collectionJuiceJam'&&(!key.startsWith('neonRiot')||key==='neonRiot'));
export const visibleTemplates=visibleStyleKeys.filter(key=>!ordinaryStyleFamilies[key]&&!removedStyleKeys.has(key)&&key!=='collectionSilkTorsion'&&key!=='collectionJuiceJam'&&(!key.startsWith('neonRiot')||key==='neonRiot')).map(key=>templates.find(t=>t.key===key)!);
