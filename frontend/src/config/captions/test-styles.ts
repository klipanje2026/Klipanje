import type {CaptionSettings,CaptionTemplate,StyleKey} from './types';

// Independent identities for review; behavior is inherited from the shared renderer.
export const testStyleBases={
 testSlateLabel:'clean',testTangerineStamp:'sticker',testGlassPearl:'clean',testMarginNote:'clean',testCyanOutline:'outline',
 testTypeIvory:'typewriter',testTypeTerminal:'clean',testTypeRibbon:'clean',
 testNeonCyan:'neon',testNeonRose:'neonPink',testNeonLime:'neon',
 testGlowHoney:'glow',testGlowArctic:'glow',testGlowLavender:'clean',
 testCinemaIvory:'cinema',testCinemaNoir:'cinema',testCinemaGold:'elegant',
 testElectricLemon:'duoElectric',testCherryBubble:'duoCherry',testMintBubble:'bubble',
 testInkCard:'box',testCobaltMarker:'clean',testCoralPaper:'clean',
 testPopCoral:'clean',testRiseTeal:'clean',testWordPulse:'bounce',
 testUnderlineGold:'clean',testKaraokeMango:'karaoke',testRetroPeach:'retro',testFocusIce:'focus',
} as const;
export const pendingTestStyles=new Set<string>();
export type TestStyleKey=keyof typeof testStyleBases;
export const isTestStyle=(style:string):style is TestStyleKey=>Object.hasOwn(testStyleBases,style);
export const testRenderStyle=(style:StyleKey):StyleKey=>isTestStyle(style)?testStyleBases[style]:style;

const base:Partial<CaptionSettings>={
 fontFamily:'"Inter Variable", Arial, sans-serif',fontWeight:800,fontScale:100,
 textColor:'#ffffff',highlightColor:'#ffffff',uppercase:false,outlineWidth:0,
 outerOutlineWidth:0,outlineGlow:false,backgroundOpacity:0,backgroundScope:'none',
 wordMode:'template',wordColorMode:'solid',animation:'none',reveal:'none',
 revealDuration:.2,displayWordCount:4,wordsPerLine:4,lineHeight:1.15,
 shadowMode:'drop',shadowColor:'#111827',shadowOpacity:65,shadowBlur:8,shadowY:3,
};
const preset=(key:TestStyleKey,name:string,category:CaptionTemplate['category'],sample:string,settings:Partial<CaptionSettings>):CaptionTemplate=>({
 key,name,category,sample,preset:{...base,
  // Explicit count mode shows a whole page; spoken entrances use their own timings.
  ...(settings.reveal&&settings.reveal!=='none'?{displayWordCount:0}:{}),...settings},
});
const neon:Partial<CaptionSettings>={fontFamily:'"Montserrat Variable", sans-serif',fontWeight:800,uppercase:true,glowIntensity:80,glowRadius:35,shadowMode:'none'};
const cinema:Partial<CaptionSettings>={fontFamily:'"Inter Variable", sans-serif',fontWeight:500,letterSpacing:.7,shadowOpacity:80,shadowBlur:12,reveal:'fade',fadeFrom:0,revealDuration:.22};
const bubble:Partial<CaptionSettings>={fontFamily:'"Nunito Variable", sans-serif',fontWeight:900,outlineWidth:2.4,outerOutlineWidth:1.3,backgroundOpacity:0,shadowMode:'none'};

export const testTemplates:CaptionTemplate[]=[
 preset('testSlateLabel','Slate label','Čisto','Svaka riječ na svom mjestu',{fontFamily:'"Inter Variable", sans-serif',fontWeight:650,textColor:'#f6f8fc',highlightColor:'#9ed9ff',backgroundColor:'#283549',backgroundOpacity:95,backgroundScope:'line',backgroundRadius:4,backgroundPaddingX:18,backgroundPaddingY:10,backgroundBorderWidth:1,backgroundBorderColor:'#8ba3bf',letterSpacing:.5}),
 preset('testTangerineStamp','Tangerine stamp','Viralno','Ideja koja ostavlja trag',{fontFamily:'"Montserrat Variable", sans-serif',fontWeight:900,uppercase:true,textColor:'#fff2db',highlightColor:'#ff903d',outlineColor:'#c44f20',outlineWidth:2.2,shadowMode:'hard',shadowColor:'#602736',shadowX:3,shadowY:4,shadowBlur:0,reveal:'pop',revealDuration:.18}),
 preset('testGlassPearl','Glass pearl','Čisto','Tiha priča jasne riječi',{fontFamily:'"Raleway Variable", sans-serif',fontWeight:600,textColor:'#f3faff',highlightColor:'#a9dfe9',backgroundColor:'#3b566a',backgroundLook:'glass',backgroundOpacity:62,backgroundScope:'caption',backgroundRadius:16,backgroundPaddingX:18,backgroundPaddingY:11,backgroundBorderWidth:1,backgroundBorderColor:'#c4e5f1',shadowBlur:10}),
 preset('testMarginNote','Margin note','Film','Zapiši ono što vrijedi',{fontFamily:'"Caveat Variable", cursive',fontWeight:700,textColor:'#fff0d0',highlightColor:'#ffb582',displayWordCount:0,wordMode:'spoken',reveal:'rise',revealDuration:.17,textUnderline:true,textUnderlineStyle:'pencil',textUnderlineColor:'#ffb582',textUnderlineWidth:3,shadowOpacity:75,letterSpacing:.3}),
 preset('testCyanOutline','Cyan outline','Viralno','Tvoj glas u prvom planu',{fontFamily:'"Oswald Variable", sans-serif',fontWeight:800,uppercase:true,textColor:'#97efff',highlightColor:'#97efff',outlineColor:'#97efff',outlineWidth:1.8,shadowColor:'#092e4a',shadowOpacity:90,shadowBlur:5,letterSpacing:1.2}),
 preset('testTypeIvory','Typewriter · Ivory','Film','Svaka priča počinje riječima',{fontFamily:'"Courier New", monospace',fontWeight:600,textColor:'#fff3da',highlightColor:'#fff3da',typingUnit:'letters',displayWordCount:0,letterSpacing:.4}),
 preset('testTypeTerminal','Typewriter · Terminal','Film','Nova ideja je spremna',{fontFamily:'"Courier New", monospace',textColor:'#8bf5ba',highlightColor:'#8bf5ba',typingUnit:'words',displayWordCount:0,wordMode:'spoken',reveal:'fade',fadeFrom:0,revealDuration:.12,backgroundColor:'#10221c',backgroundOpacity:88,backgroundScope:'caption',backgroundRadius:8,backgroundPaddingX:15,backgroundPaddingY:9}),
 preset('testTypeRibbon','Typewriter · Lavender ribbon','Dinamični','Tvoj glas pokreće priču',{fontFamily:'"Inter Variable", sans-serif',fontWeight:600,textColor:'#eee9ff',displayWordCount:0,reveal:'letters',revealDuration:.3,backgroundColor:'#30264f',backgroundOpacity:85,backgroundScope:'line',backgroundRadius:8}),
 preset('testNeonCyan','Neon · Cyan line','Neon','Jasno i glasno',{...neon,textColor:'#20dfff',highlightColor:'#20dfff',letterSpacing:1}),
 preset('testNeonRose','Neon · Rose club','Neon','Ovo je naš trenutak',{...neon,textColor:'#ff389d',highlightColor:'#ff389d',fontWeight:900,reveal:'fade',fadeFrom:0}),
 preset('testNeonLime','Neon · Lime signal','Neon','Spremni za novi nivo',{...neon,fontFamily:'"Oswald Variable", sans-serif',textColor:'#baff3b',highlightColor:'#baff3b',letterSpacing:1.2,displayWordCount:0,reveal:'rise',revealDuration:.16}),
 preset('testGlowHoney','Glow · Honey','Neon','Male stvari vrijede više',{...neon,uppercase:false,textColor:'#ffc460',highlightColor:'#ffc460',glowIntensity:60,glowRadius:25,fontWeight:700}),
 preset('testGlowArctic','Glow · Arctic','Neon','Priča ostaje s tobom',{...neon,textColor:'#a2e8ff',highlightColor:'#a2e8ff',fontFamily:'"Raleway Variable", sans-serif',glowIntensity:75,glowRadius:30,letterSpacing:1.8}),
 preset('testGlowLavender','Glow · Lavender mist','Neon','Samo prati svoj ritam',{fontFamily:'"Nunito Variable", sans-serif',textColor:'#f4eaff',highlightColor:'#f4eaff',glowMode:'outer',glowColor:'#ac74ff',glowOpacity:80,glowBlur:15,shadowMode:'none',reveal:'fade',fadeFrom:0}),
 preset('testCinemaIvory','Cinema · Ivory','Film','Neke priče ostanu zauvijek',{...cinema,textColor:'#f9f2e4',highlightColor:'#f9f2e4',fontWeight:500}),
 preset('testCinemaNoir','Cinema · Noir bar','Film','Sve počinje jednim trenutkom',{...cinema,uppercase:true,textColor:'#f5f5f3',highlightColor:'#f5f5f3',fontWeight:600,backgroundColor:'#111216',backgroundOpacity:78,backgroundScope:'line',backgroundRadius:2,backgroundPaddingX:18,backgroundPaddingY:8}),
 preset('testCinemaGold','Cinema · Gold serif','Film','Vrijeme za tvoju priču',{...cinema,fontFamily:'"Playfair Display Variable", Georgia, serif',textColor:'#fff1ce',highlightColor:'#e5bc69',fontWeight:600,italic:true,wordColorMode:'active'}),
 preset('testElectricLemon','Electric · Lemon punch','Dvobojni','Puna energija svaki dan',{...bubble,uppercase:true,textColor:'#edff28',highlightColor:'#edff28',outlineColor:'#00d3ec',outerOutlineColor:'#123857',outlineWidth:2.4,outerOutlineWidth:1.3,letterSpacing:.5}),
 preset('testCherryBubble','Bubble · Cherry cream','Dvobojni','Baš dobra priča',{...bubble,textColor:'#ff4569',highlightColor:'#ff4569',outlineColor:'#fffaf3',outerOutlineColor:'#882842',outlineWidth:3,outerOutlineWidth:1,outlineGlow:true,displayWordCount:0,outlineGlowColor:'#ff5d80',glowIntensity:35,glowRadius:18,reveal:'pop',revealDuration:.16}),
 preset('testMintBubble','Bubble · Mint card','Viralno','Svježa ideja za danas',{fontFamily:'"Nunito Variable", sans-serif',fontWeight:900,textColor:'#103e35',highlightColor:'#103e35',backgroundColor:'#baf9db',backgroundOpacity:100,backgroundScope:'caption',backgroundRadius:24,backgroundPaddingX:17,backgroundPaddingY:10,shadowOpacity:25,shadowBlur:5}),
 preset('testInkCard','Card · Ink and cream','Čisto','Riječi koje se lako čitaju',{fontWeight:650,textColor:'#fff6e5',highlightColor:'#fff6e5',backgroundColor:'#18222e',backgroundOpacity:94,backgroundScope:'line',backgroundRadius:9,backgroundPaddingX:15,backgroundPaddingY:9}),
 preset('testCobaltMarker','Marker · Cobalt','Viralno','Istakni ono što vrijedi',{uppercase:true,textColor:'#ffffff',highlightColor:'#ffffff',outlineColor:'#101b36',outlineWidth:1.7,shadowOpacity:95,shadowBlur:5,backgroundColor:'#2159dc',backgroundOpacity:100,backgroundScope:'active',backgroundLook:'marker',backgroundRadius:3,backgroundPaddingX:8,backgroundPaddingY:5,wordColorMode:'active'}),
 preset('testCoralPaper','Card · Coral paper','Čisto','Dobar dan za novu ideju',{fontFamily:'"Raleway Variable", sans-serif',fontWeight:700,textColor:'#3a202b',highlightColor:'#3a202b',backgroundColor:'#ffbaaa',backgroundColor2:'#ffdcc8',backgroundLook:'paperCut',backgroundOpacity:100,backgroundScope:'caption',backgroundRadius:4,backgroundShadow:25,backgroundPaddingX:16,backgroundPaddingY:9,shadowMode:'none'}),
 preset('testPopCoral','Pop · Coral beat','Dinamični','Svaka riječ ima svoj ritam',{fontFamily:'"Montserrat Variable", sans-serif',fontWeight:900,uppercase:true,textColor:'#fff7ed',highlightColor:'#ff836f',displayWordCount:0,wordMode:'spoken',wordColorMode:'active',outlineColor:'#30242b',outlineWidth:1.1,reveal:'pop',revealDuration:.16}),
 preset('testRiseTeal','Rise · Teal','Dinamični','Podigni svoju priču više',{fontFamily:'"Inter Variable", sans-serif',fontWeight:800,textColor:'#eafff5',highlightColor:'#6ce3c8',displayWordCount:0,wordMode:'spoken',wordColorMode:'active',reveal:'rise',revealDuration:.2,underline:true,underlineColor:'#5ed8bb',emphasisWord:-1}),
 preset('testWordPulse','Pulse · One word','Dinamični','Jedna riječ mijenja sve',{fontFamily:'"Oswald Variable", sans-serif',fontWeight:800,uppercase:true,textColor:'#fff5da',highlightColor:'#fff5da',displayWordCount:0,wordMode:'single',outlineWidth:1,outlineColor:'#1c2330',animation:'pop'}),
 preset('testUnderlineGold','Underline · Gold note','Čisto','Ostavi prostor za dobru priču',{fontFamily:'"Inter Variable", sans-serif',fontWeight:650,textColor:'#fff8eb',highlightColor:'#ffce6b',wordColorMode:'active',underline:true,underlineColor:'#ffce6b',emphasisWord:-1,reveal:'fade',fadeFrom:0,revealDuration:.14}),
 preset('testKaraokeMango','Karaoke · Mango','Viralno','Prati svaku izgovorenu riječ',{fontFamily:'"Montserrat Variable", sans-serif',fontWeight:850,uppercase:true,textColor:'#fff7e8',highlightColor:'#ffac35',outlineWidth:1.4,outlineColor:'#242534',wordMode:'highlight',wordColorMode:'active'}),
 preset('testRetroPeach','Retro · Peach shadow','Viralno','Stari osjećaj nova priča',{fontFamily:'"Nunito Variable", sans-serif',fontWeight:900,textColor:'#ffe4be',highlightColor:'#ffe4be',outlineColor:'#743754',outlineWidth:1,shadowMode:'hard',shadowColor:'#743754',shadowOpacity:100,shadowX:4,shadowY:4,shadowBlur:0,letterSpacing:.3}),
 preset('testFocusIce','Focus · Ice word','Viralno','Važno je ono što kažeš',{fontFamily:'"Inter Variable", sans-serif',fontWeight:850,textColor:'#ffffff',highlightColor:'#79dbf1',wordMode:'highlight',wordColorMode:'active',outlineColor:'#122837',outlineWidth:.8,reveal:'fade',fadeFrom:.45,revealDuration:.14}),
];

// Variants belong to existing library cards; ids remain stable in saved projects.
export const ordinaryStyleFamilies:Partial<Record<StyleKey,StyleKey>>={
 testTypeIvory:'typewriter',testTypeTerminal:'typewriter',testTypeRibbon:'typewriter',
 testNeonCyan:'neon',testNeonRose:'neon',testNeonLime:'neon',neonPink:'neon',
 testGlowHoney:'glow',testGlowArctic:'glow',testGlowLavender:'glow',
 testCinemaIvory:'cinema',testCinemaNoir:'cinema',testCinemaGold:'cinema',
 testElectricLemon:'duoElectric',testCherryBubble:'duoCherry',testMintBubble:'bubble',
 testKaraokeMango:'karaoke',testRetroPeach:'retro',testFocusIce:'focus',
};
export const ordinaryStyleFamily=(style:StyleKey):StyleKey=>ordinaryStyleFamilies[style]??style;
