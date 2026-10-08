export type StyleKey =
  | import('./test-styles').TestStyleKey
  | import('./collection').CollectionStyleKey
  | "orbitSignal" | "velvetScript"
  | "inkImpact"
  | "prismFold"
  | "neonRiot" | "neonRiotElectric" | "neonRiotAcid" | "neonRiotCandy" | "neonRiotFire" | "neonRiotIce" | "neonRiotLaser" | "neonRiotViolet" | "neonRiotSunset" | "neonRiotChrome" | "neonRiotRetro" | "neonRiotToxic" | "neonRiotOcean" | "neonRiotBubble" | "neonRiotSolar" | "neonRiotCyber" | "neonRiotMint" | "neonRiotInferno" | "neonRiotAurora" | "neonRiotPrism"
  | "scriptVerbatim" | "underlinedEditorial" | "curvyBackdrop" | "prismWords" | "trackingStack" | "metallicCompactV2" | "premiumOrangeV4" | "waveWords" | "terminalType" | "goldMesh" | "orbitGlow" | "tripleGothic" | "testSerif" | "captionsScript" | "smokeSerif" | "dynamicGlass" | "comicLetterBounce" | "sketchNote" | "lensFrame" | "vistaRise" | "popCollage" | "aeArtbrushSticker" | "goldBold" | "depthText"
  | "hightech" | "cyberTrack" | "brushTitle" | "slideFall"
  | "blurReading" | "editorialHeader" | "boldHeader" | "prismPop" | "mistWords" | "newsHighlight" | "bigKeyword"
  | "prism" | "verticalTitle" | "sweepTitle" | "readingFade"
  | "primeFrame" | "stackedHeadlines" | "paperCut" | "editorialLight"
  | "revealPop" | "revealRise" | "revealFade" | "revealLetters" | "wordUnderline" | "mixedFocus" | "behindPerson"
  | "clean"
  | "focus"
  | "word"
  | "karaoke"
  | "box"
  | "bounce"
  | "minimal"
  | "news"
  | "glow"
  | "marker"
  | "comic"
  | "cinema"
  | "retro"
  | "gradient"
  | "outline"
  | "bubble"
  | "neon"
  | "neonPink"
  | "cyber"
  | "threeD"
  | "sticker"
  | "chrome"
  | "fire"
  | "ice"
  | "typewriter"
  | "elegant"
  | "gaming"
  | "urgent"
  | "pastel"
  | "social"
  | "shadow"
  | "captionCard"
  | "duoElectric" | "duoSunshine" | "duoCherry" | "duoStrawberry"
  | "duoGrape" | "duoMint" | "duoTangerine" | "duoArctic"
  | "duoPink" | "duoPeach" | "duoContrast" | "duoBeat";
export type CaptionPosition = "top" | "middle" | "bottom";
export type CaptionWord = { text: string; start: number; end: number };
export type Segment = {
  keywordWord?: number | null;
  headingWord?: number | null;
  frameAnimationStart?: number;
  frameAnimationEnd?: number;
  effectOnly?: boolean;
  separateStyle?: boolean;
  standaloneTitle?: boolean;
  inheritedStyle?: {style:StyleKey;settings:CaptionSettings};
  titleStyle?: StyleKey;
  titleOverrides?: Partial<CaptionSettings>;
  suggestedTitle?: boolean;
  suggestedForStyle?: StyleKey;
  suppressSuggestions?: boolean;
  manualTitleLayout?: boolean;
  titleFill?: boolean;
  hiddenTitleWords?: number[];
  sourceCaptionId?: string;
  sourceWord?: number;
  group?: {id:string;name:string;color:string};
  id: string;
  start: number;
  end: number;
  text: string;
  confidence?: number;
  lane?: number;
  role?: "title";
  laneStyle?: {style:StyleKey;settings:CaptionSettings};
  detachedStyle?: {style:StyleKey;settings:CaptionSettings};
  words?: CaptionWord[];
  position?: { x: number; y: number };
  wordOffsets?: Record<number, { x: number; y: number; text: string }>;
  wordsSeparated?: boolean;
  wordStyles?: Record<number, { linked?: boolean; text: string; style: StyleKey; settings: CaptionSettings }>;
};
export type CaptionSettings = {
  collectionPalette?: string;
  collectionColors?: string;
  collectionTexture?: number;
  collectionShine?: number;
  collectionEffects?: number;
  collectionBlur?: number;
  collectionFont?: string;
  collectionMark?: string;
  collectionMaterial?: string;
  collectionSpeed?: number;
  collectionDepth?: number;
  collectionPower?: number;
  collectionDetail?: number;
  collectionDecorations?: boolean;
  collectionBackdrop?: boolean;
  orbitWords?: number;
  orbitEntry?: number;
  orbitSpeed?: number;
  orbitRadius?: number;
  orbitSatellites?: number;
  orbitGlow?: number;
  velvetWords?: number;
  velvetEntryOrder?: 'phrase' | 'spoken';
  velvetFlourishWidth?: number;
  orbitRings?: boolean;
  orbitDashes?: boolean;
  orbitLeader?: boolean;
  velvetWrite?: boolean;
  velvetPenGlow?: boolean;
  velvetFlourish?: boolean;
  orbitColor2?: string;
  velvetShadowColor?: string;
  inkWords?: number;
  inkImpact?: number;
  inkGrain?: number;
  inkRoughness?: number;
  inkDrops?: number;
  inkSpread?: number;
  inkTilt?: number;
  inkRowGap?: number;
  inkExitDuration?: number;
  inkBrush?: boolean;
  inkSplatter?: boolean;
  inkUnderline?: boolean;
  inkColor2?: string;
  inkBrushTextColor?: string;
  riotDamping?: number;
  riotFrequency?: number;
  riotTilt?: number;
  riotFloat?: number;
  riotTrailStrength?: number;
  riotParticleCount?: number;
  riotSpread?: number;
  riotParticleDuration?: number;
  riotExitDuration?: number;
  riotUnderlineWidth?: number;
  riotUnderlineDuration?: number;
  riotBoxRadius?: number;
  riotGlow?: number;
  accentStrength?: number;
  accentDuration?: number;
  accentTrailDistance?: number;
  accentParticleCount?: number;
  riotTrails?: boolean;
  riotGradient?: boolean;
  accentTrails?: boolean;
  accentParticles?: boolean;
  riotTrailColor1?: string;
  riotTrailColor2?: string;
  accentColor?: string;
  accentColor2?: string;
  accentMotion?: 'none' | 'spring' | 'slide' | 'wave' | 'flip' | 'zoom' | 'glitch';
  foldWords?: number;
  foldEntryOrder?: 'phrase' | 'spoken';
  foldSlices?: number;
  foldStrength?: number;
  foldStagger?: number;
  foldColor2?: string;
  foldBeamSpeed?: number;
  foldBeam?: boolean;
  foldRim?: boolean;
  foldEcho?: boolean;
  riotColor2?: string;
  riotColor3?: string;
  riotColor4?: string;
  riotColor5?: string;
  riotWords?: number;
  riotLetterDelay?: number;
  riotMotion?: 'spring' | 'slide' | 'wave' | 'flip' | 'zoom' | 'glitch';
  riotMotionStrength?: number;
  riotParticles?: boolean;
  riotBoxes?: boolean;
  riotUnderline?: boolean;
  metallicMaterial?: "auto" | "silver" | "red" | "orange";
  metallicZone?: "mixed" | "top" | "bottom";
  metallicPhraseWords?: number;
  metallicHoldEnd?: boolean;
  metallicRed?: string;
  metallicSilver?: string;
  metallicShine?: number;
  premiumEntrance?: "mixed" | "upright" | "italic";
  premiumPhraseWords?: number;
  captionFrame?: boolean;
  frameColor?: string;
  frameCount?: number;
  frameWidth?: number;
  frameInset?: number;
  frameWave?: number;
  scriptLineMode?: 'full'|'right';
  scriptWidth?: number;
  scriptDrawDuration?: number;
  sketchPen?: number;
  sketchEllipseWidth?: number;
  sketchMarker?: boolean;
  sketchMarkerOpacity?: number;
  lensMotion?: number;
  lensShotInterval?: number;
  popSize?: number;
  popInset?: number;
  captionSound?: 'none'|'whoosh'|'pop'|'tick';
  captionSoundVolume?: number;
  glassCamera?: boolean;
  glassIntensity?: number;
  glassAccentColor?: string;
  effectPlayback?: "hold"|"repeat";
  effectIdle?: "float"|"shimmer"|"zoom"|"tilt"|"gradient"|"none";
  effectIdleColor?: string;
  allowOverflow?: boolean;
  prismStrength?: number;
  backgroundTitles?: number;
  textMaterial?: 'matte'|'metal'|'brushed'|'stone'|'satin';
  surfaceHighlight?: number;
  surfaceShadow?: number;
  shineMode?: 'none'|'sweep'|'double'|'diagonal'|'ripple';
  shineStrength?: number;
  shineSpeed?: number;
  shineWidth?: number;
  motionCurve?: 'linear'|'smooth'|'softStop'|'spring';
  borderMist?: boolean;
  textureBackground?: boolean;
  textureOpacity?: number;
  frostWidth?: number;
  frostHeight?: number;
  smokeSpread?: number;
  smokeDuration?: number;
  surfaceColor?: string;
  surfaceOpacity?: number;
  surfaceStrength?: number;
  surfaceBevel?: number;
  surfaceLightAngle?: number;
  textDepth?: number;
  textDepthColor?: string;
  secondaryStyle?: Partial<CaptionSettings>;
  secondaryFontFamily?: string;
  secondaryFontScale?: number;
  reveal?: "slideLeft" | "zoom" | "softBlur" | "slideFall" | "none" | "pop" | "rise" | "fade" | "letters";
  revealGroupSize?: number;
  displayWordCount?: number;
  revealDuration?: number;
  fadeFrom?: number;
  underline?: boolean;
  underlineColor?: string;
  emphasisWord?: number;
  behindPerson?: boolean;
  textColor: string;
  highlightColor: string;
  fontWeight?: number;
  italic?: boolean;
  textUnderline?: boolean;
  textUnderlineStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'marker' | 'pencil' | 'script';
  shadowDirection?: 'same'|'opposed';
  shadowMode?: 'none'|'drop'|'long'|'inner'|'soft'|'hard'|'colored'|'multiple';
  shadowColor?: string;
  shadowSecondColor?: string;
  shadowOpacity?: number;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  shadowLength?: number;
  glowMode?: 'none'|'outer'|'inner'|'neon'|'rgb'|'pulsing';
  glowColor?: string;
  glowOpacity?: number;
  glowBlur?: number;
  glowSpeed?: number;
  textBlur?: number;
  textStrike?: boolean;
  textStrikeStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'marker' | 'pencil' | 'script';
  textStrikeColor?: string;
  textStrikeOffset?: number;
  textStrikeWidth?: number;
  textStrikeSkew?: number;
  textUnderlineColor?: string;
  /** Font-relative percentages, shared by preview and export. */
  textUnderlineOffset?: number;
  textUnderlineWidth?: number;
  textUnderlineSkew?: number;
  lineHeight?: number;
  wordSpacing?: number;
  fontFamily: string;
  fontScale: number;
  position: CaptionPosition;
  uppercase: boolean;
  alignment: "left" | "center" | "right" | "justify";
  wordsPerLine?: number;
  verticalAlignment?: "top" | "middle" | "bottom";
  displayScale?: number;
  displaySkew?: number;
  displayWarp?: number;
  displayBend?: number;
  displayArc?: number;
  displayDistort?: number;
  displayPerspective?: number;
  displayStretch?: number;
  displayCompress?: number;
  tracking?: number;
  kerning?: "auto" | "normal" | "none";
  outlineWidth: number;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundBorderStyle?: 'single'|'double'|'triple';
  backgroundBorderWave?: number;
  backgroundLook?: 'solid'|'gradient'|'glass'|'marker'|'outline'|'raised'|'sketch'|'paperCut';
  backgroundColor2?: string;
  backgroundAngle?: number;
  backgroundTexture?: CaptionSettings['fillTexture'];
  backgroundTextureScale?: number;
  backgroundTextureAmount?: number;
  backgroundShadow?: number;
  backgroundShadowBlur?: number;
  backgroundGlow?: number;
  backgroundGlowColor?: string;
  backgroundBorderWidth?: number;
  backgroundBorderColor?: string;
  backgroundDepth?: number;
  backgroundDepthColor?: string;
  backgroundScope?: 'none'|'caption'|'line'|'active';
  backgroundPaddingX?: number;
  backgroundPaddingY?: number;
  backgroundRadius?: number;
  x: number;
  y: number;
  rotation: number;
  glowIntensity: number;
  glowRadius: number;
  effectDepth: number;
  typingUnit?: "letters" | "words";
  waveStrength?: number;
  glyphSmokeScale?: number;
  orbitBend?: number;
  faceTexture?: "goldMesh";
  fillTexture?: "none" | "goldReference" | "prism" | "gold" | "silver" | "chrome" | "neonColor" | "duotone" | "glass" | "frostedGlass" | "crystalText" | "transparent" | "acrylic" | "iceGlass" | "pattern" | "texture" | "matte" | "metal" | "brushed" | "satin" | "marble" | "granite" | "stone" | "concrete" | "brick" | "wood" | "carbon" | "leather" | "denim" | "fabric" | "paper" | "vintagePaper" | "water" | "ocean" | "fire" | "lava" | "ice" | "snow" | "smoke" | "cloud" | "sand" | "mud" | "moss" | "grass" | "luxuryGold" | "blackGold" | "diamond" | "crystal" | "pearl" | "jewel" | "emerald" | "sapphire" | "ruby" | "hologram" | "cyberpunk" | "matrix" | "rgbSplit" | "digitalNoise" | "techGrid" | "scifiMetal" | "aiGlow" | "image" | "video" | "meshGradient" | "liquidGlass" | "holographicFoil" | "iridescent" | "oilSlick" | "aurora" | "chromeGradient" | "rgbShift" | "glassNeon" | "liquidMetal";
  specialEffect?: "none" | "glitch" | "distortion" | "melt" | "liquid" | "ink" | "paint" | "spray" | "graffiti" | "explosion" | "lightning" | "plasma" | "energy";
  specialEffectStrength?: number;
  specialEffectSpeed?: number;
  specialEffectColor?: string;
  textureAmount?: number;
  textureDetail?: number;
  textureSpeed?: number;
  depthMaterial?: "plastic" | "glossyPlastic" | "mattePlastic" | "rubber" | "ceramic" | "glass" | "metal" | "gold" | "chrome";
  depthMode?: "none" | "extrude" | "bevel" | "emboss" | "isometric" | "perspective" | "floating" | "metallic" | "glass";
  depthFaceColor?: string;
  depthSideColor?: string;
  depthLightColor?: string;
  depthLightStrength?: number;
  depthLightAngle?: number;
  depthTiltX?: number;
  depthTiltY?: number;
  depthShadow?: number;
  depthShadowSoftness?: number;
  depthRoughness?: number;
  depthFocus?: number;
  depthMotion?: number;
  depthSize?: number;
  depthAngle?: number;
  depthReflection?: number;
  fillTextureScale?: number;
  fillTextureColor?: string;
  fillTextureColor2?: string;
  fillTextureUrl?: string;
  fillTextureName?: string;
  outlineStyle?: 'solid'|'double'|'dashed'|'dotted'|'neon'|'glow';
  outlineLayers?: {color:string;width:number;gradient?:boolean;endColor?:string;style?:'solid'|'double'|'dashed'|'dotted'|'neon'|'glow'}[];
  textOpacity?: number;
  customOutline?: boolean;
  outlineGradient?: boolean;
  outlineGradientEnd?: string;
  textGradient?: boolean;
  textGradientMode?: 'linear'|'radial'|'wave'|'rainbow';
  textGradientStart?: string;
  textGradientEnd?: string;
  textGradientMiddle?: string;
  fontSizePx?: number;
  titleAppearance?: Partial<CaptionSettings>;
  outlineColor: string;
  outerOutlineColor: string;
  outerOutlineWidth: number;
  outlineGlow: boolean;
  outlineGlowColor: string;
  wordColorMode: "solid" | "alternate" | "active" | "lines";
  gradientAngle: number;
  letterSpacing: number;
  wordMode: "template" | "single" | "all" | "spoken" | "highlight";
  animation: "none" | "pop" | "fade" | "pulse";
};

export type StyleCategory = "Sve" | "Dinamični" | "Dvobojni" | "Viralno" | "Neon" | "Čisto" | "Film";
export type CaptionTemplate = {
  portrait?: number;
  key: StyleKey;
  name: string;
  sample: string;
  category: Exclude<StyleCategory, "Sve">;
  preset?: Partial<CaptionSettings>;
};
